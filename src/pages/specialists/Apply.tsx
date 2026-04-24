import { useEffect, useMemo, useState } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, Search, Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

const npiSchema = z.string().regex(/^\d{10}$/, "NPI must be 10 digits");
const emailSchema = z.string().email().max(255);
const icd10Schema = z.string().regex(/^[A-TV-Z][0-9][0-9AB](?:\.[0-9A-Z]{1,4})?$/i, "Invalid ICD-10-CM code (e.g. E11.9)");

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

type Taxonomy = { code: string; desc: string; primary: boolean; state?: string; license?: string };
type LookupResult = {
  found: boolean;
  full_name?: string;
  status?: string;
  enumeration_type?: string;
  taxonomies?: Taxonomy[];
  primary_taxonomy?: Taxonomy | null;
};
type Condition = { id: string; name: string };
type ConditionRow = Condition & { icd10_code?: string | null };

const STATUSES_ACTIVE = new Set(["pending", "in_review", "approved"]);

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

  const [conditions, setConditions] = useState<Condition[]>([]);
  const [selectedConditionIds, setSelectedConditionIds] = useState<string[]>([]);
  const [conditionPickerOpen, setConditionPickerOpen] = useState(false);
  const [conditionSearch, setConditionSearch] = useState("");
  const [addingCondition, setAddingCondition] = useState(false);
  const [newConditionIcd, setNewConditionIcd] = useState("");
  const [creatingCondition, setCreatingCondition] = useState(false);

  const [appLoading, setAppLoading] = useState(true);
  const [existingApp, setExistingApp] = useState<any>(null);
  const [forceReapply, setForceReapply] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth?next=/specialists/apply");
  }, [user, loading, navigate]);

  // Load existing application for this user
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setAppLoading(true);
      const { data } = await supabase
        .from("specialist_applications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setExistingApp(data ?? null);
        setAppLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Load conditions list for multi-select
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("conditions")
        .select("id, name")
        .eq("approved", true)
        .order("name");
      if (!cancelled && data) setConditions(data as Condition[]);
    })();
    return () => { cancelled = true; };
  }, []);

  const showForm = useMemo(() => {
    if (!existingApp) return true;
    if (forceReapply) return true;
    return !STATUSES_ACTIVE.has(existingApp.status);
  }, [existingApp, forceReapply]);

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

  const toggleCondition = (id: string) => {
    setSelectedConditionIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const createCondition = async () => {
    const name = conditionSearch.trim();
    if (!name) return;
    if (name.length > 120) {
      toast({ title: "Name too long", description: "Keep it under 120 characters.", variant: "destructive" });
      return;
    }
    let icd: string | null = null;
    if (newConditionIcd.trim()) {
      const ok = icd10Schema.safeParse(newConditionIcd.trim().toUpperCase());
      if (!ok.success) {
        toast({ title: "Invalid ICD-10-CM", description: ok.error.issues[0].message, variant: "destructive" });
        return;
      }
      icd = newConditionIcd.trim().toUpperCase();
    }
    setCreatingCondition(true);
    const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase
      .from("conditions")
      .insert({ name, slug, icd10_code: icd, created_by: user?.id ?? null, approved: false })
      .select("id, name")
      .single();
    setCreatingCondition(false);
    if (error || !data) {
      toast({ title: "Could not add condition", description: error?.message ?? "Unknown error", variant: "destructive" });
      return;
    }
    setConditions((prev) => [...prev, data as Condition].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedConditionIds((prev) => [...prev, data.id]);
    setAddingCondition(false);
    setNewConditionIcd("");
    setConditionSearch("");
    toast({ title: "Condition added", description: "Pending admin approval; selected for your application." });
  };

  const submit = async () => {
    if (!user) return;
    const npiOk = npiSchema.safeParse(npi);
    const emailOk = emailSchema.safeParse(email);
    if (!npiOk.success || !emailOk.success || !lookup?.found || !primaryCode) {
      toast({ title: "Missing required fields", description: "NPI lookup, institutional email, and primary specialty are required.", variant: "destructive" });
      return;
    }
    if (selectedConditionIds.length === 0) {
      toast({ title: "Pick at least one condition", description: "Choose the diseases/conditions you'd like to cover as a specialist.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const primary = (lookup.taxonomies ?? []).find((t) => t.code === primaryCode);
    const secondary = (lookup.taxonomies ?? []).filter((t) => t.code !== primaryCode);
    const selectedConditions = conditions
      .filter((c) => selectedConditionIds.includes(c.id))
      .map((c) => ({ id: c.id, name: c.name }));

    const insertRow = {
      user_id: user.id,
      npi,
      full_name: lookup.full_name ?? null,
      institutional_email: email,
      document_url: documentUrl || null,
      primary_taxonomy: primaryCode,
      primary_taxonomy_display: primary?.desc ?? null,
      secondary_taxonomies: secondary as unknown as never,
      nppes_payload: { ...lookup, requested_conditions: selectedConditions } as unknown as never,
      decision_notes: bio || null,
      status: "pending" as const,
    };
    const { data: app, error } = await supabase.from("specialist_applications").insert(insertRow).select().single();
    setSubmitting(false);
    if (error || !app) {
      toast({ title: "Submission failed", description: error?.message ?? "Unknown error", variant: "destructive" });
      return;
    }
    toast({ title: "Application submitted", description: "A peer panel will review within 7 days." });
    navigate("/specialists");
  };

  if (loading || appLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <section className="flex-1 py-10">
        <div className="container mx-auto max-w-2xl px-4">
          <div className="mb-6 flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-primary" />
            <h1 className="font-heading text-3xl text-foreground">Apply to be a Specialist</h1>
          </div>
          <p className="mb-6 text-sm text-muted-foreground">
            Specialist is one of several independent roles. You can also be a patient and/or researcher — applying here doesn't change your other roles.
          </p>

          {existingApp && !showForm && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Your application
                  <Badge variant={existingApp.status === "approved" ? "default" : "secondary"}>{existingApp.status}</Badge>
                </CardTitle>
                <CardDescription>Submitted {new Date(existingApp.created_at).toLocaleDateString()}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {existingApp.full_name && <div><span className="text-muted-foreground">Name: </span>{existingApp.full_name}</div>}
                {existingApp.npi && <div><span className="text-muted-foreground">NPI: </span><span className="font-mono">{existingApp.npi}</span></div>}
                {existingApp.primary_taxonomy_display && <div><span className="text-muted-foreground">Primary specialty: </span>{existingApp.primary_taxonomy_display}</div>}
                {existingApp.institutional_email && <div><span className="text-muted-foreground">Email: </span>{existingApp.institutional_email}</div>}
                {(existingApp.status === "needs_info" || existingApp.status === "pending" || existingApp.status === "in_review") && (
                  <div className="mt-3 flex gap-2">
                    <Button variant="secondary" onClick={() => setForceReapply(true)}>Update & resubmit</Button>
                    {existingApp.status !== "in_review" && (
                      <Button
                        variant="outline"
                        onClick={async () => {
                          const { error } = await supabase
                            .from("specialist_applications")
                            .update({ status: "withdrawn" })
                            .eq("id", existingApp.id);
                          if (error) {
                            toast({ title: "Could not withdraw", description: error.message, variant: "destructive" });
                            return;
                          }
                          setExistingApp({ ...existingApp, status: "withdrawn" });
                          toast({ title: "Application withdrawn" });
                        }}
                      >
                        Withdraw
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {existingApp && showForm && existingApp.status && !STATUSES_ACTIVE.has(existingApp.status) && (
            <p className="mb-4 rounded-md border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
              Previous application status: <Badge variant="outline">{existingApp.status}</Badge>. You may submit a new application below.
            </p>
          )}

          {showForm && (
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
              <Label>Conditions you want to specialize in</Label>
              <Popover open={conditionPickerOpen} onOpenChange={setConditionPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    <span className="truncate text-left">
                      {selectedConditionIds.length === 0
                        ? "Select one or more conditions…"
                        : `${selectedConditionIds.length} selected`}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search or type a new condition…"
                      value={conditionSearch}
                      onValueChange={(v) => { setConditionSearch(v); setAddingCondition(false); }}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {conditionSearch.trim() ? (
                          addingCondition ? (
                            <div className="space-y-2 p-3 text-left">
                              <div className="text-sm">
                                Add <span className="font-medium text-foreground">"{conditionSearch.trim()}"</span> as a new condition.
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="new-icd" className="text-xs">ICD-10-CM code (optional)</Label>
                                <Input
                                  id="new-icd"
                                  value={newConditionIcd}
                                  onChange={(e) => setNewConditionIcd(e.target.value)}
                                  placeholder="e.g. E11.9"
                                  className="h-8"
                                />
                                <a
                                  href={`https://www.icd10data.com/search?s=${encodeURIComponent(conditionSearch.trim())}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs underline text-muted-foreground"
                                >
                                  Look up ICD-10-CM ↗
                                </a>
                              </div>
                              <div className="flex gap-2 pt-1">
                                <Button size="sm" onClick={createCondition} disabled={creatingCondition}>
                                  {creatingCondition && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Add condition
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setAddingCondition(false)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 text-left text-sm">
                              <div className="mb-2 text-muted-foreground">No matches.</div>
                              <Button size="sm" variant="secondary" onClick={() => setAddingCondition(true)}>
                                + Add "{conditionSearch.trim()}"
                              </Button>
                            </div>
                          )
                        ) : (
                          "Type to search or add a condition."
                        )}
                      </CommandEmpty>
                      <CommandGroup>
                        {conditions.map((c) => {
                          const checked = selectedConditionIds.includes(c.id);
                          return (
                            <CommandItem key={c.id} value={c.name} onSelect={() => toggleCondition(c.id)}>
                              <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                              {c.name}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedConditionIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {conditions.filter((c) => selectedConditionIds.includes(c.id)).map((c) => (
                    <Badge key={c.id} variant="secondary" className="gap-1">
                      {c.name}
                      <button type="button" onClick={() => toggleCondition(c.id)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Pick the diseases/conditions you'd like authority to curate. The panel will weigh these against your specialty.</p>
            </div>

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
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default SpecialistApply;
