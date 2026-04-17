/**
 * report-phi — any authenticated user can flag a queue item that still
 * contains PHI. Runs scrub-phi on the stored redacted_text (defense in
 * depth — catches model regressions); if new spans are found, updates the
 * pending entry to the newer redaction and writes a redaction_log row with
 * phase='review_rescrub'.
 */
import { corsHeaders } from "npm:@supabase/supabase-js/cors";
import { createClient } from "npm:@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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

  let body: { moderation_queue_item_id?: unknown; reason?: unknown };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
  const itemId = typeof body.moderation_queue_item_id === "string" ? body.moderation_queue_item_id : "";
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : "";
  if (!itemId || !reason) {
    return new Response(JSON.stringify({ error: "missing_fields" }), {
      status: 400, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const { data: queueItem } = await admin
    .from("moderation_queue_items")
    .select("id, pending_code_entry_id, pending_code_entries!inner(id, redacted_text)")
    .eq("id", itemId)
    .maybeSingle();

  if (!queueItem) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
  const pe = (queueItem as unknown as { pending_code_entries: { id: string; redacted_text: string } }).pending_code_entries;

  // Re-scrub
  const scrubRes = await fetch(`${SUPABASE_URL}/functions/v1/scrub-phi`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ text: pe.redacted_text }),
  });
  let newRedacted = pe.redacted_text;
  let counts: Record<string, number> = {};
  let provider = "aws_comprehend_medical";
  let model_version = "unknown";
  if (scrubRes.ok) {
    const scrub = await scrubRes.json();
    newRedacted = scrub.redacted_text;
    counts = scrub.counts;
    provider = scrub.provider;
    model_version = scrub.model_version;
  }

  if (newRedacted !== pe.redacted_text) {
    await admin
      .from("pending_code_entries")
      .update({ redacted_text: newRedacted })
      .eq("id", pe.id);
  }

  await admin.from("redaction_log").insert({
    pending_code_entry_id: pe.id,
    moderation_queue_item_id: itemId,
    phase: "review_rescrub",
    counts,
    provider,
    model_version,
  });

  await admin.from("phi_reports").insert({
    moderation_queue_item_id: itemId,
    reporter_id: user.id,
    reason,
  });

  return new Response(
    JSON.stringify({
      status: "reported",
      rescrub_changed: newRedacted !== pe.redacted_text,
      redactions_applied: counts,
    }),
    { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
  );
});
