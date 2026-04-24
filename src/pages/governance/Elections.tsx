import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const Elections = () => {
  const { data: elections } = useQuery({
    queryKey: ["elections"],
    queryFn: async () => {
      const { data } = await supabase.from("elections").select("*, election_candidates(id, candidate_id, statement)").order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const { data: seats } = useQuery({
    queryKey: ["seats"],
    queryFn: async () => {
      const { data } = await supabase.from("moderator_seats").select("*");
      return data ?? [];
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <section className="flex-1 py-10">
        <div className="container mx-auto max-w-4xl px-4">
          <h1 className="font-heading text-3xl text-foreground mb-2">Elections</h1>
          <p className="mb-6 text-sm text-muted-foreground">Annual moderator elections per cluster, staggered 6-month terms. 2-term limit, then 1-term cooldown. 20% turnout floor or seat fills by sortition.</p>

          <h2 className="font-heading text-xl mb-3 text-foreground">Open & upcoming</h2>
          {(elections ?? []).length === 0 && <p className="text-sm text-muted-foreground">No elections scheduled. The first elections begin at Phase 2.</p>}
          <div className="space-y-3">
            {(elections ?? []).map((e) => (
              <Card key={e.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>{e.scope_type} · <span className="font-mono text-sm">{e.scope_id}</span></span>
                    <Badge>{e.status}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Candidates: {(e.election_candidates as { id: string }[] | null)?.length ?? 0}
                </CardContent>
              </Card>
            ))}
          </div>

          <h2 className="font-heading text-xl mb-3 mt-8 text-foreground">Current seats</h2>
          {(seats ?? []).length === 0 && <p className="text-sm text-muted-foreground">No seats filled yet.</p>}
          <div className="space-y-2">
            {(seats ?? []).map((s) => (
              <Card key={s.id}>
                <CardContent className="flex items-center gap-3 py-3 text-sm">
                  <Badge variant="outline">{s.scope_type}</Badge>
                  <span className="font-mono text-xs">{s.scope_id}</span>
                  <span className="text-xs text-muted-foreground ml-auto">term {s.consecutive_terms}/2</span>
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

export default Elections;