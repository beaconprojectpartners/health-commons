import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Save } from "lucide-react";

type DraftJson = {
  criteria?: Array<{ name: string; description?: string; source?: string }>;
  labs?: Array<{ name: string; typical_range?: string; rationale?: string }>;
  imaging?: Array<{ modality: string; findings?: string; rationale?: string }>;
  scoring_tools?: Array<{ name: string; use?: string; reference?: string }>;
  citation?: string;
};

const NewProfile = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [conditionId, setConditionId] = useState<string>("");
  const [conditionName, setConditionName] = useState<string>("");
  const [icd10, setIcd10] = useState("");
  const [notes, setNotes] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<DraftJson | null>(null);
  const [citation, setCitation] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate("/auth?next=/specialists/profiles/new");
  }, [user, loading, navigate]);

  const { data: conditions } = useQuery({
    queryKey: ["conditions-for-profile"],
    queryFn: async () => {
      const { data } = await supabase.from("conditions").select("id, name").order("name").limit(500);
      return data ?? [];
    },
  });

  const generate = async () => {
    if (!conditionName.trim()) {
      toast({ title: "Pick a condition", variant: "destructive" });
      return;
    }
    setDrafting(true);
    try {
      const { data, error } = await supabase.functions.invoke("claude-profile-draft", {
        body: { condition_name: conditionName, icd10_code: icd10 || undefined, notes: notes || undefined },
      });
      if (error) throw error;
      const json = (data?.draft ?? data) as DraftJson;
      setDraft(json);
      setCitation(json.citation ?? "");
    } catch (e) {
      toast({ title: "Draft failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDrafting(false);
    }
  };

  const save = async () => {
    if (!conditionId) return toast({ title: "Pick an existing condition to attach", variant: "destructive" });
    if (!draft) return toast({ title: "Generate a draft first", variant: "destructive" });
    setSaving(true);
    const { error } = await supabase.from("disease_profiles").insert({
      condition_id: conditionId,
      criteria: draft.criteria ?? [],
      labs: draft.labs ?? [],
      imaging: draft.imaging ?? [],
      scoring_tools: draft.scoring_tools ?? [],
      contributor_id: user!.id,
      citation: citation || draft.citation || null,
      status: "pending",
    });
    setSaving(false);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: "Profile submitted for review" });
    navigate("/specialists");
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <section className="flex-1 py-10">
        <div className="container mx-auto max-w-3xl px-4">
          <h1 className="font-heading text-3xl text-foreground mb-2">Author disease profile</h1>
          <p className="mb-6 text-sm text-muted-foreground">Generate a draft with Claude, then edit and submit. Profiles enter the queue for peer review before publishing.</p>

          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base">1. Identify the condition</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Existing condition (where the profile will attach)</Label>
                <Select value={conditionId} onValueChange={(v) => {
                  setConditionId(v);
                  const c = (conditions ?? []).find((x) => x.id === v);
                  if (c) setConditionName(c.name);
                }}>
                  <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
                  <SelectContent>
                    {(conditions ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Condition name (for the draft prompt)</Label>
                  <Input value={conditionName} onChange={(e) => setConditionName(e.target.value)} placeholder="e.g. Mast Cell Activation Syndrome" />
                </div>
                <div>
                  <Label>ICD-10 (optional)</Label>
                  <Input value={icd10} onChange={(e) => setIcd10(e.target.value)} placeholder="D89.40" />
                </div>
              </div>
              <div>
                <Label>Author notes (optional, sent to Claude)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Anything Claude should weight: guideline, pediatric vs adult, region…" />
              </div>
              <Button onClick={generate} disabled={drafting} className="bg-fuchsia-500 text-white hover:bg-fuchsia-500/90">
                {drafting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generate draft
              </Button>
            </CardContent>
          </Card>

          {draft && (
            <Card className="mb-4">
              <CardHeader><CardTitle className="text-base">2. Review & edit</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {(["criteria", "labs", "imaging", "scoring_tools"] as const).map((section) => (
                  <div key={section}>
                    <Label className="capitalize">{section.replace("_", " ")}</Label>
                    <Textarea
                      rows={6}
                      className="font-mono text-xs"
                      value={JSON.stringify(draft[section] ?? [], null, 2)}
                      onChange={(e) => {
                        try {
                          const next = JSON.parse(e.target.value);
                          setDraft({ ...draft, [section]: next });
                        } catch {
                          // ignore until valid JSON
                        }
                      }}
                    />
                  </div>
                ))}
                <div>
                  <Label>Citation</Label>
                  <Input value={citation} onChange={(e) => setCitation(e.target.value)} />
                </div>
                <Button onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Submit for review
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default NewProfile;