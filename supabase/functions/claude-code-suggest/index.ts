// Suggest ICD-10 / SNOMED-CT codes for a redacted medical term using Claude.
// Used by moderators to triage pending_code_entries faster.
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

    // Admin or specialist only
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userData.user.id);
    const allowed = (roles || []).some((r: { role: string }) => r.role === "admin" || r.role === "specialist");
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { redacted_text, code_system_hint } = await req.json();
    if (!redacted_text || typeof redacted_text !== "string" || redacted_text.length > 1000) {
      return new Response(JSON.stringify({ error: "redacted_text required (max 1000 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = `You are a clinical coding assistant. Given a short redacted medical term, suggest 1-3 candidate codes.
Return strict JSON of shape:
{"suggestions":[{"system":"ICD-10|SNOMED-CT","code":"...","display":"...","confidence":0..1,"rationale":"..."}]}
Only use ICD-10 or SNOMED-CT. If unsure, return an empty array. No prose outside JSON.`;

    const user = `Redacted term: "${redacted_text}"${code_system_hint ? `\nPreferred system: ${code_system_hint}` : ""}`;

    const text = await callClaude({
      system,
      messages: [{ role: "user", content: user }],
      maxTokens: 600,
      temperature: 0.1,
    });

    let parsed: unknown = null;
    try {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { suggestions: [] };
    } catch {
      parsed = { suggestions: [], raw: text };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const err = e as Error & { status?: number };
    console.error("claude-code-suggest error:", err);
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