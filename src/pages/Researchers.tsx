import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DatasetSearch from "@/components/DatasetSearch";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Database, Download, Filter, Key, AlertTriangle, FileJson, Shield, Lock, CreditCard, Zap, Star, Trash2, UserCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const features = [
  { icon: Filter, title: "Advanced Filters", desc: "Filter by condition, symptom, treatment, lab result, region, and more." },
  { icon: Download, title: "CSV & JSON Export", desc: "Download filtered datasets with full data dictionaries included." },
  { icon: Key, title: "API Access", desc: "Programmatic access with your API key. Subscription required for API use." },
  { icon: Database, title: "Free Downloads", desc: "Download filtered datasets for free. API access requires a subscription." },
];

const schemaFields = [
  { field: "condition_id", type: "UUID", desc: "Links to a condition (e.g. Lupus, EDS, POTS)" },
  { field: "diagnosis_status", type: "enum", desc: "confirmed | suspected | self-diagnosed | ruled-out" },
  { field: "year_of_diagnosis", type: "string", desc: "Year the diagnosis was made" },
  { field: "time_to_diagnosis", type: "enum", desc: "<6months | 6-12months | 1-3years | 3-5years | 5-10years | 10+years" },
  { field: "providers_count", type: "number", desc: "Number of providers seen before diagnosis" },
  { field: "misdiagnoses", type: "text", desc: "Comma-separated list of prior misdiagnoses" },
  { field: "symptoms[]", type: "array", desc: "name, severity (1-10), frequency, bodySystem" },
  { field: "treatments[]", type: "array", desc: "name, type, effectiveness (1-10), sideEffects" },
  { field: "demographics", type: "object", desc: "age_range, biological_sex, country" },
  { field: "quality_of_life", type: "object", desc: "work_impact, pain_avg, fatigue_avg, mental_health_impact (all 1-10)" },
  { field: "submitter_type", type: "enum", desc: "patient | caregiver" },
  { field: "sharing_preference", type: "enum", desc: "anonymized_public | research_only | private" },
  { field: "submitted_at", type: "timestamp", desc: "UTC timestamp of submission" },
];

const SignInGate = ({ children, label }: { children: React.ReactNode; label: string }) => {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center shadow-card">
        <Lock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h3 className="mb-2 font-heading text-lg text-foreground">Sign in required</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Create a free account to access {label}.
        </p>
        <Link to="/auth?role=researcher">
          <Button>Sign In or Register</Button>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
};

// Hook: fetch researcher record for current user
const useResearcher = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["researcher-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("researchers")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
};

