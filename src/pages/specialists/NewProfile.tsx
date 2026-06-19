import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Plus, Trash2, Send } from "lucide-react";

type Criterion = { name: string; description: string; source?: string };
type Lab = { name: string; typical_range?: string; rationale?: string };
type Imaging = { modality: string; findings?: string; rationale?: string };
type ScoringTool = { name: string; use?: string; reference?: string };

// Required minimums to publish a draft profile:
//  - attach to a condition (existing or newly created)
//  - >= 1 diagnostic criterion with name + description
//  - >= 1 lab OR imaging entry with a name/modality
//  - citation (guideline + year, free text)
const ProfileSchema = z.object({
  condition_id: z.string().uuid({ message: "Pick or create a condition" }),
  citation: z.string().trim().min(8, "Citation required (guideline + year)").max(500),
  summary: z.string().trim().min(20, "Add a short clinical summary (≥20 chars)").max(2000),
  criteria: z.array(z.object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(1000),
    source: z.string().trim().max(200).optional(),
  })).min(1, "Add at least one diagnostic criterion"),
  labs: z.array(z.object({
    name: z.string().trim().max(200),
    typical_range: z.string().trim().max(200).optional(),
    rationale: z.string().trim().max(500).optional(),
  })),
  imaging: z.array(z.object({
    modality: z.string().trim().max(200),
    findings: z.string().trim().max(500).optional(),
    rationale: z.string().trim().max(500).optional(),
  })),
  scoring_tools: z.array(z.object({
    name: z.string().trim().max(200),
    use: z.string().trim().max(500).optional(),
    reference: z.string().trim().max(200).optional(),
  })),
}).refine(
  (v) => v.labs.some((l) => l.name.length > 0) || v.imaging.some((i) => i.modality.length > 0),
  { message: "Add at least one lab or imaging finding", path: ["labs"] },
);

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

