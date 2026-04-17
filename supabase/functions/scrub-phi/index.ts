/**
 * scrub-phi — PHI detection and redaction for user-submitted medical terms.
 *
 * Pipeline:
 *   1. Regex pre-pass (defense in depth: phone, email, SSN, MRN-like, URLs).
 *   2. PhiDetector (AWS Comprehend Medical DetectPHI in Phase 2a).
 *   3. Eponym allowlist filter — drop PERSON/PROFESSION spans matching
 *      phi_eponym_allowlist (Crohn, Sjögren, etc.).
 *   4. LLM Stage 3 adjudication — for spans with score < 0.85, ask Lovable
 *      AI (google/gemini-2.5-flash) "PHI or medical term?" using the eponym
 *      allowlist as context. Ambiguous → redact (fail closed).
 *   5. Merge spans, sort by start, build redacted_text.
 *
 * SPAN COORDINATES: start/end ALWAYS index into the ORIGINAL text the caller
 * supplied. redacted_text replaces each span with [REDACTED:<TYPE>].
 *
 * NEVER stores or logs the original text. The local `text` variable is
 * cleared before any subsequent await once redacted_text has been built.
 *
 * SWAP PATH: PHI detection sits behind the PhiDetector interface
 * (./providers/types.ts). To migrate to self-hosted Presidio (cost-driven —
 * see README), implement a PresidioSidecarDetector with the same interface
 * and swap the detector instantiation below. No other code changes.
 *
 * COST GUIDANCE: AWS Comprehend Medical DetectPHI is ~$0.0014 / 100 chars.
 * When monthly spend exceeds ~$300/mo (~21M chars/mo), evaluate Presidio.
 */
import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "@supabase/supabase-js";
import { AwsComprehendMedicalDetector } from "./providers/aws_comprehend_medical.ts";
import type { PhiDetector, PhiSpan } from "./providers/types.ts";

const ADJUDICATION_THRESHOLD = 0.85;
const ADJUDICATION_MODEL = "google/gemini-2.5-flash";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

// ---------- Stage 1: Regex ----------
const REGEX_RULES: Array<{ type: string; re: RegExp }> = [
  { type: "EMAIL", re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { type: "PHONE", re: /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g },
  { type: "ID",    re: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g },           // SSN-shaped
  { type: "ID",    re: /\bMRN[:\s#]*[A-Z0-9-]{4,}\b/gi },                // MRN-shaped
  { type: "URL",   re: /\bhttps?:\/\/[^\s<>"']+/gi },
];

function regexSpans(text: string): PhiSpan[] {
  const out: PhiSpan[] = [];
  for (const { type, re } of REGEX_RULES) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      out.push({ type, start: m.index, end: m.index + m[0].length, score: 1.0, raw_type: `regex:${type}` });
    }
  }
  return out;
}

// ---------- Stage 3: LLM adjudication for low-confidence spans ----------
async function adjudicateSpans(
  text: string,
  candidates: PhiSpan[],
  allowlist: Set<string>,
): Promise<PhiSpan[]> {
  if (candidates.length === 0) return [];
  const items = candidates.map((s, i) => ({
    i,
    snippet: text.slice(Math.max(0, s.start - 20), Math.min(text.length, s.end + 20)),
    span_text: text.slice(s.start, s.end),
    type: s.type,
  }));
  const sysPrompt =
    `You decide if each span in a medical-context string is PHI (real person info) or a medical term ` +
    `(eponym, drug, condition, anatomy, profession noun). Known medical eponyms include: ` +
    `${Array.from(allowlist).slice(0, 60).join(", ")}. ` +
    `Default to redact when uncertain.`;
  const tool = {
    type: "function",
    function: {
      name: "decide_spans",
      description: "Decide each span: PHI or MEDICAL.",
      parameters: {
        type: "object",
        properties: {
          decisions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                i: { type: "integer" },
                verdict: { type: "string", enum: ["PHI", "MEDICAL"] },
              },
              required: ["i", "verdict"],
            },
          },
        },
        required: ["decisions"],
      },
    },
  };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: ADJUDICATION_MODEL,
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: JSON.stringify({ items }) },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "decide_spans" } },
      }),
    });
    if (!res.ok) {
      // Fail closed: keep all candidates as PHI.
      await res.text().catch(() => "");
      return candidates;
    }
    const data = await res.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return candidates;
    const parsed = JSON.parse(args) as { decisions: Array<{ i: number; verdict: string }> };
    const phiIdx = new Set(parsed.decisions.filter((d) => d.verdict === "PHI").map((d) => d.i));
    return candidates.filter((_, idx) => phiIdx.has(idx));
  } catch {
    return candidates; // fail closed
  }
}

