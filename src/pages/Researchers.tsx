import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DatasetSearch from "@/components/DatasetSearch";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Database, Download, Filter, Key, AlertTriangle, FileJson, Shield } from "lucide-react";

const features = [
  { icon: Filter, title: "Advanced Filters", desc: "Filter by condition, symptom, treatment, lab result, region, and more." },
  { icon: Download, title: "CSV & JSON Export", desc: "Download filtered datasets with full data dictionaries included." },
  { icon: Key, title: "API Access", desc: "Programmatic access with rate-limited API keys for your research pipeline." },
  { icon: Database, title: "Open Data", desc: "No paywalls. Free forever. Attribution to CrowdDx encouraged." },
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

    {/* Disclaimers */}
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

    {/* Features */}
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

    {/* AI Dataset Discovery */}
    <section className="border-t border-border py-16 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 text-center">
            <h2 className="mb-2 font-heading text-2xl text-foreground">Dataset Discovery</h2>
            <p className="text-sm text-muted-foreground">
              Use our AI assistant to explore what data is available and plan your queries.
            </p>
          </div>
          <DatasetSearch />
        </div>
      </div>
    </section>

    {/* Data Schema */}
    <section className="border-t border-border py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 flex items-center gap-3">
            <FileJson className="h-6 w-6 text-primary" />
            <h2 className="font-heading text-2xl text-foreground">Data Schema</h2>
          </div>
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
        </div>
      </div>
    </section>

    {/* Data Use Terms */}
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
