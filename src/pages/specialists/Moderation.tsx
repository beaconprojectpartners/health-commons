import { useEffect, useState, useCallback, useMemo } from "react";
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
import { Loader2, Sparkles, ShieldCheck } from "lucide-react";

type Status = "approved_new" | "mapped_alias" | "rejected" | "needs_info" | "deferred_to_moderator";
type Tier = "contributing" | "core" | "moderator";

const tierRank: Record<Tier, number> = { contributing: 1, core: 2, moderator: 3 };

const SpecialistModeration = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [scopeOnly, setScopeOnly] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ system: string; code: string; display: string; confidence: number; rationale: string }> | null>(null);

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
  });

  const { data: tiers } = useQuery({
    queryKey: ["my-tiers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("specialist_tiers")
        .select("scope_type, scope_id, tier")
        .eq("user_id", user!.id)
        .is("revoked_at", null);
      return (data ?? []) as Array<{ scope_type: string; scope_id: string; tier: Tier }>;
    },
  });

  const maxTier: Tier | null = useMemo(() => {
    if (isAdmin) return "moderator";
    if (!tiers || tiers.length === 0) return null;
    return tiers.reduce<Tier>((acc, t) => (tierRank[t.tier] > tierRank[acc] ? t.tier : acc), "contributing");
  }, [tiers, isAdmin]);

  const scopeIds = useMemo(() => new Set((tiers ?? []).map((t) => t.scope_id.toLowerCase())), [tiers]);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth?next=/specialists/moderation"); return; }
    if (maxTier !== null && tierRank[maxTier] < tierRank.core && !isAdmin) navigate("/specialists");
  }, [user, loading, maxTier, isAdmin, navigate]);

  const { data: items } = useQuery({
    queryKey: ["spec-moderation-queue", maxTier],
    enabled: !!user && (!!isAdmin || (maxTier !== null && tierRank[maxTier] >= tierRank.core)),
    queryFn: async () => {
      const allowedTiers = isAdmin
        ? ["core", "moderator", "admin", null]
        : maxTier === "moderator"
          ? ["core", "moderator", null]
          : ["core", null];
      const { data, error } = await supabase
        .from("moderation_queue_items")
        .select("id, source, status, priority, required_tier, created_at, pending_code_entries!inner(id, redacted_text, code_system_hint)")
        .in("status", ["awaiting", "in_review", "needs_info"])
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).filter((i) => allowedTiers.includes(i.required_tier as string | null));
    },
  });

  const filtered = useMemo(() => {
    if (!items) return [];
    if (!scopeOnly || isAdmin) return items;
    if (scopeIds.size === 0) return items;
    return items.filter((i) => {
      const hint = (i as unknown as { pending_code_entries: { code_system_hint: string | null } }).pending_code_entries.code_system_hint?.toLowerCase();
      if (!hint) return true;
      return scopeIds.has(hint);
    });
  }, [items, scopeOnly, scopeIds, isAdmin]);

  const selected = filtered.find((i) => i.id === selectedId) ?? filtered[0];

  useEffect(() => { setSuggestions(null); }, [selected?.id]);

  const suggestCodes = useCallback(async () => {
    if (!selected) return;
    const pe = (selected as unknown as { pending_code_entries: { redacted_text: string; code_system_hint: string | null } }).pending_code_entries;
    setSuggesting(true);
    setSuggestions(null);
    const { data, error } = await supabase.functions.invoke("claude-code-suggest", {
      body: { redacted_text: pe.redacted_text, code_system_hint: pe.code_system_hint },
    });
    setSuggesting(false);
    if (error) { toast({ title: "Suggestion failed", description: error.message, variant: "destructive" }); return; }
    setSuggestions((data as { suggestions?: Array<{ system: string; code: string; display: string; confidence: number; rationale: string }> })?.suggestions ?? []);
  }, [selected, toast]);

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
    if (error) toast({ title: "Decision failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: `Marked ${status}` });
      setNotes("");
      qc.invalidateQueries({ queryKey: ["spec-moderation-queue"] });
    }
  }, [selected, notes, user, qc, toast]);

  const reportPhi = useCallback(async () => {
    if (!selected) return;
    const reason = window.prompt("Why is this PHI?");
    if (!reason) return;
    const { error } = await supabase.functions.invoke("report-phi", {
      body: { moderation_queue_item_id: selected.id, reason },
    });
    if (error) toast({ title: "Report failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Reported & re-scrubbed" }); qc.invalidateQueries({ queryKey: ["spec-moderation-queue"] }); }
  }, [selected, qc, toast]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selected || (e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "a" || e.key === "A") decide("approved_new");
      else if (e.key === "r" || e.key === "R") decide("rejected", { rejection_reason: "other" });
      else if (e.key === "i" || e.key === "I") decide("needs_info");
      else if (e.key === "d" || e.key === "D") decide("deferred_to_moderator");
      else if (e.key === "p" || e.key === "P") reportPhi();
      else if (e.key === "j" || e.key === "k") {
        const idx = filtered.findIndex((i) => i.id === selected.id);
        const next = e.key === "j" ? idx + 1 : idx - 1;
        if (next >= 0 && next < filtered.length) setSelectedId(filtered[next].id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, filtered, decide, reportPhi]);

  if (loading || (user && maxTier === null && isAdmin === undefined)) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <section className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-heading text-2xl text-foreground flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-fuchsia-500" />
                Moderation queue
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Your tier: <Badge variant="secondary" className="ml-1">{isAdmin ? "admin" : maxTier ?? "—"}</Badge>
                <span className="ml-3">Shortcuts: A approve · R reject · I info · D defer · P PHI · J/K next/prev</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant={scopeOnly ? "default" : "outline"} onClick={() => setScopeOnly((s) => !s)}>
                {scopeOnly ? "In-scope only" : "All scopes"}
              </Button>
            </div>
          </div>

          {(tiers ?? []).length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
              {(tiers ?? []).map((t, i) => (
                <Badge key={i} variant="outline" className="font-mono">{t.scope_type}:{t.scope_id} · {t.tier}</Badge>
              ))}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
            <div className="space-y-1 rounded-lg border border-border bg-card p-2 max-h-[70vh] overflow-y-auto">
              {filtered.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nothing in your scope.</p>}
              {filtered.map((i) => {
                const pe = (i as unknown as { pending_code_entries: { redacted_text: string; code_system_hint: string | null } }).pending_code_entries;
                const inScope = !pe.code_system_hint || scopeIds.has(pe.code_system_hint.toLowerCase());
                return (
                  <button
                    key={i.id}
                    onClick={() => setSelectedId(i.id)}
                    className={`w-full rounded-md p-2 text-left text-sm hover:bg-secondary ${selected?.id === i.id ? "bg-secondary" : ""}`}
                  >
                    <div className="truncate text-foreground">{pe.redacted_text}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[10px]">{i.source}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{i.status}</Badge>
                      {i.required_tier && <Badge variant="outline" className="text-[10px]">{i.required_tier}</Badge>}
                      {!inScope && <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">out-of-scope</Badge>}
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
                    <div className="text-xs text-muted-foreground">Decision notes</div>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => decide("approved_new")}>Approve (A)</Button>
                    <Button variant="outline" onClick={() => decide("rejected", { rejection_reason: "not_medical" })}>Reject (R)</Button>
                    <Button variant="outline" onClick={() => decide("needs_info")}>Needs info (I)</Button>
                    <Button variant="outline" onClick={() => decide("deferred_to_moderator")}>Defer (D)</Button>
                    <Button variant="ghost" onClick={reportPhi}>Report PHI (P)</Button>
                    <Button variant="secondary" onClick={suggestCodes} disabled={suggesting}>
                      {suggesting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                      Suggest codes
                    </Button>
                  </div>
                  {suggestions && (
                    <div className="rounded-md border border-border bg-secondary/30 p-3">
                      <div className="mb-2 text-xs font-medium text-muted-foreground">Claude suggestions</div>
                      {suggestions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No confident matches.</p>
                      ) : (
                        <ul className="space-y-2">
                          {suggestions.map((s, i) => (
                            <li key={i} className="text-sm">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px]">{s.system}</Badge>
                                <span className="font-mono">{s.code}</span>
                                <span className="text-foreground">{s.display}</span>
                                <span className="ml-auto text-xs text-muted-foreground">{Math.round((s.confidence ?? 0) * 100)}%</span>
                              </div>
                              {s.rationale && <p className="mt-0.5 text-xs text-muted-foreground">{s.rationale}</p>}
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-2 text-[10px] text-muted-foreground">AI suggestion — verify before approving.</p>
                    </div>
                  )}
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

export default SpecialistModeration;