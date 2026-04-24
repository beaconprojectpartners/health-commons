import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const Clusters = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) navigate("/auth?next=/specialists/clusters");
  }, [user, loading, navigate]);

  const { data: clusters } = useQuery({
    queryKey: ["clusters"],
    queryFn: async () => {
      const { data } = await supabase.from("specialty_clusters").select("*").eq("active", true).order("name");
      return data ?? [];
    },
  });

  const { data: mine } = useQuery({
    queryKey: ["my-clusters", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("cluster_memberships").select("cluster_id").eq("user_id", user!.id);
      return new Set((data ?? []).map((d) => d.cluster_id));
    },
  });

  const toggle = async (cluster_id: string, joined: boolean) => {
    if (!user) return;
    if (joined) {
      const { error } = await supabase.from("cluster_memberships").delete().eq("user_id", user.id).eq("cluster_id", cluster_id);
      if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      const { error } = await supabase.from("cluster_memberships").insert({ user_id: user.id, cluster_id });
      if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    }
    qc.invalidateQueries({ queryKey: ["my-clusters"] });
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <section className="flex-1 py-10">
        <div className="container mx-auto max-w-3xl px-4">
          <h1 className="font-heading text-3xl text-foreground mb-2">Disease clusters</h1>
          <p className="mb-6 text-sm text-muted-foreground">Clusters cover conditions that span specialty lines. Tier within a cluster is earned independently from your NPI specialty.</p>
          <div className="space-y-3">
            {(clusters ?? []).map((c) => {
              const joined = mine?.has(c.id) ?? false;
              return (
                <Card key={c.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>{c.name}</span>
                      <Button size="sm" variant={joined ? "outline" : "default"} onClick={() => toggle(c.id, joined)}>
                        {joined ? "Leave" : "Opt in"}
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{c.description}</CardContent>
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

export default Clusters;