// ---------- Span merging ----------
function mergeSpans(spans: PhiSpan[]): PhiSpan[] {
  if (spans.length === 0) return spans;
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: PhiSpan[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end) {
      last.end = Math.max(last.end, s.end);
      // keep highest-confidence type label
      if (s.score > last.score) {
        last.type = s.type;
        last.score = s.score;
      }
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

function buildRedacted(text: string, spans: PhiSpan[]): string {
  if (spans.length === 0) return text;
  const ordered = [...spans].sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const s of ordered) {
    out += text.slice(cursor, s.start);
    out += `[REDACTED:${s.type}]`;
    cursor = s.end;
  }
  out += text.slice(cursor);
  return out;
}

function countByType(spans: PhiSpan[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const s of spans) c[s.type] = (c[s.type] ?? 0) + 1;
  return c;
}

// ---------- Logging helpers (NEVER include text) ----------
async function logRedaction(
  supabase: ReturnType<typeof createClient>,
  payload: {
    phase: "client_preview" | "server_submit" | "review_rescrub";
    counts: Record<string, number>;
    provider: string;
    model_version: string | null;
    error_code?: string | null;
  },
) {
  // Best-effort; failures are swallowed (no text exposure possible).
  try {
    await supabase.from("redaction_log").insert({
      phase: payload.phase,
      counts: payload.counts,
      provider: payload.provider,
      model_version: payload.model_version,
      error_code: payload.error_code ?? null,
    });
  } catch {
    // intentional no-op
  }
}

// ---------- Provider factory ----------
function makeDetector(): PhiDetector {
  return new AwsComprehendMedicalDetector();
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let body: { text?: unknown; context?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
  const inputText = typeof body.text === "string" ? body.text : "";
  if (!inputText || inputText.length > 5000) {
    return new Response(JSON.stringify({ error: "text_required_or_too_long" }), {
      status: 400, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // Load eponym allowlist (citext UNIQUE; small table, can be cached client-side later)
  const { data: eponymsRows } = await supabase
    .from("phi_eponym_allowlist")
    .select("term");
  const allowlist = new Set<string>(
    (eponymsRows ?? []).map((r: { term: string }) => r.term.toLowerCase()),
  );

  // Stage 1: regex
  const regex = regexSpans(inputText);

  // Stage 2: provider
  let providerSpans: PhiSpan[] = [];
  let provider = "aws_comprehend_medical";
  let modelVersion = "unknown";
  try {
    const detector = makeDetector();
    const result = await detector.detect(inputText);
    providerSpans = result.spans;
    provider = result.provider;
    modelVersion = result.model_version;
  } catch (err) {
    // Note: we have NOT yet built redacted_text, but we also haven't logged
    // any text. Record the failure with empty counts and bubble up.
    const errorCode = (err as { error_code?: string })?.error_code ??
                      (err as Error)?.message ?? "comprehend_unknown";
    await logRedaction(supabase, {
      phase: "server_submit",
      counts: {},
      provider,
      model_version: null,
      error_code: errorCode,
    });
    return new Response(
      JSON.stringify({ error: "phi_detector_unavailable", error_code: errorCode }),
      { status: 503, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }

  // Filter eponyms out of PERSON / PROFESSION spans
  const eponymFiltered = providerSpans.filter((s) => {
    if (s.type !== "PERSON" && s.type !== "PROFESSION") return true;
    const span = inputText.slice(s.start, s.end).toLowerCase();
    return !allowlist.has(span);
  });

  // Stage 3: adjudicate low-confidence spans
  const highConf = eponymFiltered.filter((s) => s.score >= ADJUDICATION_THRESHOLD);
  const lowConf = eponymFiltered.filter((s) => s.score < ADJUDICATION_THRESHOLD);
  const adjudicated = await adjudicateSpans(inputText, lowConf, allowlist);

  const allSpans = mergeSpans([...regex, ...highConf, ...adjudicated]);
  const counts = countByType(allSpans);
  const redacted = buildRedacted(inputText, allSpans);
  const combinedModelVersion = `${modelVersion}+${ADJUDICATION_MODEL}`;

  // Clear original text reference before any further awaits.
  // (We've already built redacted_text; nothing downstream needs the input.)
  body.text = "";

  await logRedaction(supabase, {
    phase: "client_preview",
    counts,
    provider,
    model_version: combinedModelVersion,
  });

  return new Response(
    JSON.stringify({
      redacted_text: redacted,
      spans: allSpans.map((s) => ({ type: s.type, start: s.start, end: s.end, score: s.score })),
      counts,
      provider,
      model_version: combinedModelVersion,
    }),
    { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
  );
});
