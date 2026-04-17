import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const CalibrationAdmin = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [displayText, setDisplayText] = useState("");
  const [expectedDecision, setExpectedDecision] = useState("");
  const [rationale, setRationale] = useState("");

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
  });
  useEffect(() => { if (!loading && (!user || isAdmin === false)) navigate("/"); }, [user, loading, isAdmin, navigate]);

  const { data: items } = useQuery({
    queryKey: ["calibration-items"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("calibration_items").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const handleAdd = async () => {
    if (!displayText || !expectedDecision) {
      toast({ title: "Display text and expected decision required", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("calibration_items").insert({
      display_text: displayText,
      expected_decision: expectedDecision,
      rationale: rationale || null,
    });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      setDisplayText(""); setExpectedDecision(""); setRationale("");
      qc.invalidateQueries({ queryKey: ["calibration-items"] });
      toast({ title: "Calibration item added" });
    }
  };

  if (loading || isAdmin === undefined) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <section className="flex-1 py-10">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="mb-6 font-heading text-2xl text-foreground">Calibration items</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            New reviewers complete 15 of these (80% pass) before getting full access. Seed pre-scrubbed text only.
          </p>

          <div className="mb-8 space-y-3 rounded-lg border border-border bg-card p-5">
            <h2 className="font-heading text-lg text-foreground">Add item</h2>
            <Input placeholder="Display text (pre-scrubbed)" value={displayText} onChange={(e) => setDisplayText(e.target.value)} />
            <Input placeholder="Expected decision (e.g. approved_new, mapped_alias:<id>, rejected:not_medical)" value={expectedDecision} onChange={(e) => setExpectedDecision(e.target.value)} />
            <Textarea placeholder="Rationale" value={rationale} onChange={(e) => setRationale(e.target.value)} rows={2} />
            <Button onClick={handleAdd}>Add item</Button>
          </div>

          <div className="space-y-2">
            <h2 className="font-heading text-lg text-foreground">Items ({items?.length ?? 0})</h2>
            {items?.map((it) => (
              <div key={it.id} className="rounded-md border border-border bg-card p-3 text-sm">
                <div className="text-foreground">{it.display_text}</div>
                <div className="mt-1 text-xs text-muted-foreground">→ {it.expected_decision}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default CalibrationAdmin;
