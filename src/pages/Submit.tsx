import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { MedicalTermPicker, type PickedTerm } from "@/components/medical/MedicalTermPicker";
import { PhiPreviewModal } from "@/components/medical/PhiPreviewModal";

const STEPS = ["Condition", "Symptoms", "Treatment", "Demographics", "Quality of Life", "Review"];

const Submit = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [existingSubmissionId, setExistingSubmissionId] = useState<string | null>(null);
  const [hasLoadedExisting, setHasLoadedExisting] = useState(false);

  // Form state
  const [conditionId, setConditionId] = useState(searchParams.get("condition") || "");
  const [diagnosisStatus, setDiagnosisStatus] = useState("");
  const [yearOfDiagnosis, setYearOfDiagnosis] = useState("");
  const [timeTodiagnosis, setTimeTodiagnosis] = useState("");
  const [providersCount, setProvidersCount] = useState("");
  const [misdiagnoses, setMisdiagnoses] = useState("");

  // Symptoms
  const [symptoms, setSymptoms] = useState<Array<{ name: string; severity: string; frequency: string; bodySystem: string; picked: PickedTerm }>>([
    { name: "", severity: "5", frequency: "", bodySystem: "", picked: { raw_text: "", status: "unresolved" } },
  ]);

  // Treatment
  const [treatments, setTreatments] = useState<Array<{ name: string; type: string; effectiveness: string; stillUsing: string; sideEffects: string; picked: PickedTerm }>>([
    { name: "", type: "", effectiveness: "5", stillUsing: "", sideEffects: "", picked: { raw_text: "", status: "unresolved" } },
  ]);

  // PHI preview modal state
  const [phiPreview, setPhiPreview] = useState<{
    open: boolean;
    text: string;
    kind: "symptom" | "treatment";
    onConfirm: ((r: { stored: boolean; redacted_text: string; matched?: { source: "code" | "alias"; code_id: string; alias_id?: string; display: string; code: string; code_system: string; score: number } }) => void) | null;
  }>({ open: false, text: "", kind: "symptom", onConfirm: null });

  // Demographics
  const [ageRange, setAgeRange] = useState("");
  const [biologicalSex, setBiologicalSex] = useState("");
  const [country, setCountry] = useState("");
  const [workImpact, setWorkImpact] = useState("");
  const [painAvg, setPainAvg] = useState("5");
  const [fatigueAvg, setFatigueAvg] = useState("5");
  const [mentalHealthImpact, setMentalHealthImpact] = useState("5");

  // Sharing
  const [sharingPref, setSharingPref] = useState("anonymized_public");
  const [submitterType, setSubmitterType] = useState("patient");

  const { data: conditions } = useQuery({
    queryKey: ["conditions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("conditions").select("*").eq("approved", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  // Pull the user's profile conditions for prefill + chips
  const { data: myProfile } = useQuery({
    queryKey: ["my-profile-conditions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_profiles")
        .select("id, sharing_mode, condition_ids")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const myConditionIds: string[] = (myProfile?.condition_ids as string[] | null) || [];
  const myConditions = conditions?.filter((c) => myConditionIds.includes(c.id)) || [];

  // Prefill condition picker from profile (only if nothing already selected)
  useEffect(() => {
    if (!conditionId && myConditionIds.length > 0) {
      setConditionId(myConditionIds[0]);
    }
  }, [myConditionIds.join(","), conditionId]);

  // Load existing submission for this user + condition (so editing updates instead of creating new)
  const { data: existingSubmission } = useQuery({
    queryKey: ["existing-submission", user?.id, conditionId],
    enabled: !!user && !!conditionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("id, universal_fields, sharing_preference")
        .eq("submitter_account_id", user!.id)
        .eq("condition_id", conditionId)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Reset prefill state when the condition changes
  useEffect(() => {
    setHasLoadedExisting(false);
    setExistingSubmissionId(null);
  }, [conditionId]);

  // Hydrate form state from existing submission once
  useEffect(() => {
    if (hasLoadedExisting || !conditionId) return;
    if (existingSubmission === undefined) return; // still loading
    if (existingSubmission === null) {
      setHasLoadedExisting(true);
      return;
    }
    const u: any = existingSubmission.universal_fields || {};
    setExistingSubmissionId(existingSubmission.id);
    setDiagnosisStatus(u.diagnosis_status || "");
    setYearOfDiagnosis(u.year_of_diagnosis || "");
    setTimeTodiagnosis(u.time_to_diagnosis || "");
    setProvidersCount(u.providers_count || "");
    setMisdiagnoses(u.misdiagnoses || "");
    setSymptoms(
      Array.isArray(u.symptoms) && u.symptoms.length > 0
        ? u.symptoms.map((s: any) => ({
            name: s.name || "",
            severity: s.severity || "5",
            frequency: s.frequency || "",
            bodySystem: s.bodySystem || "",
            picked: { raw_text: s.name || "", code_id: s.code_id ?? null, status: (s.code_id ? "matched" : s.pending_code_entry_id ? "pending" : "unresolved") } as PickedTerm,
          }))
        : [{ name: "", severity: "5", frequency: "", bodySystem: "", picked: { raw_text: "", status: "unresolved" } }],
    );
    setTreatments(
      Array.isArray(u.treatments) && u.treatments.length > 0
        ? u.treatments.map((t: any) => ({
            name: t.name || "",
            type: t.type || "",
            effectiveness: t.effectiveness || "5",
            stillUsing: t.stillUsing || "",
            sideEffects: t.sideEffects || "",
            picked: { raw_text: t.name || "", code_id: t.code_id ?? null, status: (t.code_id ? "matched" : t.pending_code_entry_id ? "pending" : "unresolved") } as PickedTerm,
          }))
        : [{ name: "", type: "", effectiveness: "5", stillUsing: "", sideEffects: "", picked: { raw_text: "", status: "unresolved" } }],
    );
    const d = u.demographics || {};
    setAgeRange(d.age_range || "");
    setBiologicalSex(d.biological_sex || "");
    setCountry(d.country || "");
    const q = u.quality_of_life || {};
    setWorkImpact(q.work_impact || "");
    setPainAvg(q.pain_avg || "5");
    setFatigueAvg(q.fatigue_avg || "5");
    setMentalHealthImpact(q.mental_health_impact || "5");
    setSubmitterType(u.submitter_type || "patient");
    if (existingSubmission.sharing_preference) setSharingPref(existingSubmission.sharing_preference);
    setHasLoadedExisting(true);
  }, [existingSubmission, hasLoadedExisting, conditionId]);

  const progress = ((step + 1) / STEPS.length) * 100;
  const selectedCondition = conditions?.find((c) => c.id === conditionId);
  const submittedConditionInProfile = selectedCondition && myConditionIds.includes(selectedCondition.id);
  const [addingToProfile, setAddingToProfile] = useState(false);
  const [addedToProfile, setAddedToProfile] = useState(false);

  const handleAddConditionToProfile = async () => {
    if (!user || !selectedCondition) return;
    setAddingToProfile(true);
    try {
      if (myProfile) {
        const newIds = Array.from(new Set([...(myProfile.condition_ids || []), selectedCondition.id]));
        const { error } = await supabase
          .from("patient_profiles")
          .update({ condition_ids: newIds })
          .eq("id", myProfile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("patient_profiles").insert({
          user_id: user.id,
          sharing_mode: "anonymous",
          condition_ids: [selectedCondition.id],
        });
        if (error) throw error;
      }
      setAddedToProfile(true);
      toast({ title: "Added to your profile" });
    } catch (e: any) {
      console.error("[Submit] add condition to profile error:", e);
      toast({ title: "Could not add to profile", variant: "destructive" });
    } finally {
      setAddingToProfile(false);
    }
  };

  const addSymptom = () => setSymptoms([...symptoms, { name: "", severity: "5", frequency: "", bodySystem: "", picked: { raw_text: "", status: "unresolved" } }]);
  const addTreatment = () => setTreatments([...treatments, { name: "", type: "", effectiveness: "5", stillUsing: "", sideEffects: "", picked: { raw_text: "", status: "unresolved" } }]);

  const updateSymptom = (i: number, field: string, value: string) => {
    const updated = [...symptoms];
    (updated[i] as any)[field] = value;
    setSymptoms(updated);
  };

  const updateTreatment = (i: number, field: string, value: string) => {
    const updated = [...treatments];
    (updated[i] as any)[field] = value;
    setTreatments(updated);
  };

  const updateSymptomPicked = (i: number, picked: PickedTerm) => {
    const updated = [...symptoms];
    updated[i] = { ...updated[i], picked, name: picked.raw_text };
    setSymptoms(updated);
  };
  const updateTreatmentPicked = (i: number, picked: PickedTerm) => {
    const updated = [...treatments];
    updated[i] = { ...updated[i], picked, name: picked.raw_text };
    setTreatments(updated);
  };

  const requestPhiPreview = (kind: "symptom" | "treatment") => (text: string, onConfirm: (r: { stored: boolean; redacted_text: string; matched?: { source: "code" | "alias"; code_id: string; alias_id?: string; display: string; code: string; code_system: string; score: number } }) => void) => {
    setPhiPreview({ open: true, text, kind, onConfirm });
  };

  const handleSubmit = async () => {
    if (!conditionId) {
      toast({ title: "Please select a condition", variant: "destructive" });
      return;
    }

    const universalFields = {
      diagnosis_status: diagnosisStatus,
      year_of_diagnosis: yearOfDiagnosis,
      time_to_diagnosis: timeTodiagnosis,
      providers_count: providersCount,
      misdiagnoses,
      symptoms: symptoms
        .filter((s) => s.name)
        .map((s) => ({
          name: s.name,
          severity: s.severity,
          frequency: s.frequency,
          bodySystem: s.bodySystem,
          code_id: s.picked.code_id ?? null,
          alias_id: s.picked.alias_id ?? null,
        })),
      treatments: treatments
        .filter((t) => t.name)
        .map((t) => ({
          name: t.name,
          type: t.type,
          effectiveness: t.effectiveness,
          stillUsing: t.stillUsing,
          sideEffects: t.sideEffects,
          code_id: t.picked.code_id ?? null,
          alias_id: t.picked.alias_id ?? null,
        })),
      demographics: { age_range: ageRange, biological_sex: biologicalSex, country },
      quality_of_life: { work_impact: workImpact, pain_avg: painAvg, fatigue_avg: fatigueAvg, mental_health_impact: mentalHealthImpact },
      submitter_type: submitterType,
    };

    let error: any = null;
    if (existingSubmissionId) {
      const res = await supabase
        .from("submissions")
        .update({
          universal_fields: universalFields,
          sharing_preference: sharingPref,
        })
        .eq("id", existingSubmissionId);
      error = res.error;
    } else {
      const res = await supabase.from("submissions").insert({
        condition_id: conditionId,
        universal_fields: universalFields,
        sharing_preference: sharingPref,
        submitter_account_id: user?.id || null,
      });
      error = res.error;
    }

    if (error) {
      console.error("[Submit] save error:", error);
      toast({ title: "Submission failed", description: "Please try again. Contact support if the issue persists.", variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["my-profile-conditions"] });
      queryClient.invalidateQueries({ queryKey: ["existing-submission"] });
      toast({ title: existingSubmissionId ? "Submission updated" : "Submission saved" });
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <section className="flex flex-1 items-center justify-center py-16">
          <div className="mx-auto max-w-md text-center">
            <CheckCircle className="mx-auto mb-6 h-16 w-16 text-primary" />
            <h1 className="mb-3 font-heading text-3xl text-foreground">Thank You</h1>
            <p className="mb-6 text-muted-foreground">
              Your submission has been recorded. Your data will help researchers better understand{" "}
              {selectedCondition?.name || "this condition"}.
            </p>

            {selectedCondition && !submittedConditionInProfile && !addedToProfile && (
              <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4 text-left">
                <p className="mb-3 text-sm text-foreground">
                  Add <strong>{selectedCondition.name}</strong> to your profile so peers with the same condition can find you?
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddConditionToProfile} disabled={addingToProfile}>
                    {addingToProfile ? "Adding..." : "Add to profile"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAddedToProfile(true)}>
                    Not now
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-center gap-2">
              <Button onClick={() => { setSubmitted(false); setStep(0); setAddedToProfile(false); }}>Submit Another</Button>
              <Link to="/profile"><Button variant="outline">View profile</Button></Link>
            </div>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  // Auth gate
  if (!authLoading && !user) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <section className="flex flex-1 items-center justify-center py-16">
          <div className="mx-auto max-w-md text-center">
            <h1 className="mb-3 font-heading text-3xl text-foreground">Sign In Required</h1>
            <p className="mb-6 text-muted-foreground">
              You need an account to submit data. This helps us maintain data quality and lets you update your submissions later.
            </p>
            <Link to="/auth">
              <Button>Sign In or Create Account</Button>
            </Link>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <section className="flex-1 py-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl">
            <div className="mb-8 text-center">
              <h1 className="mb-2 font-heading text-3xl text-foreground">
                {existingSubmissionId ? "Update Your Submission" : "Share Your Experience"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {existingSubmissionId
                  ? "We loaded your previous answers. Add or edit any section to improve completeness."
                  : "Only condition is required. Everything else is optional. Save your progress anytime."}
              </p>
            </div>

            {/* Progress */}
            <div className="mb-8">
              <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                <span>{STEPS[step]}</span>
                <span>{step + 1} / {STEPS.length}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-card">
              {/* Step 0: Condition */}
              {step === 0 && (
                <div className="space-y-4">
                  <h2 className="font-heading text-xl text-card-foreground">Your Condition</h2>

                  {myConditions.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs text-muted-foreground">Submit data for one of your conditions:</p>
                      <div className="flex flex-wrap gap-2">
                        {myConditions.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setConditionId(c.id)}
                            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                              conditionId === c.id
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background text-foreground hover:bg-secondary"
                            }`}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {user && myConditions.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Tip: <Link to="/profile" className="text-primary underline">Add your conditions on your profile</Link> to skip this step next time.
                    </p>
                  )}

                  <div>
                    <Label>Condition *</Label>
                    <Select value={conditionId} onValueChange={setConditionId}>
                      <SelectTrigger><SelectValue placeholder="Select a condition" /></SelectTrigger>
                      <SelectContent>
                        {conditions?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Diagnosis Status</Label>
                    <Select value={diagnosisStatus} onValueChange={setDiagnosisStatus}>
                      <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="suspected">Suspected</SelectItem>
                        <SelectItem value="self-diagnosed">Self-diagnosed</SelectItem>
                        <SelectItem value="ruled-out">Ruled out</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Year of Diagnosis</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1900}
                      max={new Date().getFullYear()}
                      value={yearOfDiagnosis}
                      onChange={(e) => setYearOfDiagnosis(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="e.g. 2020"
                    />
                  </div>
                  <div>
                    <Label>Time from First Symptom to Diagnosis</Label>
                    <Select value={timeTodiagnosis} onValueChange={setTimeTodiagnosis}>
                      <SelectTrigger><SelectValue placeholder="Select duration" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="<6months">&lt;6 months</SelectItem>
                        <SelectItem value="6-12months">6–12 months</SelectItem>
                        <SelectItem value="1-3years">1–3 years</SelectItem>
                        <SelectItem value="3-5years">3–5 years</SelectItem>
                        <SelectItem value="5-10years">5–10 years</SelectItem>
                        <SelectItem value="10+years">10+ years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Number of Providers Seen Before Diagnosis</Label>
                    <Input type="number" value={providersCount} onChange={(e) => setProvidersCount(e.target.value)} placeholder="e.g. 5" />
                  </div>
                  <div>
                    <Label>Misdiagnoses Received</Label>
                    <Textarea value={misdiagnoses} onChange={(e) => setMisdiagnoses(e.target.value)} placeholder="List any misdiagnoses, separated by commas" rows={2} />
                  </div>
                </div>
              )}

              {/* Step 1: Symptoms */}
              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="font-heading text-xl text-card-foreground">Symptoms</h2>
                  {symptoms.map((s, i) => (
                    <div key={i} className="space-y-3 rounded-lg border border-border bg-secondary/30 p-4">
                      <div className="text-xs font-medium text-muted-foreground">Symptom {i + 1}</div>
                      <div>
                        <Label>Symptom Name</Label>
                        <MedicalTermPicker
                          value={s.picked}
                          onChange={(p) => updateSymptomPicked(i, p)}
                          kind="symptom"
                          placeholder="e.g. Joint pain"
                          onRequestPreview={requestPhiPreview("symptom")}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Severity (1–10): {s.severity}</Label>
                          <input type="range" min="1" max="10" value={s.severity} onChange={(e) => updateSymptom(i, "severity", e.target.value)} className="w-full accent-[hsl(var(--primary))]" />
                        </div>
                        <div>
                          <Label>Frequency</Label>
                          <Select value={s.frequency} onValueChange={(v) => updateSymptom(i, "frequency", v)}>
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="constant">Constant</SelectItem>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="episodic">Episodic</SelectItem>
                              <SelectItem value="intermittent">Intermittent</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addSymptom}>+ Add Symptom</Button>
                </div>
              )}

              {/* Step 2: Treatment */}
              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="font-heading text-xl text-card-foreground">Treatments</h2>
                  {treatments.map((t, i) => (
                    <div key={i} className="space-y-3 rounded-lg border border-border bg-secondary/30 p-4">
                      <div className="text-xs font-medium text-muted-foreground">Treatment {i + 1}</div>
                      <div>
                        <Label>Treatment Name</Label>
                        <MedicalTermPicker
                          value={t.picked}
                          onChange={(p) => updateTreatmentPicked(i, p)}
                          kind="treatment"
                          placeholder="e.g. Methotrexate"
                          onRequestPreview={requestPhiPreview("treatment")}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Type</Label>
                          <Select value={t.type} onValueChange={(v) => updateTreatment(i, "type", v)}>
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pharmaceutical">Pharmaceutical</SelectItem>
                              <SelectItem value="surgical">Surgical</SelectItem>
                              <SelectItem value="physical-therapy">Physical Therapy</SelectItem>
                              <SelectItem value="dietary">Dietary</SelectItem>
                              <SelectItem value="supplement">Supplement</SelectItem>
                              <SelectItem value="lifestyle">Lifestyle Change</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Effectiveness (1–10): {t.effectiveness}</Label>
                          <input type="range" min="1" max="10" value={t.effectiveness} onChange={(e) => updateTreatment(i, "effectiveness", e.target.value)} className="w-full accent-[hsl(var(--primary))]" />
                        </div>
                      </div>
                      <div>
                        <Label>Side Effects</Label>
                        <Input value={t.sideEffects} onChange={(e) => updateTreatment(i, "sideEffects", e.target.value)} placeholder="e.g. Nausea, fatigue" />
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addTreatment}>+ Add Treatment</Button>
                </div>
              )}

              {/* Step 3: Demographics */}
              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="font-heading text-xl text-card-foreground">Demographics</h2>
                  <p className="text-sm text-muted-foreground">All fields are optional and anonymized.</p>
                  <div>
                    <Label>Age Range</Label>
                    <Select value={ageRange} onValueChange={setAgeRange}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {["0-12", "13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"].map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Biological Sex at Birth</Label>
                    <Select value={biologicalSex} onValueChange={setBiologicalSex}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="intersex">Intersex</SelectItem>
                        <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Country</Label>
                    <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. United States" />
                  </div>
                </div>
              )}

              {/* Step 4: Quality of Life */}
              {step === 4 && (
                <div className="space-y-4">
                  <h2 className="font-heading text-xl text-card-foreground">Quality of Life</h2>
                  <div>
                    <Label>Work / Function Impact</Label>
                    <Select value={workImpact} onValueChange={setWorkImpact}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No impact</SelectItem>
                        <SelectItem value="mild">Mild</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="severe">Severe</SelectItem>
                        <SelectItem value="unable">Unable to work</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Average Pain Level (1–10): {painAvg}</Label>
                    <input type="range" min="1" max="10" value={painAvg} onChange={(e) => setPainAvg(e.target.value)} className="w-full accent-[hsl(var(--primary))]" />
                  </div>
                  <div>
                    <Label>Average Fatigue Level (1–10): {fatigueAvg}</Label>
                    <input type="range" min="1" max="10" value={fatigueAvg} onChange={(e) => setFatigueAvg(e.target.value)} className="w-full accent-[hsl(var(--primary))]" />
                  </div>
                  <div>
                    <Label>Mental Health Impact (1–10): {mentalHealthImpact}</Label>
                    <input type="range" min="1" max="10" value={mentalHealthImpact} onChange={(e) => setMentalHealthImpact(e.target.value)} className="w-full accent-[hsl(var(--primary))]" />
                  </div>
                  <div className="space-y-3 pt-4">
                    <div>
                      <Label>Submitter Type</Label>
                      <Select value={submitterType} onValueChange={setSubmitterType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="patient">Patient</SelectItem>
                          <SelectItem value="caregiver">Caregiver</SelectItem>
                          <SelectItem value="clinician">Clinician</SelectItem>
                          <SelectItem value="researcher">Researcher</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Data Sharing Preference</Label>
                      <Select value={sharingPref} onValueChange={setSharingPref}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fully_public">Fully Public</SelectItem>
                          <SelectItem value="anonymized_public">Anonymized Public</SelectItem>
                          <SelectItem value="research_only">Research Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Review */}
              {step === 5 && (
                <div className="space-y-4">
                  <h2 className="font-heading text-xl text-card-foreground">Review & Submit</h2>
                  <div className="space-y-3 text-sm">
                    <div className="rounded-lg bg-secondary/30 p-3">
                      <span className="font-medium text-foreground">Condition:</span>{" "}
                      <span className="text-muted-foreground">{selectedCondition?.name || "Not selected"}</span>
                    </div>
                    <div className="rounded-lg bg-secondary/30 p-3">
                      <span className="font-medium text-foreground">Diagnosis Status:</span>{" "}
                      <span className="text-muted-foreground">{diagnosisStatus || "Not specified"}</span>
                    </div>
                    <div className="rounded-lg bg-secondary/30 p-3">
                      <span className="font-medium text-foreground">Symptoms:</span>{" "}
                      <span className="text-muted-foreground">{symptoms.filter((s) => s.name).length} entered</span>
                    </div>
                    <div className="rounded-lg bg-secondary/30 p-3">
                      <span className="font-medium text-foreground">Treatments:</span>{" "}
                      <span className="text-muted-foreground">{treatments.filter((t) => t.name).length} entered</span>
                    </div>
                    <div className="rounded-lg bg-secondary/30 p-3">
                      <span className="font-medium text-foreground">Sharing:</span>{" "}
                      <span className="text-muted-foreground">{sharingPref.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
                    By submitting, you consent to your anonymized responses being included in an open medical research dataset.
                    No identifying information will be shared. You can choose your sharing preference above.
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="mt-6 flex justify-between">
                <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                {step < STEPS.length - 1 ? (
                  <Button onClick={() => setStep(step + 1)}>
                    Next <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={handleSubmit}>{existingSubmissionId ? "Update" : "Submit"}</Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
      <PhiPreviewModal
        open={phiPreview.open}
        text={phiPreview.text}
        kind={phiPreview.kind}
        onCancel={() => setPhiPreview({ open: false, text: "", kind: "symptom", onConfirm: null })}
        onConfirmed={(r) => {
          phiPreview.onConfirm?.(r);
          setPhiPreview({ open: false, text: "", kind: "symptom", onConfirm: null });
        }}
      />
    </div>
  );
};

export default Submit;
