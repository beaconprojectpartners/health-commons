import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const Juries = () => {
  const { data: juries } = useQuery({
    queryKey: ["juries"],
    queryFn: async () => {
      const { data } = await supabase.from("juries").select("*").order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <section className="flex-1 py-10">
        <div className="container mx-auto max-w-4xl px-4">
          <h1 className="font-heading text-3xl text-foreground mb-2">Sortition juries</h1>
          <p className="mb-6 text-sm text-muted-foreground">Random panels of 5 Core specialists resolve contested vocabulary edits, application appeals, and moderator action challenges. Deliberation visible; decisions binding; one appeal allowed.</p>
          {(juries ?? []).length === 0 && <p className="text-sm text-muted-foreground">No juries seated yet.</p>}
          <div className="space-y-3">
            {(juries ?? []).map((j) => (
              <Card key={j.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>{j.subject_summary ?? j.subject_ref}</span>
                    <div className="flex gap-2"><Badge variant="outline">{j.decision_type}</Badge><Badge>{j.status}</Badge></div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">Opened {new Date(j.created_at).toLocaleDateString()}</CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Juries;