import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

// Tallies votes on a panel; if 2-of-3 approve with no needs_info, approves the application,
// grants 'specialist' role + 'contributing' tier for the primary taxonomy.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { panel_id } = await req.json();
    if (!panel_id) return new Response(JSON.stringify({ error: "panel_id required" }), { status: 400, headers: corsHeaders });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "admins only" }), { status: 403, headers: corsHeaders });

    const { data: panel } = await admin.from("vetting_panels").select("*, specialist_applications(*)").eq("id", panel_id).single();
    if (!panel) throw new Error("panel not found");
    const { data: votes } = await admin.from("vetting_panel_votes").select("vote").eq("panel_id", panel_id);
    const v = votes ?? [];
    const approves = v.filter((x) => x.vote === "approve").length;
    const rejects = v.filter((x) => x.vote === "reject").length;
    const needs = v.filter((x) => x.vote === "needs_info").length;

    let outcome: "approve" | "reject" | "needs_info" | null = null;
    if (needs > 0) outcome = "needs_info";
    else if (approves >= 2) outcome = "approve";
    else if (rejects >= 2) outcome = "reject";
    if (!outcome) return new Response(JSON.stringify({ outcome: null, message: "not enough votes" }), { headers: corsHeaders });

    await admin.from("vetting_panels").update({ outcome, closed_at: new Date().toISOString() }).eq("id", panel_id);

    const app = panel.specialist_applications as { id: string; user_id: string; primary_taxonomy: string | null; nppes_payload: any };
    const newStatus = outcome === "approve" ? "approved" : outcome === "reject" ? "rejected" : "needs_info";
    await admin.from("specialist_applications").update({
      status: newStatus, decided_by: user.id, decided_at: new Date().toISOString(),
    }).eq("id", app.id);

    if (outcome === "approve") {
      await admin.from("user_roles").upsert({ user_id: app.user_id, role: "specialist" }, { onConflict: "user_id,role", ignoreDuplicates: true });
      if (app.primary_taxonomy) {
        await admin.from("specialist_tiers").upsert({
          user_id: app.user_id, scope_type: "specialty", scope_id: app.primary_taxonomy,
          tier: "contributing", granted_by: user.id, granted_reason: "panel-approved application",
        }, { onConflict: "user_id,scope_type,scope_id", ignoreDuplicates: true });
      }
      // Approve the conditions this specialist requested so patients/researchers can select them.
      const requested = (app.nppes_payload?.requested_conditions ?? []) as Array<{ id?: string }>;
      const conditionIds = Array.isArray(requested)
        ? requested.map((c) => c?.id).filter((x): x is string => typeof x === "string")
        : [];
      if (conditionIds.length > 0) {
        await admin.from("conditions").update({ approved: true }).in("id", conditionIds);
      }
    }

    return new Response(JSON.stringify({ outcome, status: newStatus }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});