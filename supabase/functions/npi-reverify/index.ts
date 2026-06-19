// Re-verifies approved specialists' NPI against the NPPES registry.
// Logs every check to npi_reverification_log; flags taxonomy drift and
// inactive status. Intended to run on a 90-day cron; safe to invoke
// ad-hoc by an admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_PER_RUN = 100;
const MIN_INTERVAL_DAYS = 90;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: roleRow } = await admin
          .from("user_roles").select("role")
          .eq("user_id", user.id).eq("role", "admin").maybeSingle();
        if (!roleRow) {
          return new Response(JSON.stringify({ error: "admins only" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const { data: apps } = await admin
      .from("specialist_applications")
      .select("user_id, npi, primary_taxonomy")
      .eq("status", "approved")
      .not("npi", "is", null)
      .limit(MAX_PER_RUN);

    // Skip those checked within MIN_INTERVAL_DAYS
    const since = new Date(Date.now() - MIN_INTERVAL_DAYS * 86400 * 1000).toISOString();
    const { data: recent } = await admin
      .from("npi_reverification_log")
      .select("user_id, checked_at")
      .gte("checked_at", since);
    const recentlyChecked = new Set((recent ?? []).map((r) => r.user_id));

    const results: Array<Record<string, unknown>> = [];
    for (const a of apps ?? []) {
      if (!a.npi || recentlyChecked.has(a.user_id)) continue;
      let status = "unknown";
      let drift = false;
      let payload: Record<string, unknown> | null = null;
      try {
        const r = await fetch(
          `https://npiregistry.cms.hhs.gov/api/?version=2.1&number=${a.npi}`,
        );
        const data = await r.json();
        const result = (data?.results ?? [])[0];
        if (!result) {
          status = "not_found";
        } else {
          const basic = result.basic ?? {};
          const taxonomies = (result.taxonomies ?? []) as Array<{ code: string; primary: boolean }>;
          const primary = taxonomies.find((t) => t.primary) ?? taxonomies[0] ?? null;
          status = basic.status === "A" ? "active" : (basic.status ?? "unknown");
          drift = !!(a.primary_taxonomy && primary && primary.code !== a.primary_taxonomy);
          payload = { basic, primary, taxonomies };
        }
      } catch (e) {
        status = `error: ${(e as Error).message.slice(0, 120)}`;
      }

      await admin.from("npi_reverification_log").insert({
        user_id: a.user_id,
        npi: a.npi,
        status,
        taxonomy_drift: drift,
        payload,
      });
      results.push({ user_id: a.user_id, npi: a.npi, status, taxonomy_drift: drift });
    }

    return new Response(JSON.stringify({
      considered: apps?.length ?? 0,
      checked: results.length,
      results,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});