import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Span { type: string; start: number; end: number; score: number }

interface ScrubResult {
  redacted_text: string;
  spans: Span[];
  counts: Record<string, number>;
  provider: string;
  model_version: string;
}

interface MatchedCandidate {
  source: "code" | "alias";
  code_id: string;
  alias_id?: string;
  display: string;
  code: string;
  code_system: string;
  score: number;
}

interface Props {
  open: boolean;
  text: string;
  kind: "symptom" | "treatment" | "condition" | "finding" | "procedure" | "medication";
  onCancel: () => void;
  onConfirmed: (result: { stored: boolean; redacted_text: string; matched?: MatchedCandidate }) => void;
}

function highlightSpans(text: string, spans: Span[]) {
  if (spans.length === 0) return [{ text, type: null as string | null }];
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const out: Array<{ text: string; type: string | null }> = [];
  let cursor = 0;
  for (const s of sorted) {
    if (s.start > cursor) out.push({ text: text.slice(cursor, s.start), type: null });
    out.push({ text: text.slice(s.start, s.end), type: s.type });
    cursor = s.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), type: null });
  return out;
}

export function PhiPreviewModal({ open, text, kind, onCancel, onConfirmed }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ScrubResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !text) return;
    setResult(null);
    setError(null);
    setLoading(true);
    supabase.functions
      .invoke("scrub-phi", { body: { text, context: kind } })
      .then(({ data, error }) => {
        if (error) {
          setError(error.message ?? "PHI check failed");
        } else {
          setResult(data as ScrubResult);
        }
      })
      .catch((e) => setError(e?.message ?? "PHI check failed"))
      .finally(() => setLoading(false));
  }, [open, text, kind]);

  const handleConfirm = async () => {
    if (!result) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-pending-term", {
        body: { text, kind },
      });
      if (error) throw error;
      const r = data as {
        status: "stored" | "matched" | "rejected_phi";
        stored_redacted_text?: string;
        match?: { code_id: string; code: string; code_system: string; display: string; alias_id: string; score: number };
        message?: string;
      };
      if (r.status === "rejected_phi") {
        toast({ title: "Cannot save", description: r.message, variant: "destructive" });
        return;
      }
      if (r.status === "matched" && r.match) {
        toast({ title: "Matched existing term", description: r.match.display });
        onConfirmed({
          stored: false,
          redacted_text: r.stored_redacted_text ?? "",
          matched: {
            source: "alias",
            code_id: r.match.code_id,
            alias_id: r.match.alias_id,
            display: r.match.display,
            code: r.match.code,
            code_system: r.match.code_system,
            score: r.match.score,
          },
        });
        return;
      }
      toast({ title: "Submitted for review" });
      onConfirmed({ stored: true, redacted_text: r.stored_redacted_text ?? result.redacted_text });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not submit";
      toast({ title: "Submission failed", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const segments = result ? highlightSpans(text, result.spans) : [];
  const totalRedactions = result ? Object.values(result.counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Review your submission</DialogTitle>
          <DialogDescription>
            We never store the original text. Only the redacted version below is saved.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking for personal info…
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div>
              <div className="font-medium">PHI check failed</div>
              <div className="text-xs">{error}</div>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">As you typed it</div>
              <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm">
                {segments.map((seg, i) =>
                  seg.type ? (
                    <mark key={i} className="rounded bg-destructive/20 px-1 text-destructive">{seg.text}</mark>
                  ) : (
                    <span key={i}>{seg.text}</span>
                  ),
                )}
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" /> What we'll save
              </div>
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 font-mono text-sm">
                {result.redacted_text}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Redactions:</span>
              {totalRedactions === 0 && <span className="text-muted-foreground">none</span>}
              {Object.entries(result.counts).map(([t, n]) =>
                n > 0 ? (
                  <Badge key={t} variant="outline" className="text-[10px]">
                    {t}: {n}
                  </Badge>
                ) : null,
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>Edit</Button>
          <Button onClick={handleConfirm} disabled={!result || !!error || submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirm & submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
