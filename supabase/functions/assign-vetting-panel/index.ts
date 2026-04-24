import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { application_id } = await req.json();
    if (!application_id) {
      return new Response(JSON.stringify({ error: "application_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    // Verify caller is admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "admins only" }), { status: 403, headers: corsHeaders });

    const { data: app, error: appErr } = await admin.from("specialist_applications").select("*").eq("id", application_id).single();
    if (appErr || !app) throw appErr ?? new Error("application not found");

    // Find existing specialists, prefer ones who haven't served recently
    const { data: specialistRoles } = await admin.from("user_roles").select("user_id").eq("role", "specialist");
    const candidates = (specialistRoles ?? []).map((r) => r.user_id).filter((id) => id !== app.user_id);

    let panelMembers: string[] = [];
    if (candidates.length === 0) {
      // Phase 0: founder/admin acts as panel-of-1
      panelMembers = [user.id];
    } else {
      // Recency weighting: count recent panel service in last 30 days
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await admin.from("vetting_panel_members").select("user_id, invited_at").gte("invited_at", since);
      const recentCounts = new Map<string, number>();
      (recent ?? []).forEach((r) => recentCounts.set(r.user_id, (recentCounts.get(r.user_id) ?? 0) + 1));
      const sorted = candidates.sort((a, b) => (recentCounts.get(a) ?? 0) - (recentCounts.get(b) ?? 0));
      panelMembers = sorted.slice(0, Math.min(3, sorted.length));
    }

    const { data: panel, error: panelErr } = await admin.from("vetting_panels").insert({ application_id }).select().single();
    if (panelErr) throw panelErr;

    const memberRows = panelMembers.map((uid) => ({ panel_id: panel.id, user_id: uid }));
    if (memberRows.length) {
      const { error: mErr } = await admin.from("vetting_panel_members").insert(memberRows);
      if (mErr) throw mErr;
    }
    await admin.from("specialist_applications").update({ status: "in_review" }).eq("id", application_id);

    return new Response(JSON.stringify({ panel_id: panel.id, members: panelMembers }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});