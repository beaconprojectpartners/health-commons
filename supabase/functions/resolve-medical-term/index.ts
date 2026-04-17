/**
 * resolve-medical-term — embedding similarity search over medical_codes
 * and code_aliases. Returns the top 5 candidates with confidence scores.
 *
 * Phase 2b: this is a stub that does lexical (ILIKE) matching only, since
 * the embedding columns are not yet populated. The interface is the final
 * one — once embeddings are seeded, swap the search SQL inside `search()`
 * for a vector cosine query without changing the response shape.
 */
import { corsHeaders } from "npm:@supabase/supabase-js/cors";
import { createClient } from "npm:@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Candidate {
  source: "code" | "alias";
  code_id: string;
  alias_id?: string;
  display: string;
  code: string;
  code_system: string;
  score: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let body: { text?: unknown; kind?: unknown; code_system_hint?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const kind = typeof body.kind === "string" ? body.kind : null;
  const hint = typeof body.code_system_hint === "string" ? body.code_system_hint : null;

  if (!text || text.length < 2 || text.length > 200) {
    return new Response(JSON.stringify({ candidates: [] }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // Lexical search (Phase 2b stub). Future: pgvector cosine on embeddings.
  const pattern = `%${text.replace(/[%_]/g, "")}%`;

  let codeQuery = supabase
    .from("medical_codes")
    .select("id, code, code_system, display, kind")
    .ilike("display", pattern)
    .is("retired_at", null)
    .limit(10);
  if (kind) codeQuery = codeQuery.eq("kind", kind);
  if (hint) codeQuery = codeQuery.eq("code_system", hint);

  const aliasQuery = supabase
    .from("code_aliases")
    .select("id, label, medical_code_id, status, medical_codes!inner(id, code, code_system, display, kind)")
    .eq("status", "approved")
    .ilike("label", pattern)
    .limit(10);

  const [codeRes, aliasRes] = await Promise.all([codeQuery, aliasQuery]);

  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  const lower = text.toLowerCase();
  const scoreLex = (haystack: string): number => {
    const h = haystack.toLowerCase();
    if (h === lower) return 0.99;
    if (h.startsWith(lower)) return 0.85;
    if (h.includes(lower)) return 0.7;
    return 0.55;
  };

  for (const r of codeRes.data ?? []) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    candidates.push({
      source: "code",
      code_id: r.id,
      display: r.display,
      code: r.code,
      code_system: r.code_system,
      score: scoreLex(r.display),
    });
  }
  for (const r of aliasRes.data ?? []) {
    const mc = (r as unknown as { medical_codes: { id: string; code: string; code_system: string; display: string } }).medical_codes;
    if (seen.has(mc.id)) continue;
    seen.add(mc.id);
    candidates.push({
      source: "alias",
      code_id: mc.id,
      alias_id: r.id,
      display: mc.display,
      code: mc.code,
      code_system: mc.code_system,
      score: scoreLex(r.label),
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  return new Response(JSON.stringify({ candidates: candidates.slice(0, 5) }), {
    status: 200,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
