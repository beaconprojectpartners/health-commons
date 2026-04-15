import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DatasetSearch from "@/components/DatasetSearch";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Database, Download, Filter, Key, AlertTriangle, FileJson, Shield, Lock, CreditCard, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";

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
  <div className="min-h-screen">
    <Navbar />

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
                <li>• <strong>CrowdDx is not a healthcare provider.</strong> We do not diagnose, treat, or provide medical advice of any kind.</li>
                <li>• All data is <strong>patient-reported and self-selected</strong>. It is not a representative clinical sample and may contain inaccuracies, duplicates, or biased reporting.</li>
                <li>• This data should be used <strong>at the researcher's discretion</strong> with appropriate statistical caveats and institutional review board (IRB) approval where applicable.</li>
                <li>• CrowdDx makes <strong>no warranties</strong> about the accuracy, completeness, or fitness for purpose of any data provided.</li>
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
            <li>• Attribution to CrowdDx encouraged in publications</li>
            <li>• Each export includes schema version, timestamps, and audit trail</li>
            <li>• Some patients have opted in to researcher contact — you may message them through the platform only</li>
          </ul>
        </div>
      </div>
    </section>

    <Footer />
  </div>
);

export default Researchers;
