import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Loader2 } from "lucide-react";

const COMPREHEND_CHAR_COST = 0.0014 / 100; // $/char

const AdminModeration = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
  });

  useEffect(() => {
    if (!loading && (!user || isAdmin === false)) navigate("/");
  }, [user, loading, isAdmin, navigate]);

  const { data: queueDepth } = useQuery({
    queryKey: ["queue-depth"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { count } = await supabase.from("moderation_queue_items").select("id", { count: "exact", head: true }).in("status", ["awaiting", "in_review"]);
      return count ?? 0;
    },
  });

  const { data: redactionStats } = useQuery({
    queryKey: ["redaction-stats"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400_000).toISOString();
      const { data } = await supabase.from("redaction_log").select("provider, error_code, counts").gte("created_at", since);
      const total = data?.length ?? 0;
      const errors = data?.filter((r) => r.error_code).length ?? 0;
      // Rough char volume estimate: assume avg 60 chars per call (we don't store text).
      const estChars = total * 60;
      const estCost = estChars * COMPREHEND_CHAR_COST;
      return { total, errors, estChars, estCost };
    },
  });

  const { data: phiReports } = useQuery({
    queryKey: ["phi-reports-open"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { count } = await supabase.from("phi_reports").select("id", { count: "exact", head: true }).eq("resolved", false);
      return count ?? 0;
    },
  });

  if (loading || isAdmin === undefined) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const Tile = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 font-heading text-3xl text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <section className="flex-1 py-10">
        <div className="container mx-auto px-4">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="font-heading text-3xl text-foreground">Moderation dashboard</h1>
            <div className="flex gap-2">
              <Link to="/admin/moderation/queue" className="text-sm text-primary underline">Open queue</Link>
              <Link to="/admin/moderation/calibration" className="text-sm text-primary underline">Calibration items</Link>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Queue depth" value={queueDepth ?? "—"} hint="awaiting or in review" />
            <Tile label="PHI reports open" value={phiReports ?? "—"} />
            <Tile label="Scrub calls (30d)" value={redactionStats?.total ?? "—"} hint={`${redactionStats?.errors ?? 0} errors`} />
            <Tile
              label="Est. Comprehend cost (30d)"
              value={redactionStats ? `$${redactionStats.estCost.toFixed(2)}` : "—"}
              hint="Swap to Presidio if monthly &gt; $300"
            />
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default AdminModeration;
