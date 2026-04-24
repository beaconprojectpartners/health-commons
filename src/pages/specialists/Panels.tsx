import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Panels = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [reasonings, setReasonings] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !user) navigate("/auth?next=/specialists/panels");
  }, [user, loading, navigate]);

  const { data: panels } = useQuery({
    queryKey: ["my-panels", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: members } = await supabase.from("vetting_panel_members").select("panel_id").eq("user_id", user!.id);
      const ids = (members ?? []).map((m) => m.panel_id);
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("vetting_panels")
        .select("id, sla_due_at, closed_at, outcome, application_id, specialist_applications(id, full_name, npi, primary_taxonomy_display, institutional_email, decision_notes)")
        .in("id", ids)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const castVote = async (panel_id: string, vote: "approve" | "reject" | "needs_info") => {
    const reasoning = (reasonings[panel_id] ?? "").trim();
    if (reasoning.length < 20) {
      toast({ title: "Reasoning required", description: "Please write at least 20 characters explaining your vote.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("vetting_panel_votes").insert({ panel_id, voter_id: user!.id, vote, reasoning });
    if (error) {
      toast({ title: "Vote failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Vote recorded" });
    setReasonings((p) => ({ ...p, [panel_id]: "" }));
    qc.invalidateQueries({ queryKey: ["my-panels"] });
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <section className="flex-1 py-10">
        <div className="container mx-auto max-w-4xl px-4">
          <h1 className="font-heading text-3xl text-foreground mb-2">Vetting panels</h1>
          <p className="mb-6 text-sm text-muted-foreground">You're a randomly assigned panelist. Your vote is visible to fellow panelists; aggregate decisions are public.</p>
          {(panels ?? []).length === 0 && <p className="text-sm text-muted-foreground">No panel invitations.</p>}
          <div className="space-y-4">
            {(panels ?? []).map((p) => {
              const app = p.specialist_applications as { full_name?: string; npi?: string; primary_taxonomy_display?: string; institutional_email?: string; decision_notes?: string } | null;
              return (
                <Card key={p.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>{app?.full_name ?? "Applicant"}</span>
                      <div className="flex gap-2">
                        {p.outcome && <Badge variant="secondary">{p.outcome}</Badge>}
                        {p.closed_at ? <Badge>closed</Badge> : <Badge variant="outline">due {new Date(p.sla_due_at).toLocaleDateString()}</Badge>}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div><span className="text-muted-foreground">NPI:</span> <span className="font-mono">{app?.npi}</span></div>
                      <div><span className="text-muted-foreground">Email:</span> {app?.institutional_email}</div>
                      <div className="sm:col-span-2"><span className="text-muted-foreground">Primary specialty:</span> {app?.primary_taxonomy_display}</div>
                    </div>
                    {app?.decision_notes && <div className="rounded border border-border bg-secondary/30 p-3 text-sm">{app.decision_notes}</div>}
                    {!p.closed_at && (
                      <>
                        <Textarea
                          placeholder="Required: explain your reasoning to fellow panelists."
                          value={reasonings[p.id] ?? ""}
                          onChange={(e) => setReasonings((s) => ({ ...s, [p.id]: e.target.value }))}
                          rows={3}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => castVote(p.id, "approve")}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => castVote(p.id, "needs_info")}>Needs info</Button>
                          <Button size="sm" variant="destructive" onClick={() => castVote(p.id, "reject")}>Reject</Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Panels;