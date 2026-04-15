import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, FileText, Microscope, Stethoscope, TestTube2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

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

const DetailSection = ({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: typeof FileText;
  items: string[];
}) => {
  if (!items.length) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-2xl text-card-foreground">{title}</h2>
      </div>
      <ul className="space-y-3 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="rounded-xl bg-secondary/40 px-4 py-3">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
};

const ConditionDetail = () => {
  const { slug = "" } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["condition-detail", slug],
    queryFn: async () => {
      const { data: condition, error: conditionError } = await supabase
        .from("conditions")
        .select("id, name, slug, icd10_code, submission_count")
        .eq("slug", slug)
        .eq("approved", true)
        .maybeSingle();

      if (conditionError) throw conditionError;
      if (!condition) return null;

      const { data: profiles, error: profileError } = await supabase
        .from("disease_profiles")
        .select("criteria, labs, imaging, scoring_tools, citation, version, updated_at")
        .eq("condition_id", condition.id)
        .eq("status", "approved")
        .order("approved_at", { ascending: false })
        .limit(1);

      if (profileError) throw profileError;

      return {
        condition,
        profile: profiles?.[0] ?? null,
      };
    },
  });

  const criteria = useMemo(() => normalizeItems(data?.profile?.criteria), [data?.profile?.criteria]);
  const labs = useMemo(() => normalizeItems(data?.profile?.labs), [data?.profile?.labs]);
  const imaging = useMemo(() => normalizeItems(data?.profile?.imaging), [data?.profile?.imaging]);
  const scoringTools = useMemo(() => normalizeItems(data?.profile?.scoring_tools), [data?.profile?.scoring_tools]);

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <section className="py-16">
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
      <div className="min-h-screen">
        <Navbar />
        <section className="py-16">
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

  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <section className="border-b border-border bg-secondary/30 py-16">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-5xl">
              <Link to="/conditions" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                <ChevronLeft className="h-4 w-4" /> Back to conditions
              </Link>
              <div className="rounded-3xl border border-border bg-card p-8 shadow-card">
                <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {data.condition.icd10_code && (
                    <span className="rounded-full bg-secondary px-3 py-1">ICD-10 {data.condition.icd10_code}</span>
                  )}
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
                    {data.condition.submission_count ?? 0} submissions
                  </span>
                  {data.profile?.version && (
                    <span className="rounded-full bg-secondary px-3 py-1">Profile v{data.profile.version}</span>
                  )}
                </div>
                <h1 className="mb-4 text-4xl text-card-foreground md:text-5xl">{data.condition.name}</h1>
                <p className="max-w-3xl text-lg text-muted-foreground">
                  This public page summarizes the currently approved profile for {data.condition.name} and shows what patients and researchers are tracking.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link to={`/submit?condition=${data.condition.id}`}>
                    <Button size="lg">Share Your Experience</Button>
                  </Link>
                  <Link to="/conditions">
                    <Button variant="outline" size="lg">Browse More Conditions</Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
              <DetailSection title="Diagnostic Criteria" icon={FileText} items={criteria} />
              <DetailSection title="Common Labs" icon={TestTube2} items={labs} />
              <DetailSection title="Imaging & Tests" icon={Microscope} items={imaging} />
              <DetailSection title="Scoring Tools" icon={Stethoscope} items={scoringTools} />
            </div>

            {!criteria.length && !labs.length && !imaging.length && !scoringTools.length && (
              <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-border bg-card p-8 text-center shadow-card">
                <h2 className="mb-3 text-2xl text-card-foreground">Public summary coming soon</h2>
                <p className="text-muted-foreground">
                  We do not have an approved public profile for this condition yet, but the page is public and patients can still contribute data.
                </p>
              </div>
            )}

            {data.profile?.citation && (
              <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-border bg-secondary/30 p-6 text-sm text-muted-foreground">
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
