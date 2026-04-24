// Draft a disease_profiles JSON skeleton (criteria, labs, imaging, scoring_tools)
// for a given condition, to help specialists author new profiles.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.1";
import { callClaude } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey =
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userData.user.id);
    const allowed = (roles || []).some((r: { role: string }) => r.role === "admin" || r.role === "specialist");
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { condition_name, icd10_code, notes } = await req.json();
    if (!condition_name || typeof condition_name !== "string" || condition_name.length > 200) {
      return new Response(JSON.stringify({ error: "condition_name required (max 200 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = `You are a clinical knowledge author drafting a disease profile for the DxCommons platform.
Return STRICT JSON only, matching this shape:
{
  "criteria": [{"name":"...", "description":"...", "source":"..."}],
  "labs":     [{"name":"...", "typical_range":"...", "rationale":"..."}],
  "imaging":  [{"modality":"...", "findings":"...", "rationale":"..."}],
  "scoring_tools":[{"name":"...", "use":"...", "reference":"..."}],
  "citation": "Concise free-text citation hint (guideline name + year)."
}
Use widely-accepted clinical guidelines (e.g. ACR, NICE, AAN). Mark uncertainty in rationale. No prose outside JSON.`;

    const user = `Condition: ${condition_name}${icd10_code ? ` (ICD-10 ${icd10_code})` : ""}${notes ? `\nAuthor notes: ${notes}` : ""}`;

    const text = await callClaude({
      system,
      messages: [{ role: "user", content: user }],
      maxTokens: 1500,
      temperature: 0.2,
    });

    let parsed: unknown = null;
    try {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    } catch {
      parsed = null;
    }
    if (!parsed) {
      return new Response(JSON.stringify({ error: "Model did not return valid JSON", raw: text }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ draft: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const err = e as Error & { status?: number };
    console.error("claude-profile-draft error:", err);
    if (err.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: err.message ?? "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});