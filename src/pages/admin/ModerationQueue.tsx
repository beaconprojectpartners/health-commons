import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type Status = "approved_new" | "mapped_alias" | "rejected" | "needs_info" | "deferred_to_moderator";

const ModerationQueue = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

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

  const { data: items } = useQuery({
    queryKey: ["moderation-queue"],
    enabled: !!user && !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moderation_queue_items")
        .select("id, source, status, priority, created_at, pending_code_entries!inner(id, redacted_text, code_system_hint)")
        .in("status", ["awaiting", "in_review", "needs_info"])
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const selected = items?.find((i) => i.id === selectedId) ?? items?.[0];

  const decide = useCallback(async (status: Status, extras?: { rejection_reason?: "duplicate" | "not_medical" | "phi_leaked" | "nonsense" | "out_of_scope" | "other" }) => {
    if (!selected) return;
    const { error } = await supabase
      .from("moderation_queue_items")
      .update({
        status,
        decided_by: user!.id,
        decided_at: new Date().toISOString(),
        decision_notes: notes || null,
        rejection_reason: extras?.rejection_reason ?? null,
      })
      .eq("id", selected.id);
    if (error) {
      toast({ title: "Decision failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Marked ${status}` });
      setNotes("");
      qc.invalidateQueries({ queryKey: ["moderation-queue"] });
    }
  }, [selected, notes, user, qc, toast]);

  const reportPhi = useCallback(async () => {
    if (!selected) return;
    const reason = window.prompt("Why is this PHI?");
    if (!reason) return;
    const { error } = await supabase.functions.invoke("report-phi", {
      body: { moderation_queue_item_id: selected.id, reason },
    });
    if (error) {
      toast({ title: "Report failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Reported & re-scrubbed" });
      qc.invalidateQueries({ queryKey: ["moderation-queue"] });
    }
  }, [selected, qc, toast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selected || (e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "a" || e.key === "A") decide("approved_new");
      else if (e.key === "r" || e.key === "R") decide("rejected", { rejection_reason: "other" });
      else if (e.key === "i" || e.key === "I") decide("needs_info");
      else if (e.key === "d" || e.key === "D") decide("deferred_to_moderator");
      else if (e.key === "p" || e.key === "P") reportPhi();
      else if (e.key === "j" || e.key === "k") {
        const idx = items?.findIndex((i) => i.id === selected.id) ?? 0;
        const next = e.key === "j" ? idx + 1 : idx - 1;
        if (items && next >= 0 && next < items.length) setSelectedId(items[next].id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, items, decide, reportPhi]);

  if (loading || isAdmin === undefined) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <section className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="font-heading text-2xl text-foreground">Moderation queue</h1>
            <p className="text-xs text-muted-foreground">Shortcuts: A approve · R reject · I info · D defer · P report PHI · J/K next/prev</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
            <div className="space-y-1 rounded-lg border border-border bg-card p-2">
              {items?.length === 0 && <p className="p-4 text-sm text-muted-foreground">Queue is empty.</p>}
              {items?.map((i) => {
                const pe = (i as unknown as { pending_code_entries: { redacted_text: string } }).pending_code_entries;
                return (
                  <button
                    key={i.id}
                    onClick={() => setSelectedId(i.id)}
                    className={`w-full rounded-md p-2 text-left text-sm hover:bg-secondary ${selected?.id === i.id ? "bg-secondary" : ""}`}
                  >
                    <div className="truncate text-foreground">{pe.redacted_text}</div>
                    <div className="mt-1 flex gap-1">
                      <Badge variant="outline" className="text-[10px]">{i.source}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{i.status}</Badge>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              {selected ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Redacted submission</div>
                    <div className="mt-1 rounded-md border border-border bg-secondary/40 p-3 font-mono text-sm">
                      {(selected as unknown as { pending_code_entries: { redacted_text: string } }).pending_code_entries.redacted_text}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Decision notes (scrubbed before save)</div>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => decide("approved_new")}>Approve as new (A)</Button>
                    <Button variant="outline" onClick={() => decide("rejected", { rejection_reason: "not_medical" })}>Reject (R)</Button>
                    <Button variant="outline" onClick={() => decide("needs_info")}>Needs info (I)</Button>
                    <Button variant="outline" onClick={() => decide("deferred_to_moderator")}>Defer to moderator (D)</Button>
                    <Button variant="ghost" onClick={reportPhi}>Report PHI (P)</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select an item from the queue.</p>
              )}
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default ModerationQueue;
