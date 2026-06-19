import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, BookOpen } from "lucide-react";

const Aliases = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [locale, setLocale] = useState("en");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth?next=/specialists/aliases");
  }, [user, loading, navigate]);

  const { data: codes } = useQuery({
    queryKey: ["medical-codes-search", search],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const q = search.trim();
      const { data } = await supabase
        .from("medical_codes")
        .select("id, code, display, code_system, specialty_scope")
        .or(`display.ilike.%${q}%,code.ilike.%${q}%`)
        .is("retired_at", null)
        .limit(25);
      return data ?? [];
    },
  });

  const selectedCode = useMemo(
    () => (codes ?? []).find((c) => c.id === selectedCodeId) ?? null,
    [codes, selectedCodeId],
  );

  const { data: mine } = useQuery({
    queryKey: ["my-aliases", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("code_aliases")
        .select("id, label, locale, status, created_at, medical_code_id, medical_codes(code, display)")
        .eq("created_by", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const propose = async () => {
    if (!user || !selectedCodeId || !label.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("code_aliases").insert({
      medical_code_id: selectedCodeId,
      label: label.trim(),
      locale,
      created_by: user.id,
      status: "pending",
    });
    setSubmitting(false);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Alias proposed" });
    setLabel("");
    qc.invalidateQueries({ queryKey: ["my-aliases"] });
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <section className="flex-1 py-10">
        <div className="container mx-auto max-w-3xl px-4">
          <h1 className="font-heading text-3xl text-foreground mb-2 flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-fuchsia-500" />
            Propose code aliases
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">Aliases give patients lay-language and synonym entry points to medical codes. Proposals must be in-scope and enter the review queue.</p>

          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base">1. Find a code</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Search by code or display (e.g. POTS, I49.8)" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="max-h-64 space-y-1 overflow-auto">
                {(codes ?? []).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCodeId(c.id)}
                    className={`block w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      selectedCodeId === c.id ? "border-fuchsia-500 bg-fuchsia-500/5" : "border-border hover:border-fuchsia-500/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">{c.code_system} · {c.code}</span>
                      {(c.specialty_scope ?? []).length > 0 && (
                        <Badge variant="outline" className="text-[10px]">{(c.specialty_scope ?? []).length} scope</Badge>
                      )}
                    </div>
                    <div>{c.display}</div>
                  </button>
                ))}
                {search.length >= 2 && (codes ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">No matches.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {selectedCode && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-base">2. Propose alias for {selectedCode.display}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                  <div>
                    <Label>Alias label</Label>
                    <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. dysautonomia (lay)" />
                  </div>
                  <div>
                    <Label>Locale</Label>
                    <Input value={locale} onChange={(e) => setLocale(e.target.value)} maxLength={5} />
                  </div>
                </div>
                <Button onClick={propose} disabled={submitting || !label.trim()} className="bg-fuchsia-500 text-white hover:bg-fuchsia-500/90">
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit proposal
                </Button>
                <p className="text-xs text-muted-foreground">If the code is in your specialty scope and you are Core+, it may apply directly; otherwise it queues for moderation.</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Your recent proposals</CardTitle></CardHeader>
            <CardContent>
              {(mine ?? []).length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
              <ul className="space-y-2 text-sm">
                {(mine ?? []).map((a) => (
                  <li key={a.id} className="flex items-center justify-between rounded border border-border px-3 py-2">
                    <div>
                      <div className="font-medium">{a.label} <span className="text-xs text-muted-foreground">({a.locale})</span></div>
                      <div className="text-xs text-muted-foreground">
                        {(a as unknown as { medical_codes?: { code: string; display: string } }).medical_codes?.display ?? a.medical_code_id}
                      </div>
                    </div>
                    <Badge variant={a.status === "approved" ? "default" : a.status === "rejected" ? "destructive" : "secondary"}>{a.status}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Aliases;