// Registration form shown when signed in but not yet a researcher
const ResearcherRegistrationForm = ({ onRegistered }: { onRegistered: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [orcid, setOrcid] = useState("");
  const [researchFocus, setResearchFocus] = useState("");
  const [intendedUse, setIntendedUse] = useState("");
  const [agreed, setAgreed] = useState(false);

  const register = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("researchers").insert({
        user_id: user!.id,
        name: name.trim(),
        institution: institution.trim() || null,
        orcid: orcid.trim() || null,
        research_focus: researchFocus.trim() || null,
        intended_use: intendedUse.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["researcher-profile"] });
      toast({ title: "Welcome, researcher!", description: "Your researcher profile is active." });
      onRegistered();
    },
    onError: (err: any) => {
      toast({ title: "Could not register", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-card">
      <div className="mb-5 flex items-start gap-3">
        <UserCheck className="mt-0.5 h-6 w-6 text-blue-500" />
        <div>
          <h3 className="font-heading text-lg text-foreground">Register as a Researcher</h3>
          <p className="text-sm text-muted-foreground">
            Sign the Data Use Agreement and create your researcher profile to access dataset search, exports, and (optionally) the API.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Full name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Jane Doe" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Institution</Label>
            <Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="University, hospital, lab…" />
          </div>
          <div>
            <Label>ORCID iD</Label>
            <Input value={orcid} onChange={(e) => setOrcid(e.target.value)} placeholder="0000-0000-0000-0000" />
          </div>
        </div>
        <div>
          <Label>Research focus</Label>
          <Input value={researchFocus} onChange={(e) => setResearchFocus(e.target.value)} placeholder="e.g. autoimmune disease epidemiology" />
        </div>
        <div>
          <Label>Intended use of the data</Label>
          <Textarea
            value={intendedUse}
            onChange={(e) => setIntendedUse(e.target.value)}
            placeholder="Briefly describe the question you're investigating and how you'll use this dataset."
            rows={3}
          />
        </div>

        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <div className="flex items-start gap-2">
            <Checkbox id="dua" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
            <label htmlFor="dua" className="text-xs leading-relaxed text-muted-foreground">
              I agree to the Data Use Agreement: I will not attempt re-identification, will not use the data for commercial resale,
              will follow IRB/ethical guidelines where applicable, and will cite DxCommons in publications.
            </label>
          </div>
        </div>

        <Button
          onClick={() => register.mutate()}
          disabled={!name.trim() || !agreed || register.isPending}
          className="bg-blue-500 text-white hover:bg-blue-500/90"
        >
          {register.isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registering…</>
          ) : (
            "Complete registration"
          )}
        </Button>
      </div>
    </div>
  );
};

// Researcher dashboard: shown to registered researchers
const ResearcherDashboard = ({ researcher }: { researcher: any }) => {
  const { user } = useAuth();
  const { isActive, isLoading: subLoading, openCheckout, openPortal } = useSubscription();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showKey, setShowKey] = useState(false);

  const { data: favorites } = useQuery({
    queryKey: ["researcher-favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("researcher_favorites")
        .select("id, label, condition_id, filters, created_at, conditions(name, slug)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: downloads } = useQuery({
    queryKey: ["researcher-downloads", researcher.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("download_log")
        .select("id, condition_filter, export_format, row_count, exported_at")
        .eq("researcher_id", researcher.id)
        .order("exported_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const removeFavorite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("researcher_favorites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["researcher-favorites"] });
      toast({ title: "Removed from favorites" });
    },
  });

  return (
    <div className="space-y-6">
      {/* Profile summary */}
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-6 shadow-card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-600">
              <UserCheck className="h-3.5 w-3.5" /> Registered Researcher
            </div>
            <h3 className="mt-1 font-heading text-xl text-foreground">{researcher.name}</h3>
            <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
              {researcher.institution && <div>{researcher.institution}</div>}
              {researcher.orcid && <div>ORCID: <span className="font-mono">{researcher.orcid}</span></div>}
              {researcher.research_focus && <div>Focus: {researcher.research_focus}</div>}
              <div>DUA accepted {new Date(researcher.agreed_terms_at).toLocaleDateString()}</div>
            </div>
          </div>
          <Link to="/profile?role=researcher">
            <Button variant="outline" size="sm">Edit profile</Button>
          </Link>
        </div>
      </div>

      {/* API access */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <Key className="h-5 w-5 text-primary" />
          <h3 className="font-heading text-lg text-foreground">API Access</h3>
        </div>
        {subLoading ? (
          <p className="text-sm text-muted-foreground">Loading subscription status…</p>
        ) : isActive ? (
          <div>
            <Badge className="mb-3">Active subscription</Badge>
            <p className="mb-3 text-sm text-muted-foreground">
              Use your API key in the <code className="rounded bg-secondary px-1 py-0.5 text-xs">x-api-key</code> header.
            </p>
            {researcher.api_key && (
              <div className="mb-4 rounded-md border border-border bg-secondary/30 p-3 font-mono text-xs break-all">
                {showKey ? researcher.api_key : "•".repeat(36)}
                <Button variant="link" size="sm" className="ml-2 h-auto p-0 text-xs" onClick={() => setShowKey(!showKey)}>
                  {showKey ? "Hide" : "Reveal"}
                </Button>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={openPortal}>
              <CreditCard className="mr-1.5 h-3.5 w-3.5" /> Manage billing
            </Button>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-sm text-muted-foreground">
              Downloads and search are free. Upgrade to <strong>$5/month</strong> for unlimited programmatic access.
            </p>
            <Button onClick={openCheckout} className="gap-2">
              <CreditCard className="h-4 w-4" /> Subscribe for API Access
            </Button>
          </div>
        )}
      </div>

      {/* Favorite searches */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500" />
          <h3 className="font-heading text-lg text-foreground">Favorite searches</h3>
        </div>
        {favorites && favorites.length > 0 ? (
          <ul className="divide-y divide-border">
            {favorites.map((f: any) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground truncate">{f.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {f.conditions?.name ?? "All conditions"} · saved {new Date(f.created_at).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFavorite.mutate(f.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No saved searches yet. Use the dataset discovery tool below to explore, then save useful queries here.
          </p>
        )}
      </div>

      {/* Recent downloads */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          <h3 className="font-heading text-lg text-foreground">Recent downloads</h3>
        </div>
        {downloads && downloads.length > 0 ? (
          <ul className="divide-y divide-border text-sm">
            {downloads.map((d: any) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground truncate">{d.condition_filter ?? "All conditions"}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.export_format?.toUpperCase() ?? "—"} · {d.row_count ?? 0} rows · {new Date(d.exported_at).toLocaleDateString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No downloads yet.</p>
        )}
      </div>
    </div>
  );
};

// Combined gate + dashboard for the registration section
const ResearcherRegistrationSection = () => {
  const { user, loading: authLoading } = useAuth();
  const { data: researcher, isLoading } = useResearcher();

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center shadow-card">
        <Lock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h3 className="mb-2 font-heading text-lg text-foreground">Sign in required</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Create a free account to register as a researcher.
        </p>
        <Link to="/auth?role=researcher">
          <Button>Sign In or Register</Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!researcher) {
    return <ResearcherRegistrationForm onRegistered={() => { /* query refetch handles UI swap */ }} />;
  }

  return <ResearcherDashboard researcher={researcher} />;
};

const ApiAccessCard = () => {
  const { isActive, isLoading, openCheckout, openPortal, subscription } = useSubscription();

  if (isLoading) {
    return <div className="text-center text-sm text-muted-foreground">Loading subscription status…</div>;
  }

  if (isActive) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 text-center shadow-card">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          <Zap className="h-3.5 w-3.5" /> Active Subscription
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Your API key is available in your researcher profile. Use it with the <code className="rounded bg-secondary px-1 py-0.5 text-xs">x-api-key</code> header.
        </p>
        <div className="flex justify-center gap-3">
          <Link to="/profile">
            <Button variant="outline" size="sm">View API Key</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={openPortal}>
            <CreditCard className="mr-1.5 h-3.5 w-3.5" /> Manage Billing
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center shadow-card">
      <h3 className="mb-2 font-heading text-lg text-foreground">$5/month</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Unlimited API calls to scrubbed, anonymized patient-reported datasets. Cancel anytime.
      </p>
      <Button onClick={openCheckout} className="gap-2">
        <CreditCard className="h-4 w-4" /> Subscribe for API Access
      </Button>
    </div>
  );
};

const Researchers = () => (
  <div className="flex min-h-screen flex-col">
    <Navbar />
    <main className="flex-1">
    {/* Hero */}
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="mb-4 text-4xl text-foreground">For Researchers</h1>
          <p className="mb-8 text-lg text-muted-foreground">
            Access crowdsourced, patient-reported data for your research. Create a free account
            to filter, explore, and export the full dataset.
          </p>
          <Link to="/auth?role=researcher">
            <Button size="lg" className="px-8">Create Free Account</Button>
          </Link>
        </div>
      </div>
    </section>

    {/* Disclaimers — always visible */}
    <section className="border-y border-border bg-destructive/5 py-8">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-destructive" />
            <div>
              <h2 className="mb-2 font-heading text-lg text-foreground">Important Disclaimers</h2>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>• <strong>DxCommons is not a healthcare provider.</strong> We do not diagnose, treat, or provide medical advice of any kind.</li>
                <li>• All data is <strong>patient-reported and self-selected</strong>. It is not a representative clinical sample and may contain inaccuracies, duplicates, or biased reporting.</li>
                <li>• This data should be used <strong>at the researcher's discretion</strong> with appropriate statistical caveats and institutional review board (IRB) approval where applicable.</li>
                <li>• DxCommons makes <strong>no warranties</strong> about the accuracy, completeness, or fitness for purpose of any data provided.</li>
                <li>• Researchers are solely responsible for the <strong>ethical use, interpretation, and publication</strong> of findings derived from this dataset.</li>
                <li>• Data must <strong>not be used for re-identification</strong> of individuals or for commercial resale.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* Features — always visible */}
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-6 shadow-card">
              <Icon className="mb-3 h-6 w-6 text-primary" />
              <h3 className="mb-2 font-heading text-lg text-card-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* AI Dataset Discovery — gated */}
    <section className="border-t border-border py-16 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 text-center">
            <h2 className="mb-2 font-heading text-2xl text-foreground">Dataset Discovery</h2>
            <p className="text-sm text-muted-foreground">
              Use our AI assistant to explore what data is available and plan your queries.
            </p>
          </div>
          <SignInGate label="the AI dataset discovery tool">
            <DatasetSearch />
          </SignInGate>
        </div>
      </div>
    </section>

    {/* Data Schema — gated */}
    <section className="border-t border-border py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 flex items-center gap-3">
            <FileJson className="h-6 w-6 text-primary" />
            <h2 className="font-heading text-2xl text-foreground">Data Schema</h2>
          </div>
          <SignInGate label="the full data schema">
            <p className="mb-6 text-sm text-muted-foreground">
              Each submission stores structured data in the following schema. The <code className="rounded bg-secondary px-1 py-0.5 text-xs">universal_fields</code> JSONB column contains the core patient-reported data.
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="px-4 py-3 text-left font-medium text-foreground">Field</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {schemaFields.map(({ field, type, desc }, i) => (
                    <tr key={field} className={i % 2 === 0 ? "bg-card" : "bg-secondary/20"}>
                      <td className="px-4 py-2.5 font-mono text-xs text-primary">{field}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{type}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SignInGate>
        </div>
      </div>
    </section>

    {/* API Access & Subscription — gated */}
    <section className="border-t border-border py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 text-center">
            <Zap className="mx-auto mb-3 h-8 w-8 text-primary" />
            <h2 className="mb-2 font-heading text-2xl text-foreground">API Access</h2>
            <p className="text-sm text-muted-foreground">
              Programmatic access to scrubbed, anonymized datasets. Downloads are free — API access requires a $5/month subscription.
            </p>
          </div>
          <SignInGate label="API subscription management">
            <ApiAccessCard />
          </SignInGate>
        </div>
      </div>
    </section>

    {/* Data Use Terms — always visible */}
    <section className="border-t border-border py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl rounded-xl border border-border bg-secondary/30 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-lg text-foreground">Data Use Terms</h3>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Data is anonymized and must not be used for re-identification</li>
            <li>• Not for commercial resale</li>
            <li>• Attribution to DxCommons encouraged in publications</li>
            <li>• Each export includes schema version, timestamps, and audit trail</li>
            <li>• Some patients have opted in to researcher contact — you may message them through the platform only</li>
          </ul>
        </div>
      </div>
    </section>

    </main>
    <Footer />
  </div>
);

export default Researchers;
