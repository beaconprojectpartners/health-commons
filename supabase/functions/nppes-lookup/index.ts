import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    let npi = url.searchParams.get("npi");
    if (!npi && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      npi = body?.npi ?? null;
    }
    if (!npi || !/^\d{10}$/.test(npi)) {
      return new Response(JSON.stringify({ error: "npi must be a 10-digit number" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const r = await fetch(`https://npiregistry.cms.hhs.gov/api/?version=2.1&number=${npi}`);
    if (!r.ok) {
      return new Response(JSON.stringify({ error: "NPPES lookup failed", status: r.status }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await r.json();
    const result = (data?.results ?? [])[0];
    if (!result) {
      return new Response(JSON.stringify({ found: false }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const basic = result.basic ?? {};
    const taxonomies = (result.taxonomies ?? []).map((t: Record<string, unknown>) => ({
      code: t.code,
      desc: t.desc,
      primary: t.primary,
      state: t.state,
      license: t.license,
    }));
    const primary = taxonomies.find((t: { primary: boolean }) => t.primary) ?? taxonomies[0] ?? null;
    return new Response(JSON.stringify({
      found: true,
      npi,
      enumeration_type: result.enumeration_type, // NPI-1 individual / NPI-2 org
      status: basic.status ?? "A",
      full_name: [basic.first_name, basic.middle_name, basic.last_name].filter(Boolean).join(" "),
      credential: basic.credential ?? null,
      gender: basic.gender ?? null,
      sole_proprietor: basic.sole_proprietor ?? null,
      enumeration_date: basic.enumeration_date ?? null,
      last_updated: basic.last_updated ?? null,
      taxonomies,
      primary_taxonomy: primary,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});