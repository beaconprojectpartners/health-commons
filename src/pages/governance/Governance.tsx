import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollText, Vote, Gavel, ShieldAlert } from "lucide-react";

const Governance = () => {
  const { data: phase } = useQuery({
    queryKey: ["governance-phase"],
    queryFn: async () => {
      const { data } = await supabase.from("governance_phase").select("*").eq("id", 1).maybeSingle();
      return data;
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <section className="flex-1 py-10">
        <div className="container mx-auto max-w-4xl px-4">
          <h1 className="font-heading text-3xl text-foreground mb-2">Governance</h1>
          <p className="mb-8 text-sm text-muted-foreground">Power to shape this platform is earned, rotated, transparent, and checkable. Founding authority dissolves on a published schedule.</p>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">Bootstrap phase <Badge>{phase ? `Phase ${phase.phase}` : "—"}</Badge></CardTitle>
              <CardDescription>{phase?.commitment}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <strong className="text-foreground">Phase 2 trigger:</strong> {phase?.trigger_description}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Tile to="/governance/log" icon={ScrollText} title="Transparency log" desc="Every vocabulary edit, panel decision, moderator action — public to all signed-in users." />
            <Tile to="/governance/elections" icon={Vote} title="Elections" desc="Annual moderator elections per cluster, staggered terms, weighted voting." />
            <Tile to="/governance/juries" icon={Gavel} title="Sortition juries" desc="Random panels of 5 Core specialists resolve contested decisions." />
            <Tile to="/specialists" icon={ShieldAlert} title="Specialist hub" desc="Tiers, scopes, and earned editing rights." />
          </div>

          <div className="mt-8 rounded-lg border border-border bg-secondary/30 p-5">
            <h2 className="font-heading text-lg text-foreground mb-2">Phase ladder</h2>
            <ol className="space-y-1.5 text-sm text-muted-foreground list-decimal pl-5">
              <li><strong className="text-foreground">Phase 0:</strong> Infrastructure live; founder operates panels, juries, and decisions manually — every action logged identically.</li>
              <li><strong className="text-foreground">Phase 1:</strong> 10–20 specialists; peer panels active for vetting; founder still backstops other decisions.</li>
              <li><strong className="text-foreground">Phase 2:</strong> ~50 specialists across 5 clusters; first moderator elections; founder authority dissolves into elected seats.</li>
              <li><strong className="text-foreground">Phase 3:</strong> Mature; admin role term-limited or held by a rotating council.</li>
            </ol>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

const Tile = ({ to, icon: Icon, title, desc }: { to: string; icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) => (
  <Link to={to}>
    <Card className="h-full transition-colors hover:border-primary">
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-primary" />{title}</CardTitle></CardHeader>
      <CardContent className="text-sm text-muted-foreground">{desc}</CardContent>
    </Card>
  </Link>
);

export default Governance;