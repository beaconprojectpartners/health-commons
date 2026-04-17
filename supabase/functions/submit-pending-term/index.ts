/**
 * submit-pending-term — final-enforcement endpoint for "Add new" medical terms.
 *
 * Steps:
 *   1. Auth required (sign-in only).
 *   2. Per-user + per-IP rate limit check (cost control + threshold gaming).
 *   3. Server-side re-scrub via scrub-phi (defense in depth — never trusts
 *      client-provided redactions).
 *   4. Tries an exact alias match — if a strong match exists, returns
 *      { matched: true, code } so the UI can confirm with the user.
 *   5. Otherwise upserts a pending_code_entries row (keyed on
 *      redacted_text + kind + code_system_hint) and inserts a
 *      pending_term_occurrences row.
 *   6. If distinct submitter count >= 3 OR via=specialist|report,
 *      ensures a moderation_queue_items row exists (idempotent).
 *
 * NEVER stores the original input text; only the redacted form.
 * Returns { status, stored_redacted_text?, match?, redactions_applied }.
 */
import { corsHeaders } from "npm:@supabase/supabase-js/cors";
import { createClient } from "npm:@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const HOURLY_LIMIT_PER_USER = 30;
const DAILY_LIMIT_PER_USER = 200;
const HOURLY_LIMIT_PER_IP = 60;
const THRESHOLD_DISTINCT_SUBMITTERS = 3;

interface ScrubResponse {
  redacted_text: string;
  spans: Array<{ type: string; start: number; end: number; score: number }>;
  counts: Record<string, number>;
  provider: string;
  model_version: string;
}

