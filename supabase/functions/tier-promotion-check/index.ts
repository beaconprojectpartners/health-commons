// Promotes Contributing -> Core for specialists with >= 20 approved in-scope
// vocabulary edits and >= 90 days since their tier was granted.
// Designed to run periodically (cron) with the service role, but is also
// safe to invoke manually by an admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MIN_APPROVED = 20;
const MIN_DAYS = 90;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // If a JWT is present, only admins may trigger ad-hoc runs.
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

    const cutoff = new Date(Date.now() - MIN_DAYS * 86400 * 1000).toISOString();
    const { data: contributing } = await admin
      .from("specialist_tiers")
      .select("id, user_id, scope_type, scope_id, granted_at")
      .eq("tier", "contributing")
      .is("revoked_at", null)
      .lte("granted_at", cutoff);

    const promotions: Array<Record<string, unknown>> = [];
    for (const row of contributing ?? []) {
      const { count } = await admin
        .from("vocabulary_edit_log")
        .select("id", { count: "exact", head: true })
        .eq("actor_id", row.user_id)
        .eq("scope_type", row.scope_type)
        .eq("scope_id", row.scope_id)
        .in("action", ["create", "update", "approve"]);
      if ((count ?? 0) >= MIN_APPROVED) {
        const { error: upErr } = await admin
          .from("specialist_tiers")
          .update({
            tier: "core",
            granted_at: new Date().toISOString(),
            granted_reason: `auto-promotion: ${count} approved edits in scope`,
          })
          .eq("id", row.id);
        if (!upErr) {
          await admin.from("vocabulary_edit_log").insert({
            actor_id: null,
            target_type: "specialist_tier",
            target_id: row.id,
            action: "approve",
            scope_type: row.scope_type,
            scope_id: row.scope_id,
            payload: { user_id: row.user_id, promoted_to: "core", approved_edits: count },
            reason: "tier-promotion-check",
          });
          promotions.push({ tier_id: row.id, user_id: row.user_id, approved_edits: count });
        }
      }
    }

    return new Response(JSON.stringify({
      checked: contributing?.length ?? 0,
      promoted: promotions.length,
      promotions,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});