const NewProfile = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // condition selection
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [conditionId, setConditionId] = useState<string>("");
  const [conditionName, setConditionName] = useState("");
  const [newConditionName, setNewConditionName] = useState("");
  const [newConditionIcd10, setNewConditionIcd10] = useState("");

  // profile fields
  const [summary, setSummary] = useState("");
  const [citation, setCitation] = useState("");
  const [criteria, setCriteria] = useState<Criterion[]>([{ name: "", description: "", source: "" }]);
  const [labs, setLabs] = useState<Lab[]>([{ name: "", typical_range: "", rationale: "" }]);
  const [imaging, setImaging] = useState<Imaging[]>([{ modality: "", findings: "", rationale: "" }]);
  const [scoringTools, setScoringTools] = useState<ScoringTool[]>([]);

  const [drafting, setDrafting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !user) navigate("/auth?next=/specialists/profiles/new");
  }, [user, loading, navigate]);

  const { data: conditions } = useQuery({
    queryKey: ["conditions-for-profile"],
    queryFn: async () => {
      const { data } = await supabase
        .from("conditions").select("id, name, icd10_code").order("name").limit(500);
      return data ?? [];
    },
  });

  const promptName = useMemo(
    () => (mode === "new" ? newConditionName : conditionName),
    [mode, newConditionName, conditionName],
  );

  const generateDraft = async () => {
    if (!promptName.trim()) {
      toast({ title: "Enter a condition name first", variant: "destructive" });
      return;
    }
    setDrafting(true);
    try {
      const { data, error } = await supabase.functions.invoke("claude-profile-draft", {
        body: {
          condition_name: promptName,
          icd10_code: mode === "new" ? newConditionIcd10 || undefined : undefined,
        },
      });
      if (error) throw error;
      const d = (data?.draft ?? data) as {
        criteria?: Criterion[]; labs?: Lab[]; imaging?: Imaging[];
        scoring_tools?: ScoringTool[]; citation?: string;
      };
      if (d.criteria?.length) setCriteria(d.criteria);
      if (d.labs?.length) setLabs(d.labs);
      if (d.imaging?.length) setImaging(d.imaging);
      if (d.scoring_tools?.length) setScoringTools(d.scoring_tools);
      if (d.citation) setCitation(d.citation);
      toast({ title: "Draft generated", description: "Review and edit before publishing." });
    } catch (e) {
      toast({ title: "Draft failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDrafting(false);
    }
  };

  const ensureConditionId = async (): Promise<string | null> => {
    if (mode === "existing") return conditionId || null;
    const name = newConditionName.trim();
    if (!name) return null;
    // dedupe by name
    const { data: existing } = await supabase
      .from("conditions").select("id").eq("name", name).maybeSingle();
    if (existing?.id) return existing.id;
    const { data, error } = await supabase.from("conditions").insert({
      name,
      slug: slugify(name) || crypto.randomUUID().slice(0, 8),
      icd10_code: newConditionIcd10.trim() || null,
      created_by: user!.id,
      approved: false,
    }).select("id").single();
    if (error) {
      toast({ title: "Could not create condition", description: error.message, variant: "destructive" });
      return null;
    }
    return data.id;
  };

  const publishDraft = async () => {
    setErrors({});
    setPublishing(true);
    try {
      const condId = await ensureConditionId();
      if (!condId) {
        setErrors({ condition_id: "Pick or create a condition" });
        setPublishing(false);
        return;
      }

      const payload = {
        condition_id: condId,
        citation: citation.trim(),
        summary: summary.trim(),
        criteria: criteria.filter((c) => c.name.trim() || c.description.trim()),
        labs: labs.filter((l) => l.name.trim()),
        imaging: imaging.filter((i) => i.modality.trim()),
        scoring_tools: scoringTools.filter((s) => s.name.trim()),
      };

      const parsed = ProfileSchema.safeParse(payload);
      if (!parsed.success) {
        const errMap: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          errMap[issue.path.join(".") || "form"] = issue.message;
        }
        setErrors(errMap);
        toast({
          title: "Missing required fields",
          description: Object.values(errMap)[0],
          variant: "destructive",
        });
        setPublishing(false);
        return;
      }

      // Compute next version for this condition
      const { data: versions } = await supabase
        .from("disease_profiles")
        .select("version")
        .eq("condition_id", condId)
        .order("version", { ascending: false })
        .limit(1);
      const nextVersion = (versions?.[0]?.version ?? 0) + 1;

      const { data: inserted, error: insErr } = await supabase
        .from("disease_profiles").insert({
          condition_id: condId,
          version: nextVersion,
          criteria: parsed.data.criteria,
          labs: parsed.data.labs,
          imaging: parsed.data.imaging,
          scoring_tools: parsed.data.scoring_tools,
          citation: [parsed.data.citation, `Summary: ${parsed.data.summary}`].join(" — "),
          contributor_id: user!.id,
          status: "pending",
        }).select("id").single();
      if (insErr) throw insErr;

      // Public transparency log entry
      await supabase.from("vocabulary_edit_log").insert({
        actor_id: user!.id,
        target_type: "disease_profile",
        target_id: inserted.id,
        action: "create",
        payload: { condition_id: condId, version: nextVersion },
        reason: "Specialist published draft profile",
      });

      toast({
        title: `Draft v${nextVersion} published for review`,
        description: "It will appear publicly once peer-approved.",
      });
      navigate("/specialists");
    } catch (e) {
      toast({ title: "Publish failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <section className="flex-1 py-10">
        <div className="container mx-auto max-w-3xl px-4">
          <h1 className="font-heading text-3xl text-foreground mb-2">Author disease profile</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Required: a condition, a clinical summary, ≥1 diagnostic criterion, ≥1 lab or imaging finding, and a citation.
            Drafts are versioned per condition and submitted for peer review before publishing.
          </p>

          {/* 1. Condition */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">1. Condition</CardTitle>
              <CardDescription>Attach the profile to an existing condition, or create a new one.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={mode} onValueChange={(v) => setMode(v as "existing" | "new")}>
                <TabsList className="mb-3">
                  <TabsTrigger value="existing">Existing</TabsTrigger>
                  <TabsTrigger value="new">Create new</TabsTrigger>
                </TabsList>
                <TabsContent value="existing" className="space-y-2">
                  <Label>Condition</Label>
                  <Select value={conditionId} onValueChange={(v) => {
                    setConditionId(v);
                    setConditionName((conditions ?? []).find((c) => c.id === v)?.name ?? "");
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
                    <SelectContent>
                      {(conditions ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{c.icd10_code ? ` — ${c.icd10_code}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TabsContent>
                <TabsContent value="new" className="grid gap-3 sm:grid-cols-[1fr_160px]">
                  <div>
                    <Label>Condition name *</Label>
                    <Input value={newConditionName} onChange={(e) => setNewConditionName(e.target.value)} maxLength={120} placeholder="e.g. Mast Cell Activation Syndrome" />
                  </div>
                  <div>
                    <Label>ICD-10 (optional)</Label>
                    <Input value={newConditionIcd10} onChange={(e) => setNewConditionIcd10(e.target.value)} maxLength={20} placeholder="D89.40" />
                  </div>
                </TabsContent>
              </Tabs>
              {errors.condition_id && <p className="mt-2 text-xs text-destructive">{errors.condition_id}</p>}
            </CardContent>
          </Card>

          {/* 2. Summary + citation + AI assist */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">2. Clinical summary & citation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Summary * <span className="text-xs text-muted-foreground">(≥20 chars)</span></Label>
                <Textarea rows={3} value={summary} maxLength={2000} onChange={(e) => setSummary(e.target.value)} placeholder="One-paragraph clinical overview: pathophysiology, who, key differentials." />
                {errors.summary && <p className="mt-1 text-xs text-destructive">{errors.summary}</p>}
              </div>
              <div>
                <Label>Citation *</Label>
                <Input value={citation} maxLength={500} onChange={(e) => setCitation(e.target.value)} placeholder="e.g. AAAAI/WAO 2020 MCAS consensus" />
                {errors.citation && <p className="mt-1 text-xs text-destructive">{errors.citation}</p>}
              </div>
              <Button type="button" variant="outline" onClick={generateDraft} disabled={drafting}>
                {drafting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Pre-fill criteria/labs with AI
              </Button>
            </CardContent>
          </Card>

          {/* 3. Criteria */}
          <RowSection
            title="3. Diagnostic criteria *"
            description="At least one required (name + description)."
            error={errors["criteria"] || errors["criteria.0.name"] || errors["criteria.0.description"]}
            rows={criteria}
            onAdd={() => setCriteria([...criteria, { name: "", description: "", source: "" }])}
            onRemove={(i) => setCriteria(criteria.filter((_, idx) => idx !== i))}
            render={(row, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_1fr]">
                <Input placeholder="Criterion" value={row.name} maxLength={200} onChange={(e) => updateAt(criteria, setCriteria, i, { name: e.target.value })} />
                <Input placeholder="Description" value={row.description} maxLength={1000} onChange={(e) => updateAt(criteria, setCriteria, i, { description: e.target.value })} />
                <Input placeholder="Source (optional)" value={row.source ?? ""} maxLength={200} onChange={(e) => updateAt(criteria, setCriteria, i, { source: e.target.value })} />
              </div>
            )}
          />

          {/* 4. Labs */}
          <RowSection
            title="4. Labs"
            description="Add at least one lab or imaging finding."
            error={errors["labs"]}
            rows={labs}
            onAdd={() => setLabs([...labs, { name: "", typical_range: "", rationale: "" }])}
            onRemove={(i) => setLabs(labs.filter((_, idx) => idx !== i))}
            render={(row, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-3">
                <Input placeholder="Lab name" value={row.name} maxLength={200} onChange={(e) => updateAt(labs, setLabs, i, { name: e.target.value })} />
                <Input placeholder="Typical range" value={row.typical_range ?? ""} maxLength={200} onChange={(e) => updateAt(labs, setLabs, i, { typical_range: e.target.value })} />
                <Input placeholder="Rationale" value={row.rationale ?? ""} maxLength={500} onChange={(e) => updateAt(labs, setLabs, i, { rationale: e.target.value })} />
              </div>
            )}
          />

          {/* 5. Imaging */}
          <RowSection
            title="5. Imaging"
            description="Optional if labs are provided."
            rows={imaging}
            onAdd={() => setImaging([...imaging, { modality: "", findings: "", rationale: "" }])}
            onRemove={(i) => setImaging(imaging.filter((_, idx) => idx !== i))}
            render={(row, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-3">
                <Input placeholder="Modality (MRI, CT…)" value={row.modality} maxLength={200} onChange={(e) => updateAt(imaging, setImaging, i, { modality: e.target.value })} />
                <Input placeholder="Findings" value={row.findings ?? ""} maxLength={500} onChange={(e) => updateAt(imaging, setImaging, i, { findings: e.target.value })} />
                <Input placeholder="Rationale" value={row.rationale ?? ""} maxLength={500} onChange={(e) => updateAt(imaging, setImaging, i, { rationale: e.target.value })} />
              </div>
            )}
          />

          {/* 6. Scoring tools (optional) */}
          <RowSection
            title="6. Scoring tools (optional)"
            rows={scoringTools}
            onAdd={() => setScoringTools([...scoringTools, { name: "", use: "", reference: "" }])}
            onRemove={(i) => setScoringTools(scoringTools.filter((_, idx) => idx !== i))}
            render={(row, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-3">
                <Input placeholder="Tool name" value={row.name} maxLength={200} onChange={(e) => updateAt(scoringTools, setScoringTools, i, { name: e.target.value })} />
                <Input placeholder="Use" value={row.use ?? ""} maxLength={500} onChange={(e) => updateAt(scoringTools, setScoringTools, i, { use: e.target.value })} />
                <Input placeholder="Reference" value={row.reference ?? ""} maxLength={200} onChange={(e) => updateAt(scoringTools, setScoringTools, i, { reference: e.target.value })} />
              </div>
            )}
          />

          <div className="mt-6 flex items-center justify-between">
            <Badge variant="outline">Status on publish: pending review</Badge>
            <Button onClick={publishDraft} disabled={publishing} className="bg-fuchsia-500 text-white hover:bg-fuchsia-500/90">
              {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Publish draft
            </Button>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

function updateAt<T>(rows: T[], setRows: (r: T[]) => void, i: number, patch: Partial<T>) {
  const next = rows.slice();
  next[i] = { ...next[i], ...patch };
  setRows(next);
}

type RowSectionProps<T> = {
  title: string;
  description?: string;
  error?: string;
  rows: T[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  render: (row: T, i: number) => React.ReactNode;
};

function RowSection<T>({ title, description, error, rows, onAdd, onRemove, render }: RowSectionProps<T>) {
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1">{render(row, i)}</div>
            <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(i)} aria-label="Remove row">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="mr-1 h-3 w-3" /> Add row
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

export default NewProfile;