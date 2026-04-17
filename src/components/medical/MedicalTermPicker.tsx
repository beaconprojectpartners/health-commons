import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PickedTerm {
  raw_text: string;             // original user text (kept ONLY in browser state)
  code_id?: string | null;      // resolved canonical code (if matched)
  alias_id?: string | null;
  display?: string;             // canonical display from a match
  pending_code_entry_id?: string | null; // set if "added new" returned stored
  redacted_text?: string;       // if pending, this is the on-server redaction
  status: "matched" | "pending" | "unresolved";
}

interface Candidate {
  source: "code" | "alias";
  code_id: string;
  alias_id?: string;
  display: string;
  code: string;
  code_system: string;
  score: number;
}

interface Props {
  value: PickedTerm;
  onChange: (next: PickedTerm) => void;
  kind: "symptom" | "treatment" | "condition" | "finding" | "procedure" | "medication";
  placeholder?: string;
  onRequestPreview: (text: string, onConfirm: (result: { stored: boolean; redacted_text: string; matched?: Candidate }) => void) => void;
}

export function MedicalTermPicker({ value, onChange, kind, placeholder, onRequestPreview }: Props) {
  const [text, setText] = useState(value.raw_text);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    setText(value.raw_text);
  }, [value.raw_text]);

  useEffect(() => {
    if (!text || text.trim().length < 2 || value.code_id) {
      setCandidates([]);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await supabase.functions.invoke("resolve-medical-term", {
          body: { text: text.trim(), kind },
        });
        setCandidates((data as { candidates?: Candidate[] })?.candidates ?? []);
        setOpen(true);
      } catch {
        setCandidates([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [text, kind, value.code_id]);

  const pickCandidate = (c: Candidate) => {
    onChange({
      raw_text: c.display,
      code_id: c.code_id,
      alias_id: c.alias_id ?? null,
      display: c.display,
      status: "matched",
    });
    setText(c.display);
    setCandidates([]);
    setOpen(false);
  };

  const clearPick = () => {
    onChange({ raw_text: "", status: "unresolved" });
    setText("");
    setCandidates([]);
    setOpen(false);
  };

  const handleAddNew = () => {
    if (!text.trim()) return;
    onRequestPreview(text.trim(), (result) => {
      if (result.matched) {
        pickCandidate(result.matched);
        return;
      }
      if (result.stored) {
        onChange({
          raw_text: text.trim(),
          code_id: null,
          status: "pending",
          redacted_text: result.redacted_text,
        });
        setOpen(false);
      }
    });
  };

  // Matched/pending state — show chip
  if (value.code_id) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
        <Check className="h-4 w-4 text-primary" />
        <span className="text-sm text-foreground">{value.display ?? value.raw_text}</span>
        <Badge variant="secondary" className="text-[10px]">Matched</Badge>
        <button type="button" onClick={clearPick} className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Clear">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }
  if (value.status === "pending") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-accent bg-accent/10 px-3 py-2">
        <span className="text-sm text-foreground">{value.raw_text}</span>
        <Badge variant="outline" className="text-[10px]">Pending review</Badge>
        <button type="button" onClick={clearPick} className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Clear">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onChange({ ...value, raw_text: e.target.value, status: "unresolved" });
          }}
          onFocus={() => candidates.length > 0 && setOpen(true)}
          placeholder={placeholder}
        />
        {searching && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {open && (candidates.length > 0 || text.trim().length >= 2) && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
          {candidates.map((c) => (
            <button
              key={`${c.code_id}-${c.alias_id ?? "code"}`}
              type="button"
              onClick={() => pickCandidate(c)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
            >
              <span className="truncate text-foreground">{c.display}</span>
              <span className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{c.code_system} · {c.code}</span>
                <span className={cn("h-2 w-2 rounded-full", c.score > 0.9 ? "bg-primary" : c.score > 0.75 ? "bg-accent" : "bg-muted-foreground")} />
              </span>
            </button>
          ))}
          <div className="border-t border-border">
            <button
              type="button"
              onClick={handleAddNew}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary hover:bg-secondary"
            >
              <Plus className="h-4 w-4" />
              Add &ldquo;{text.trim()}&rdquo; for review
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
