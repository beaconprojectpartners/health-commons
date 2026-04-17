import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ChevronLeft,
  Database,
  FileText,
  HeartPulse,
  Microscope,
  Pill,
  Stethoscope,
  TestTube2,
  Users,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import AggregatedList, { type AggregatedItem } from "@/components/condition/AggregatedList";

const normalizeItems = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      if (typeof item === "string") return [item];
      if (item && typeof item === "object") {
        const text = Object.values(item as Record<string, unknown>)
          .filter(Boolean)
          .map((entry) => String(entry))
          .join(" • ");
        return text ? [text] : [];
      }
      return [];
    })
    .filter(Boolean);
};

const aggregateField = (
  submissions: Array<{ universal_fields: unknown; dynamic_fields: unknown }>,
  paths: Array<["universal_fields" | "dynamic_fields", string]>,
): AggregatedItem[] => {
  const counts = new Map<string, number>();
  for (const sub of submissions) {
    const seen = new Set<string>();
    for (const [bucket, key] of paths) {
      const root = sub[bucket];
      if (!root || typeof root !== "object") continue;
      const arr = (root as Record<string, unknown>)[key];
      if (!Array.isArray(arr)) continue;
      for (const entry of arr) {
        let name: string | null = null;
        if (typeof entry === "string") name = entry;
        else if (entry && typeof entry === "object") {
          const n = (entry as Record<string, unknown>).name;
          if (typeof n === "string") name = n;
        }
        if (!name) continue;
        const norm = name.trim();
        if (!norm || seen.has(norm.toLowerCase())) continue;
        seen.add(norm.toLowerCase());
        counts.set(norm, (counts.get(norm) ?? 0) + 1);
      }
    }
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
};

const SectionCard = ({
  title,
  icon: Icon,
  children,
  id,
}: {
  title: string;
  icon: typeof FileText;
  children: React.ReactNode;
  id?: string;
}) => (
  <section id={id} className="rounded-2xl border border-border bg-card p-6 shadow-card scroll-mt-24">
    <div className="mb-4 flex items-center gap-3">
      <div className="rounded-xl bg-primary/10 p-2 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="text-2xl text-card-foreground">{title}</h2>
    </div>
    {children}
  </section>
);

const CuratedList = ({ items }: { items: string[] }) => (
  <ul className="space-y-3 text-sm text-muted-foreground">
    {items.map((item) => (
      <li key={item} className="rounded-xl bg-secondary/40 px-4 py-3">
        {item}
      </li>
    ))}
  </ul>
);

const SUB_NAV = [
  { id: "overview", label: "Overview" },
  { id: "criteria", label: "Diagnostic Criteria" },
  { id: "labs-imaging", label: "Labs & Imaging" },
  { id: "symptoms", label: "Symptoms" },
  { id: "treatments", label: "Treatments" },
  { id: "scoring", label: "Scoring Tools" },
  { id: "researchers", label: "Researchers" },
  { id: "contribute", label: "Contribute" },
];

const ConditionDetail = () => {
  const { slug = "" } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["condition-detail", slug],
    queryFn: async () => {
      const { data: condition, error: conditionError } = await supabase
        .from("conditions")
        .select("id, name, slug, icd10_code, submission_count, updated_at")
        .eq("slug", slug)
        .eq("approved", true)
        .maybeSingle();

      if (conditionError) throw conditionError;
      if (!condition) return null;

      const [{ data: profiles, error: profileError }, { data: submissions, error: submissionsError }] =
        await Promise.all([
          supabase
            .from("disease_profiles")
            .select("criteria, labs, imaging, scoring_tools, citation, version, updated_at")
            .eq("condition_id", condition.id)
            .eq("status", "approved")
            .order("approved_at", { ascending: false })
            .limit(1),
          supabase
            .from("submissions")
            .select("universal_fields, dynamic_fields")
            .eq("condition_id", condition.id)
            .limit(1000),
        ]);

      if (profileError) throw profileError;
      if (submissionsError) throw submissionsError;

      return {
        condition,
        profile: profiles?.[0] ?? null,
        submissions: submissions ?? [],
      };
    },
  });

  const criteria = useMemo(() => normalizeItems(data?.profile?.criteria), [data?.profile?.criteria]);
  const labs = useMemo(() => normalizeItems(data?.profile?.labs), [data?.profile?.labs]);
  const imaging = useMemo(() => normalizeItems(data?.profile?.imaging), [data?.profile?.imaging]);
  const scoringTools = useMemo(() => normalizeItems(data?.profile?.scoring_tools), [data?.profile?.scoring_tools]);

  const symptoms = useMemo(
    () => aggregateField(data?.submissions ?? [], [["universal_fields", "symptoms"]]),
    [data?.submissions],
  );
  const treatments = useMemo(
    () =>
      aggregateField(data?.submissions ?? [], [
        ["universal_fields", "treatments"],
        ["dynamic_fields", "treatments"],
      ]),
    [data?.submissions],
  );
  const comorbidities = useMemo(
    () =>
      aggregateField(data?.submissions ?? [], [
        ["universal_fields", "comorbidities"],
        ["dynamic_fields", "comorbidities"],
      ]),
    [data?.submissions],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <section className="flex-1 py-16">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-5xl animate-pulse space-y-6">
              <div className="h-10 w-40 rounded-lg bg-muted" />
              <div className="h-40 rounded-2xl bg-muted" />
              <div className="grid gap-6 md:grid-cols-2">
                <div className="h-56 rounded-2xl bg-muted" />
                <div className="h-56 rounded-2xl bg-muted" />
              </div>
            </div>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <section className="flex-1 py-16">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8 text-center shadow-card">
              <h1 className="mb-3 text-3xl text-card-foreground">Condition not found</h1>
              <p className="mb-6 text-muted-foreground">
                This condition page is not available yet, but the full registry is still public.
              </p>
              <Link to="/conditions">
                <Button>Browse Conditions</Button>
              </Link>
            </div>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  const totalSubmissions = data.condition.submission_count ?? data.submissions.length ?? 0;
  const reliableStats = totalSubmissions >= 5;
  const lastUpdated = data.profile?.updated_at ?? data.condition.updated_at;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section id="overview" className="border-b border-border bg-secondary/30 py-12 scroll-mt-24">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-5xl">
              <Link
                to="/conditions"
                className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" /> Back to conditions
              </Link>
              <div className="rounded-3xl border border-border bg-card p-8 shadow-card">
                <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {data.condition.icd10_code && (
                    <span className="rounded-full bg-secondary px-3 py-1">ICD-10 {data.condition.icd10_code}</span>
                  )}
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
                    {totalSubmissions} submissions
                  </span>
                  {data.profile?.version && (
                    <span className="rounded-full bg-secondary px-3 py-1">Profile v{data.profile.version}</span>
                  )}
                  {lastUpdated && (
                    <span className="rounded-full bg-secondary px-3 py-1">
                      Updated {new Date(lastUpdated).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <h1 className="mb-4 text-4xl text-card-foreground md:text-5xl">{data.condition.name}</h1>
                <p className="max-w-3xl text-lg text-muted-foreground">
                  This public page summarizes the currently approved profile for {data.condition.name} and shows what
                  patients and researchers are tracking.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link to={`/submit?condition=${data.condition.id}`}>
                    <Button size="lg">Share Your Experience</Button>
                  </Link>
                  <Link to="/researchers">
                    <Button variant="outline" size="lg">
                      Researcher Access
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Sticky sub-nav */}
        <div className="sticky top-16 z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="container mx-auto px-4">
            <nav className="-mx-1 flex gap-1 overflow-x-auto py-3">
              {SUB_NAV.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </div>
        </div>

        {/* At-a-glance */}
        <section className="py-10">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-5xl">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                  <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Patients sharing</div>
                  <div className="text-2xl text-card-foreground">{totalSubmissions}</div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                  <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Symptoms tracked</div>
                  <div className="text-2xl text-card-foreground">{symptoms.length}</div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                  <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Treatments tracked</div>
                  <div className="text-2xl text-card-foreground">{treatments.length}</div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                  <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Top comorbidities</div>
                  {comorbidities.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Not yet reported</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {comorbidities.slice(0, 3).map((c) => (
                        <span
                          key={c.name}
                          className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-xs"
                        >
                          {c.name}
                          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                            {c.count}
                          </Badge>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Curated profile sections */}
        <section className="pb-10">
          <div className="container mx-auto px-4">
            <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
              {criteria.length > 0 && (
                <SectionCard id="criteria" title="Diagnostic Criteria" icon={FileText}>
                  <CuratedList items={criteria} />
                </SectionCard>
              )}
              {(labs.length > 0 || imaging.length > 0) && (
                <SectionCard id="labs-imaging" title="Labs & Imaging" icon={TestTube2}>
                  {labs.length > 0 && (
                    <div className="mb-4">
                      <h3 className="mb-2 text-sm font-medium text-foreground">Common Labs</h3>
                      <CuratedList items={labs} />
                    </div>
                  )}
                  {imaging.length > 0 && (
                    <div>
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                        <Microscope className="h-4 w-4" /> Imaging & Tests
                      </h3>
                      <CuratedList items={imaging} />
                    </div>
                  )}
                </SectionCard>
              )}
            </div>

            {!criteria.length && !labs.length && !imaging.length && !scoringTools.length && (
              <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-border bg-card p-8 text-center shadow-card">
                <h2 className="mb-3 text-2xl text-card-foreground">Public summary coming soon</h2>
                <p className="text-muted-foreground">
                  We do not have an approved public profile for this condition yet, but the page is public and patients
                  can still contribute data.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Patient-reported aggregates */}
        <section className="pb-10">
          <div className="container mx-auto px-4">
            <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
              {/* Symptoms */}
              <SectionCard id="symptoms" title="Symptoms" icon={HeartPulse}>
                {totalSubmissions === 0 ? (
                  <div className="rounded-xl bg-secondary/40 px-4 py-6 text-center text-sm text-muted-foreground">
                    Be the first to share your experience —{" "}
                    <Link to={`/submit?condition=${data.condition.id}`} className="text-primary underline">
                      add your data
                    </Link>
                    .
                  </div>
                ) : symptoms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No symptoms reported yet.</p>
                ) : (
                  <>
                    <AggregatedList
                      items={symptoms}
                      totalSubmissions={totalSubmissions}
                      showPercentages={reliableStats}
                    />
                    {!reliableStats && (
                      <p className="mt-4 text-xs text-muted-foreground">
                        Based on {totalSubmissions} submission{totalSubmissions === 1 ? "" : "s"} — more data needed for
                        reliable percentages.
                      </p>
                    )}
                  </>
                )}
              </SectionCard>

              {/* Treatments */}
              <SectionCard id="treatments" title="Treatments" icon={Pill}>
                {totalSubmissions === 0 ? (
                  <div className="rounded-xl bg-secondary/40 px-4 py-6 text-center text-sm text-muted-foreground">
                    Be the first to share your experience —{" "}
                    <Link to={`/submit?condition=${data.condition.id}`} className="text-primary underline">
                      add your data
                    </Link>
                    .
                  </div>
                ) : treatments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No treatments reported yet.</p>
                ) : (
                  <>
                    <AggregatedList
                      items={treatments}
                      totalSubmissions={totalSubmissions}
                      showPercentages={reliableStats}
                    />
                    {!reliableStats && (
                      <p className="mt-4 text-xs text-muted-foreground">
                        Based on {totalSubmissions} submission{totalSubmissions === 1 ? "" : "s"} — more data needed for
                        reliable percentages.
                      </p>
                    )}
                  </>
                )}
              </SectionCard>

              {/* Scoring Tools (curated) */}
              {scoringTools.length > 0 && (
                <SectionCard id="scoring" title="Scoring Tools" icon={Stethoscope}>
                  <CuratedList items={scoringTools} />
                </SectionCard>
              )}

              {/* Community */}
              <SectionCard title="Community" icon={Users}>
                <p className="mb-4 text-sm text-muted-foreground">
                  {totalSubmissions} patient{totalSubmissions === 1 ? "" : "s"} are sharing data on this condition.
                </p>
                <Link to="/community">
                  <Button variant="outline" size="sm">
                    Sign in to connect with peers
                  </Button>
                </Link>
              </SectionCard>
            </div>
          </div>
        </section>

        {/* Researchers strip */}
        <section id="researchers" className="border-t border-border bg-secondary/30 py-12 scroll-mt-24">
          <div className="container mx-auto px-4">
            <div className="mx-auto flex max-w-5xl flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-card md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-primary/10 p-3 text-primary">
                  <Database className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl text-card-foreground">For Researchers</h2>
                  <p className="text-sm text-muted-foreground">
                    {totalSubmissions} anonymized record{totalSubmissions === 1 ? "" : "s"} available
                    {lastUpdated && ` · last updated ${new Date(lastUpdated).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/researchers">
                  <Button variant="outline">Browse dataset</Button>
                </Link>
                <Link to="/researchers">
                  <Button>Request access</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Contribute */}
        <section id="contribute" className="py-12 scroll-mt-24">
          <div className="container mx-auto px-4">
            <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <div className="mb-3 flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <Activity className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl text-card-foreground">Patients</h3>
                </div>
                <p className="mb-4 text-sm text-muted-foreground">
                  Add your data to help others recognize patterns and accelerate research.
                </p>
                <Link to={`/submit?condition=${data.condition.id}`}>
                  <Button>Add your data</Button>
                </Link>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <div className="mb-3 flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <Stethoscope className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl text-card-foreground">Specialists</h3>
                </div>
                <p className="mb-4 text-sm text-muted-foreground">
                  Suggest improvements to the diagnostic criteria, labs, or scoring tools for this condition.
                </p>
                <Link to={`/submit?condition=${data.condition.id}&mode=specialist`}>
                  <Button variant="outline">Suggest an edit</Button>
                </Link>
              </div>
            </div>

            {data.profile?.citation && (
              <div className="mx-auto mt-6 max-w-5xl rounded-2xl border border-border bg-secondary/30 p-6 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Citation:</span> {data.profile.citation}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default ConditionDetail;
