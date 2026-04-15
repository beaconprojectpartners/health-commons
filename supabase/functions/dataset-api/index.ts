import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { scrubSubmission } from "../_shared/scrub.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate API key from header
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing x-api-key header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up researcher by API key
    const { data: researcher, error: rErr } = await supabase
      .from("researchers")
      .select("id, user_id, revoked_at")
      .eq("api_key", apiKey)
      .single();

    if (rErr || !researcher) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (researcher.revoked_at) {
      return new Response(
        JSON.stringify({ error: "API key has been revoked" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check active subscription
    const { data: hasSub } = await supabase.rpc("has_active_subscription", {
      user_uuid: researcher.user_id,
      check_env: "sandbox", // Switch to "live" for production
    });

    if (!hasSub) {
      return new Response(
        JSON.stringify({ error: "Active subscription required. Visit CrowdDx to subscribe." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse query params
    const url = new URL(req.url);
    const conditionSlug = url.searchParams.get("condition");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Build query
    let query = supabase
      .from("submissions")
      .select("id, condition_id, universal_fields, dynamic_fields, submitted_at, conditions!inner(name, slug)")
      .order("submitted_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (conditionSlug) {
      query = query.eq("conditions.slug", conditionSlug);
    }

    const { data: submissions, error: sErr } = await query;

    if (sErr) {
      console.error("Query error:", sErr);
      return new Response(
        JSON.stringify({ error: "Failed to fetch data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Scrub PII from all submissions
    const scrubbed = (submissions || []).map((s: any) => scrubSubmission(s));

    // Log usage
    await supabase.from("api_usage").insert({
      researcher_id: researcher.id,
      endpoint: "/dataset-api",
      response_rows: scrubbed.length,
    });

    return new Response(
      JSON.stringify({
        data: scrubbed,
        meta: { count: scrubbed.length, offset, limit },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("API error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
