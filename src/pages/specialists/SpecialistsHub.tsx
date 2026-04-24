import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck, Layers, FileText, Users, Gavel, BookOpen, Vote } from "lucide-react";

const SpecialistsHub = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth?next=/specialists");
  }, [user, loading, navigate]);

  const { data: isSpecialist } = useQuery({
    queryKey: ["is-specialist", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "specialist").maybeSingle();
      return !!data;
    },
  });

  const { data: tiers } = useQuery({
    queryKey: ["my-tiers", user?.id],
    enabled: !!user && !!isSpecialist,
    queryFn: async () => {
      const { data } = await supabase.from("specialist_tiers").select("*").eq("user_id", user!.id).is("revoked_at", null);
      return data ?? [];
    },
  });

  const { data: application } = useQuery({
    queryKey: ["my-spec-app", user?.id],
    enabled: !!user && isSpecialist === false,
    queryFn: async () => {
      const { data } = await supabase.from("specialist_applications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <section className="flex-1 py-10">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="font-heading text-3xl text-foreground flex items-center gap-2">
                <FlaskConical className="h-7 w-7 text-fuchsia-500" />
                Specialist Hub
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">Earned tiers, scoped editing, peer-led governance.</p>
            </div>
            <Link to="/governance"><Button variant="outline" size="sm">Governance</Button></Link>
          </div>

          {!isSpecialist && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-fuchsia-500" />Become a specialist</CardTitle>
                <CardDescription>Verification via NPI + institutional email + a 3-peer panel.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                {application ? (
                  <div className="text-sm">
                    Application status: <Badge variant="secondary">{application.status}</Badge>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No application on file.</p>
                )}
                <Link to="/specialists/apply"><Button className="bg-fuchsia-500 text-white hover:bg-fuchsia-500/90">{application ? "View / re-apply" : "Apply"}</Button></Link>
              </CardContent>
            </Card>
          )}

          {isSpecialist && (
            <>
              <div className="mb-6 grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="text-base">Your tiers</CardTitle></CardHeader>
                  <CardContent>
                    {(tiers ?? []).length === 0 && <p className="text-sm text-muted-foreground">No active tiers yet.</p>}
                    <ul className="space-y-1.5 text-sm">
                      {(tiers ?? []).map((t) => (
                        <li key={t.id} className="flex items-center gap-2">
                          <Badge variant={t.tier === "moderator" ? "default" : t.tier === "core" ? "secondary" : "outline"}>{t.tier}</Badge>
                          <span className="text-muted-foreground text-xs">{t.scope_type}</span>
                          <span className="font-mono text-xs">{t.scope_id}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Tier ladder</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <div><Badge variant="outline" className="mr-2">contributing</Badge>Edits go through moderation queue.</div>
                    <div><Badge variant="secondary" className="mr-2">core</Badge>≥20 approved + 90 days, no sustained reversals.</div>
                    <div><Badge className="mr-2">moderator</Badge>Elected; cross-specialty + dispute oversight.</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <ToolCard to="/specialists/moderation" icon={ShieldCheck} title="Moderation queue" desc="Scope-filtered review work." />
                <ToolCard to="/specialists/clusters" icon={Layers} title="Disease clusters" desc="Opt into multi-system clusters." />
                <ToolCard to="/specialists/profiles/new" icon={FileText} title="Author profile" desc="Draft a disease profile (Claude-assisted)." />
                <ToolCard to="/specialists/aliases" icon={BookOpen} title="Propose aliases" desc="Suggest in-scope code aliases." />
                <ToolCard to="/specialists/panels" icon={Users} title="Vetting panels" desc="Review applicant peers." />
                <ToolCard to="/governance/elections" icon={Vote} title="Elections" desc="Stand or vote for moderator seats." />
                <ToolCard to="/governance/juries" icon={Gavel} title="Juries" desc="Sortition juries for disputes." />
              </div>
            </>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
};

const ToolCard = ({ to, icon: Icon, title, desc }: { to: string; icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) => (
  <Link to={to} className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-fuchsia-500">
    <Icon className="mb-3 h-5 w-5 text-fuchsia-500" />
    <div className="font-medium text-foreground">{title}</div>
    <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
  </Link>
);

export default SpecialistsHub;