async function checkAndIncrementBucket(
  supabase: ReturnType<typeof createClient>,
  bucket_kind: "user" | "ip",
  bucket_key: string,
  window_kind: "hour" | "day",
  limit: number,
): Promise<{ ok: boolean; count: number }> {
  const now = new Date();
  const ws = new Date(now);
  if (window_kind === "hour") ws.setMinutes(0, 0, 0);
  else ws.setHours(0, 0, 0, 0);
  const window_start = ws.toISOString();

  const { data: existing } = await supabase
    .from("submission_rate_buckets")
    .select("id, count")
    .eq("bucket_kind", bucket_kind)
    .eq("bucket_key", bucket_key)
    .eq("window_kind", window_kind)
    .eq("window_start", window_start)
    .maybeSingle();

  const current = (existing?.count as number) ?? 0;
  if (current >= limit) return { ok: false, count: current };

  if (existing) {
    await supabase
      .from("submission_rate_buckets")
      .update({ count: current + 1 })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("submission_rate_buckets")
      .insert({ bucket_kind, bucket_key, window_kind, window_start, count: 1 });
  }
  return { ok: true, count: current + 1 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // --- Auth check (sign-in required for free-text submissions) ---
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "auth_required" }), {
      status: 401, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: userRes } = await userClient.auth.getUser();
  const user = userRes?.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "auth_required" }), {
      status: 401, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  let body: { text?: unknown; kind?: unknown; code_system_hint?: unknown; via?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
  let inputText = typeof body.text === "string" ? body.text : "";
  const kind = typeof body.kind === "string" ? body.kind : "symptom";
  const code_system_hint = typeof body.code_system_hint === "string" ? body.code_system_hint : null;
  const via = (typeof body.via === "string" ? body.via : "threshold") as
    "threshold" | "specialist_suggestion" | "content_report";

  if (!inputText || inputText.length < 2 || inputText.length > 500) {
    return new Response(JSON.stringify({ error: "text_required_or_too_long" }), {
      status: 400, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // --- Rate limiting ---
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const userHour = await checkAndIncrementBucket(admin, "user", user.id, "hour", HOURLY_LIMIT_PER_USER);
  if (!userHour.ok) {
    return new Response(JSON.stringify({ error: "rate_limited", scope: "user_hour" }), {
      status: 429, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
  const userDay = await checkAndIncrementBucket(admin, "user", user.id, "day", DAILY_LIMIT_PER_USER);
  if (!userDay.ok) {
    return new Response(JSON.stringify({ error: "rate_limited", scope: "user_day" }), {
      status: 429, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
  if (ip !== "unknown") {
    const ipHour = await checkAndIncrementBucket(admin, "ip", ip, "hour", HOURLY_LIMIT_PER_IP);
    if (!ipHour.ok) {
      return new Response(JSON.stringify({ error: "rate_limited", scope: "ip_hour" }), {
        status: 429, headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }

  // --- Server-side re-scrub (final enforcement; ignores any client-side redaction) ---
  const scrubRes = await fetch(`${SUPABASE_URL}/functions/v1/scrub-phi`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ text: inputText }),
  });
  if (!scrubRes.ok) {
    await scrubRes.text().catch(() => "");
    return new Response(
      JSON.stringify({ error: "phi_detector_unavailable" }),
      { status: 503, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }
  const scrub: ScrubResponse = await scrubRes.json();
  const redacted_text = scrub.redacted_text;
  const counts = scrub.counts;

  // Reject if hard-PHI types still appear after scrub.
  const hardPhi = ["EMAIL", "PHONE", "ID"];
  const hardLeak = hardPhi.some((t) => (counts[t] ?? 0) > 0);
  if (hardLeak) {
    inputText = "";
    return new Response(
      JSON.stringify({
        status: "rejected_phi",
        redactions_applied: counts,
        message: "Submission contains contact info or identifiers and cannot be saved.",
      }),
      { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }

  // Clear original text reference; only the redacted form survives from here.
  inputText = "";

  // --- Try exact alias match (Phase 2b: lexical; future: vector). ---
  const matchPattern = redacted_text.trim();
  const { data: aliasMatch } = await admin
    .from("code_aliases")
    .select("id, label, medical_codes!inner(id, code, code_system, display)")
    .eq("status", "approved")
    .ilike("label", matchPattern)
    .limit(1)
    .maybeSingle();

  if (aliasMatch) {
    const mc = (aliasMatch as unknown as { medical_codes: { id: string; code: string; code_system: string; display: string } }).medical_codes;
    return new Response(
      JSON.stringify({
        status: "matched",
        match: {
          code_id: mc.id,
          code: mc.code,
          code_system: mc.code_system,
          display: mc.display,
          alias_id: aliasMatch.id,
          alias_used: aliasMatch.label,
          score: 0.95,
        },
        stored_redacted_text: redacted_text,
        redactions_applied: counts,
      }),
      { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }

  // --- Upsert pending_code_entries (idempotent on redacted_text + hint) ---
  let pendingId: string | null = null;
  const { data: existingPending } = await admin
    .from("pending_code_entries")
    .select("id")
    .eq("redacted_text", redacted_text)
    .eq("code_system_hint", code_system_hint ?? "")
    .maybeSingle();

  if (existingPending) {
    pendingId = existingPending.id as string;
  } else {
    const { data: inserted, error } = await admin
      .from("pending_code_entries")
      .insert({
        redacted_text,
        code_system_hint,
        submitter_id: user.id,
      })
      .select("id")
      .single();
    if (error) {
      return new Response(JSON.stringify({ error: "pending_insert_failed", detail: error.message }), {
        status: 500, headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    pendingId = inserted!.id as string;
  }

  // --- Insert occurrence (UNIQUE on (pending, submitter)) ---
  await admin.from("pending_term_occurrences").insert({
    pending_code_entry_id: pendingId,
    submitter_id: user.id,
  });

  // --- Threshold check ---
  const { count: distinctCount } = await admin
    .from("pending_term_occurrences")
    .select("submitter_id", { count: "exact", head: true })
    .eq("pending_code_entry_id", pendingId);

  const shouldQueue =
    via === "specialist_suggestion" ||
    via === "content_report" ||
    (distinctCount ?? 0) >= THRESHOLD_DISTINCT_SUBMITTERS;

  if (shouldQueue) {
    const priority = via === "content_report" ? 20 : via === "specialist_suggestion" ? 10 : 0;
    await admin.from("moderation_queue_items").insert({
      pending_code_entry_id: pendingId,
      source: via,
      priority,
      status: "awaiting",
    }).select().maybeSingle().then(() => {/* ignore unique conflict */});
  }

  return new Response(
    JSON.stringify({
      status: "stored",
      stored_redacted_text: redacted_text,
      redactions_applied: counts,
      pending_code_entry_id: pendingId,
      occurrences: distinctCount ?? 0,
      queued: shouldQueue,
    }),
    { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
  );
});
