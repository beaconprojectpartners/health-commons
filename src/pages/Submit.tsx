import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";

const STEPS = ["Condition", "Symptoms", "Treatment", "Demographics", "Quality of Life", "Review"];

const Submit = () => {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [conditionId, setConditionId] = useState(searchParams.get("condition") || "");
  const [diagnosisStatus, setDiagnosisStatus] = useState("");
  const [yearOfDiagnosis, setYearOfDiagnosis] = useState("");
  const [timeTodiagnosis, setTimeTodiagnosis] = useState("");
  const [providersCount, setProvidersCount] = useState("");
  const [misdiagnoses, setMisdiagnoses] = useState("");

  // Symptoms
  const [symptoms, setSymptoms] = useState([{ name: "", severity: "5", frequency: "", bodySystem: "" }]);

  // Treatment
  const [treatments, setTreatments] = useState([{ name: "", type: "", effectiveness: "5", stillUsing: "", sideEffects: "" }]);

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

  const progress = ((step + 1) / STEPS.length) * 100;
  const selectedCondition = conditions?.find((c) => c.id === conditionId);

  const addSymptom = () => setSymptoms([...symptoms, { name: "", severity: "5", frequency: "", bodySystem: "" }]);
  const addTreatment = () => setTreatments([...treatments, { name: "", type: "", effectiveness: "5", stillUsing: "", sideEffects: "" }]);

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
      symptoms: symptoms.filter((s) => s.name),
      treatments: treatments.filter((t) => t.name),
      demographics: { age_range: ageRange, biological_sex: biologicalSex, country },
      quality_of_life: { work_impact: workImpact, pain_avg: painAvg, fatigue_avg: fatigueAvg, mental_health_impact: mentalHealthImpact },
      submitter_type: submitterType,
    };

    const { error } = await supabase.from("submissions").insert({
      condition_id: conditionId,
      universal_fields: universalFields,
      sharing_preference: sharingPref,
    });

    if (error) {
      toast({ title: "Submission failed", description: error.message, variant: "destructive" });
    } else {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <section className="flex min-h-[60vh] items-center justify-center py-16">
          <div className="mx-auto max-w-md text-center">
            <CheckCircle className="mx-auto mb-6 h-16 w-16 text-primary" />
            <h1 className="mb-3 font-heading text-3xl text-foreground">Thank You</h1>
            <p className="mb-6 text-muted-foreground">
              Your submission has been recorded. Your data will help researchers better understand{" "}
              {selectedCondition?.name || "this condition"}.
            </p>
            <Button onClick={() => { setSubmitted(false); setStep(0); }}>Submit Another</Button>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl">
            <div className="mb-8 text-center">
              <h1 className="mb-2 font-heading text-3xl text-foreground">Share Your Experience</h1>
              <p className="text-sm text-muted-foreground">
                Only condition is required. Everything else is optional. Save your progress anytime.
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
                    <Input value={yearOfDiagnosis} onChange={(e) => setYearOfDiagnosis(e.target.value)} placeholder="e.g. 2020" />
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
                        <Input value={s.name} onChange={(e) => updateSymptom(i, "name", e.target.value)} placeholder="e.g. Joint pain" />
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
                        <Input value={t.name} onChange={(e) => updateTreatment(i, "name", e.target.value)} placeholder="e.g. Methotrexate" />
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
                  <Button onClick={handleSubmit}>Submit</Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Submit;
