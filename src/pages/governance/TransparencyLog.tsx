import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const TransparencyLog = () => {
  const { data: edits } = useQuery({
    queryKey: ["vocab-log"],
    queryFn: async () => {
      const { data } = await supabase.from("vocabulary_edit_log").select("*").order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });
  const { data: emergencies } = useQuery({
    queryKey: ["emergency-log"],
    queryFn: async () => {
      const { data } = await supabase.from("emergency_action_log").select("*").order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <section className="flex-1 py-10">
        <div className="container mx-auto max-w-4xl px-4">
          <h1 className="font-heading text-3xl text-foreground mb-2">Transparency log</h1>
          <p className="mb-6 text-sm text-muted-foreground">Public to all signed-in users. Every vocabulary change, panel decision, moderator action, election outcome, and jury decision lives here.</p>

          <h2 className="font-heading text-xl text-foreground mb-3 mt-6">Vocabulary edits</h2>
          {(edits ?? []).length === 0 && <p className="text-sm text-muted-foreground">No edits yet.</p>}
          <div className="space-y-2">
            {(edits ?? []).map((e) => (
              <Card key={e.id}>
                <CardContent className="flex items-center gap-3 py-3 text-sm">
                  <Badge variant="outline">{e.target_type}</Badge>
                  <Badge variant="secondary">{e.action}</Badge>
                  {e.high_impact && <Badge>high-impact</Badge>}
                  {e.scope_id && <span className="text-xs font-mono text-muted-foreground">{e.scope_id}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                </CardContent>
              </Card>
            ))}
          </div>

          <h2 className="font-heading text-xl text-foreground mb-3 mt-8">Emergency actions</h2>
          {(emergencies ?? []).length === 0 && <p className="text-sm text-muted-foreground">No emergency actions logged.</p>}
          <div className="space-y-2">
            {(emergencies ?? []).map((e) => (
              <Card key={e.id}>
                <CardContent className="py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Badge variant="destructive">{e.action}</Badge>
                    <Badge variant="outline">{e.target_type}</Badge>
                    <span className="ml-auto text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{e.reason}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default TransparencyLog;