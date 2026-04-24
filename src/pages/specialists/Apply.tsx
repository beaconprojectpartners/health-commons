import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, Search } from "lucide-react";

const npiSchema = z.string().regex(/^\d{10}$/, "NPI must be 10 digits");
const emailSchema = z.string().email().max(255);

type Taxonomy = { code: string; desc: string; primary: boolean; state?: string; license?: string };
type LookupResult = {
  found: boolean;
  full_name?: string;
  status?: string;
  enumeration_type?: string;
  taxonomies?: Taxonomy[];
  primary_taxonomy?: Taxonomy | null;
};

const SpecialistApply = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [npi, setNpi] = useState("");
  const [email, setEmail] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [bio, setBio] = useState("");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [primaryCode, setPrimaryCode] = useState<string>("");
  const [looking, setLooking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth?next=/specialists/apply");
  }, [user, loading, navigate]);

  const lookupNpi = async () => {
    const parsed = npiSchema.safeParse(npi);
    if (!parsed.success) {
      toast({ title: "Invalid NPI", description: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    setLooking(true);
    setLookup(null);
    const { data, error } = await supabase.functions.invoke("nppes-lookup", { body: { npi } });
    setLooking(false);
    if (error) {
      toast({ title: "Lookup failed", description: error.message, variant: "destructive" });
      return;
    }
    const res = data as LookupResult;
    setLookup(res);
    if (res.enumeration_type && res.enumeration_type !== "NPI-1") {
      toast({ title: "Individual NPI required", description: "Organizational NPIs (NPI-2) are not eligible.", variant: "destructive" });
    }
    if (res.primary_taxonomy) setPrimaryCode(res.primary_taxonomy.code);
  };

  const submit = async () => {
    if (!user) return;
    const npiOk = npiSchema.safeParse(npi);
    const emailOk = emailSchema.safeParse(email);
    if (!npiOk.success || !emailOk.success || !lookup?.found || !primaryCode) {
      toast({ title: "Missing required fields", description: "NPI lookup, institutional email, and primary specialty are required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const primary = (lookup.taxonomies ?? []).find((t) => t.code === primaryCode);
    const secondary = (lookup.taxonomies ?? []).filter((t) => t.code !== primaryCode);
    const { data: app, error } = await supabase.from("specialist_applications").insert({
      user_id: user.id,
      npi,
      full_name: lookup.full_name ?? null,
      institutional_email: email,
      document_url: documentUrl || null,
      primary_taxonomy: primaryCode,
      primary_taxonomy_display: primary?.desc ?? null,
      secondary_taxonomies: secondary,
      nppes_payload: lookup as unknown as Record<string, unknown>,
      decision_notes: bio || null,
      status: "pending",
    }).select().single();
    setSubmitting(false);
    if (error || !app) {
      toast({ title: "Submission failed", description: error?.message ?? "Unknown error", variant: "destructive" });
      return;
    }
    toast({ title: "Application submitted", description: "A peer panel will review within 7 days." });
    navigate("/specialists");
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <section className="flex-1 py-10">
        <div className="container mx-auto max-w-2xl px-4">
          <div className="mb-6 flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-primary" />
            <h1 className="font-heading text-3xl text-foreground">Apply to be a Specialist</h1>
          </div>
          <p className="mb-8 text-sm text-muted-foreground">
            Verification uses NPPES (the public federal NPI registry) plus your institutional email and credentialing document.
            A randomly assigned panel of three existing specialists reviews each application within 7 days. Approval requires 2-of-3 votes.
          </p>

          <div className="space-y-6 rounded-lg border border-border bg-card p-6">
            <div className="space-y-2">
              <Label htmlFor="npi">National Provider Identifier (NPI)</Label>
              <div className="flex gap-2">
                <Input id="npi" inputMode="numeric" maxLength={10} value={npi} onChange={(e) => setNpi(e.target.value.replace(/\D/g, ""))} placeholder="10-digit NPI" />
                <Button type="button" variant="secondary" onClick={lookupNpi} disabled={looking}>
                  {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Find your NPI at <a className="underline" href="https://npiregistry.cms.hhs.gov/" target="_blank" rel="noreferrer">npiregistry.cms.hhs.gov</a></p>
            </div>

            {lookup && lookup.found && (
              <div className="rounded-md border border-border bg-secondary/40 p-4 text-sm">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-foreground font-medium">{lookup.full_name}</span>
                  <Badge variant="outline">{lookup.enumeration_type}</Badge>
                  <Badge variant={lookup.status === "A" ? "default" : "destructive"}>{lookup.status === "A" ? "Active" : lookup.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mb-2">Confirm primary specialty:</div>
                <div className="space-y-1.5">
                  {(lookup.taxonomies ?? []).map((t) => (
                    <label key={t.code} className="flex items-start gap-2 cursor-pointer">
                      <input type="radio" name="primaryTax" value={t.code} checked={primaryCode === t.code} onChange={() => setPrimaryCode(t.code)} className="mt-1" />
                      <span className="text-sm"><span className="font-medium text-foreground">{t.desc}</span> <span className="text-muted-foreground">({t.code}{t.state ? ` · ${t.state}` : ""})</span></span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {lookup && !lookup.found && <p className="text-sm text-destructive">No NPI record found.</p>}

            <div className="space-y-2">
              <Label htmlFor="email">Institutional email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@hospital.org" />
              <p className="text-xs text-muted-foreground">Personal email domains (gmail, yahoo, etc.) will be flagged for additional review.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc">Credential document URL (optional)</Label>
              <Input id="doc" value={documentUrl} onChange={(e) => setDocumentUrl(e.target.value)} placeholder="https://… (board cert, license, ID badge)" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Statement to the panel</Label>
              <Textarea id="bio" rows={4} maxLength={1000} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Briefly describe your scope of practice and why you'd like to contribute." />
            </div>

            <Button onClick={submit} disabled={submitting} className="w-full">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit application
            </Button>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default SpecialistApply;