import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.1";
import { streamClaudeAsOpenAISSE } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // Require an authenticated user — validate the JWT server-side
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey =
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const sb = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.length > 500) {
      return new Response(
        JSON.stringify({ error: "Please provide a search query (max 500 chars)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: conditions } = await sb
      .from("conditions")
      .select("name, slug, submission_count, icd10_code")
      .eq("approved", true)
      .order("name");

    const conditionContext = (conditions || [])
      .map((c: any) => `- ${c.name} (ICD-10: ${c.icd10_code || "N/A"}, ${c.submission_count || 0} submissions, slug: ${c.slug})`)
      .join("\n");

    const systemPrompt = `You are DxCommons Dataset Assistant, helping researchers find relevant patient-reported data in the DxCommons open dataset.

AVAILABLE CONDITIONS:
${conditionContext}

DATA SCHEMA (per submission):
- condition_id: UUID linking to a condition
- universal_fields (JSONB):
  - diagnosis_status: confirmed | suspected | self-diagnosed | ruled-out
  - year_of_diagnosis: string
  - time_to_diagnosis: <6months | 6-12months | 1-3years | 3-5years | 5-10years | 10+years
  - providers_count: number of providers seen before diagnosis
  - misdiagnoses: comma-separated list
  - symptoms[]: { name, severity (1-10), frequency (constant|daily|weekly|episodic|intermittent), bodySystem }
  - treatments[]: { name, type (pharmaceutical|surgical|physical-therapy|dietary|supplement|lifestyle|other), effectiveness (1-10), sideEffects }
  - demographics: { age_range, biological_sex, country }
  - quality_of_life: { work_impact, pain_avg (1-10), fatigue_avg (1-10), mental_health_impact (1-10) }
  - submitter_type: patient | caregiver
- sharing_preference: anonymized_public | research_only | private
- submitted_at: timestamp

IMPORTANT DISCLAIMERS (include in every response):
- DxCommons is NOT a healthcare provider and does not diagnose conditions.
- All data is patient-reported and self-selected; it is NOT a representative clinical sample.
- Data should be used at the researcher's discretion with appropriate statistical caveats.
- Submissions may contain inaccuracies, duplicates, or biased reporting.

Help the researcher by:
1. Identifying which conditions/data fields are relevant to their question
2. Suggesting filter strategies (by condition, symptom, demographics, etc.)
3. Noting dataset limitations relevant to their specific research question
4. Providing the schema fields they'd need to query

Be concise and scientific in tone.`;

    try {
      const claudeResp = await streamClaudeAsOpenAISSE({
        system: systemPrompt,
        messages: [{ role: "user", content: query }],
        maxTokens: 1024,
      });
      return new Response(claudeResp.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    } catch (err) {
      const e = err as Error & { status?: number };
      console.error("Claude error:", e);
      if (e.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (e.status === 402 || e.status === 401) {
        return new Response(
          JSON.stringify({ error: "AI service temporarily unavailable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    console.error("dataset-search error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
