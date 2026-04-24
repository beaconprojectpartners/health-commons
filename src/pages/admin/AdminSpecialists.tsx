import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const AdminSpecialists = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
  });
  useEffect(() => { if (!loading && (!user || isAdmin === false)) navigate("/"); }, [user, loading, isAdmin, navigate]);

  const { data: apps } = useQuery({
    queryKey: ["admin-spec-apps"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("specialist_applications").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const assign = async (application_id: string) => {
    const { error } = await supabase.functions.invoke("assign-vetting-panel", { body: { application_id } });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Panel assigned" });
    qc.invalidateQueries({ queryKey: ["admin-spec-apps"] });
  };

  const finalize = async (application_id: string) => {
    const { data: panels } = await supabase.from("vetting_panels").select("id").eq("application_id", application_id).order("created_at", { ascending: false }).limit(1);
    if (!panels?.length) return toast({ title: "No panel", variant: "destructive" });
    const { error } = await supabase.functions.invoke("finalize-vetting-panel", { body: { panel_id: panels[0].id } });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Finalized" });
    qc.invalidateQueries({ queryKey: ["admin-spec-apps"] });
  };

  if (loading || isAdmin === undefined) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <section className="flex-1 py-10">
        <div className="container mx-auto max-w-4xl px-4">
          <h1 className="font-heading text-3xl text-foreground mb-6">Specialist applications</h1>
          <div className="space-y-3">
            {(apps ?? []).map((a) => (
              <Card key={a.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>{a.full_name ?? "—"}</span>
                    <Badge>{a.status}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid gap-1 sm:grid-cols-2 text-xs">
                    <div><span className="text-muted-foreground">NPI:</span> <span className="font-mono">{a.npi}</span></div>
                    <div><span className="text-muted-foreground">Email:</span> {a.institutional_email}</div>
                    <div className="sm:col-span-2"><span className="text-muted-foreground">Specialty:</span> {a.primary_taxonomy_display}</div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    {a.status === "pending" && <Button size="sm" onClick={() => assign(a.id)}>Assign panel</Button>}
                    {a.status === "in_review" && <Button size="sm" onClick={() => finalize(a.id)}>Tally votes</Button>}
                  </div>
                </CardContent>
              </Card>
            ))}
            {(apps ?? []).length === 0 && <p className="text-sm text-muted-foreground">No applications.</p>}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default AdminSpecialists;