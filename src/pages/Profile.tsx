import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Trash2, User, CheckCircle2, AlertCircle, Circle, HandHeart, FlaskConical, Download, ShieldCheck } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCompleteness } from "@/lib/completeness";
import { cn } from "@/lib/utils";

type RoleKey = "patient" | "specialist" | "researcher";

const ROLE_THEME: Record<RoleKey, { label: string; icon: any; text: string; bg: string; ring: string; solid: string }> = {
  patient:    { label: "Patient",    icon: HandHeart,    text: "text-primary",       bg: "bg-primary/10",       ring: "ring-primary",       solid: "bg-primary text-primary-foreground" },
  specialist: { label: "Specialist", icon: FlaskConical, text: "text-fuchsia-500",   bg: "bg-fuchsia-500/10",   ring: "ring-fuchsia-500",   solid: "bg-fuchsia-500 text-white" },
  researcher: { label: "Researcher", icon: Download,     text: "text-blue-500",      bg: "bg-blue-500/10",      ring: "ring-blue-500",      solid: "bg-blue-500 text-white" },
};

const Profile = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialRole = (searchParams.get("role") as RoleKey) || "patient";
  const [activeRole, setActiveRole] = useState<RoleKey>(
    ["patient", "specialist", "researcher"].includes(initialRole) ? initialRole : "patient"
  );

  useEffect(() => {
    setSearchParams((prev) => {
      const sp = new URLSearchParams(prev);
      sp.set("role", activeRole);
      return sp;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRole]);

  // ---- Patient state ----
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [sharingMode, setSharingMode] = useState("anonymous");
  const [contactConsent, setContactConsent] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [conditionIds, setConditionIds] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["patient-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("patient_profiles").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: conditions } = useQuery({
    queryKey: ["conditions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("conditions").select("*").eq("approved", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: mySubmissions } = useQuery({
    queryKey: ["my-submissions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("id, condition_id, universal_fields, submitted_at")
        .eq("submitter_account_id", user!.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submissionByCondition = new Map<string, any>();
  (mySubmissions || []).forEach((s) => {
    if (!submissionByCondition.has(s.condition_id)) submissionByCondition.set(s.condition_id, s);
  });

  // ---- Specialist data ----
  const { data: specialistApp } = useQuery({
    queryKey: ["specialist-app", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("specialist_applications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: isSpecialist } = useQuery({
    queryKey: ["role-specialist", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "specialist").maybeSingle();
      return !!data;
    },
  });

  const { data: specialistTiers } = useQuery({
    queryKey: ["specialist-tiers", user?.id],
    enabled: !!user && !!isSpecialist,
    queryFn: async () => {
      const { data } = await supabase.from("specialist_tiers").select("*").eq("user_id", user!.id).is("revoked_at", null);
      return data ?? [];
    },
  });

  // ---- Researcher data ----
  const { data: researcher } = useQuery({
    queryKey: ["researcher-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("researchers").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const profileFieldsScore = (() => {
    let score = 0;
    const total = 3;
    if (sharingMode) score += 1;
    if (conditionIds.length > 0) score += 1;
    if (sharingMode === "named" ? !!displayName : true) score += 1;
    return { score, total };
  })();

  const submissionScore = (() => {
    if (conditionIds.length === 0) return { score: 0, total: 0 };
    let score = 0;
    conditionIds.forEach((cid) => { if (submissionByCondition.has(cid)) score += 1; });
    return { score, total: conditionIds.length };
  })();

  const totalScore = profileFieldsScore.score + submissionScore.score;
  const totalMax = profileFieldsScore.total + submissionScore.total;
  const completenessPct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
      setSharingMode(profile.sharing_mode);
      setContactConsent(!!(profile as any).contact_consent);
      setConditionIds((profile as any).condition_ids || []);
      setAgreedTerms(true);
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        user_id: user!.id,
        display_name: sharingMode === "named" ? displayName : null,
        bio: sharingMode === "named" ? bio : null,
        sharing_mode: sharingMode,
        contact_consent: contactConsent,
        condition_ids: conditionIds,
      };
      if (profile) {
        const { error } = await supabase.from("patient_profiles").update(payload).eq("id", profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("patient_profiles").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-profile"] });
      toast({ title: "Profile saved!" });
    },
    onError: (err: any) => {
      console.error("[Profile] save error:", err);
      toast({ title: "Error saving profile", description: "Please try again.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("patient_profiles").delete().eq("user_id", user!.id);
      if (error) throw error;
      await signOut();
    },
    onSuccess: () => { toast({ title: "Profile deleted" }); navigate("/"); },
  });

  if (loading || profileLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  // Active role badges (which roles the user actually holds)
  const heldRoles: Record<RoleKey, boolean> = {
    patient: !!profile,
    specialist: !!isSpecialist || !!specialistApp,
    researcher: !!researcher,
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <section className="flex-1 py-10">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 text-center">
              <User className="mx-auto mb-3 h-10 w-10 text-primary" />
              <h1 className="mb-2 font-heading text-3xl text-foreground">Your Profile</h1>
              <p className="text-sm text-muted-foreground">
                You can hold any combination of roles. Pick a role to view and manage that profile.
              </p>
            </div>

            {/* Role tabs */}
            <div className="mb-6 grid grid-cols-3 gap-3">
              {(Object.keys(ROLE_THEME) as RoleKey[]).map((key) => {
                const t = ROLE_THEME[key];
                const Icon = t.icon;
                const active = activeRole === key;
                const held = heldRoles[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveRole(key)}
                    className={cn(
                      "group flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-all",
                      active ? `ring-2 ${t.ring} shadow-card` : "hover:border-foreground/20",
                    )}
                  >
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", active ? t.solid : t.bg)}>
                      <Icon className={cn("h-5 w-5", active ? "" : t.text)} />
                    </div>
                    <div className="font-medium text-foreground">{t.label}</div>
                    <Badge variant={held ? "secondary" : "outline"} className="text-[10px]">
                      {held ? "Active" : "Not set up"}
                    </Badge>
                  </button>
                );
              })}
            </div>

            {/* PATIENT */}
            {activeRole === "patient" && (
              <>
                {profile && (
                  <div className="mb-4 mx-auto max-w-xs">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Profile completeness</span>
                      <span className="font-medium text-foreground">{completenessPct}%</span>
                    </div>
                    <Progress value={completenessPct} className="h-2" />
                  </div>
                )}

                {!profile && !agreedTerms && (
                  <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-6">
                    <div className="mb-4 flex items-start gap-3">
                      <Shield className="mt-0.5 h-5 w-5 text-primary" />
                      <div>
                        <h3 className="mb-2 font-heading text-lg text-foreground">Data Sharing Terms</h3>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          <li>• Your submission data is anonymized by default and used for medical research.</li>
                          <li>• You can choose to share a named profile so others with the same condition can connect with you.</li>
                          <li>• You can delete your profile and all associated data at any time.</li>
                          <li>• Data will not be sold or used for re-identification.</li>
                          <li>• Attribution to DxCommons is encouraged in publications.</li>
                        </ul>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Checkbox id="agree" checked={agreedTerms} onCheckedChange={(v) => setAgreedTerms(v === true)} />
                      <label htmlFor="agree" className="text-xs leading-tight text-muted-foreground">
                        I understand and agree to these data sharing terms.
                      </label>
                    </div>
                  </div>
                )}

                {(agreedTerms || profile) && (
                  <div className="rounded-xl border border-border bg-card p-6 shadow-card">
                    <div className="space-y-5">
                      <div>
                        <Label>Data Sharing Mode</Label>
                        <Select value={sharingMode} onValueChange={setSharingMode}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="named">Named Profile — visible to others with same condition</SelectItem>
                            <SelectItem value="anonymous">Anonymous — share data without your name</SelectItem>
                            <SelectItem value="private">Private — data stored but not shared</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {sharingMode === "named" && (
                        <>
                          <div>
                            <Label>Display Name *</Label>
                            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="How you'd like to appear" />
                          </div>
                          <div>
                            <Label>Bio (optional)</Label>
                            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell others about your journey..." rows={3} />
                          </div>
                        </>
                      )}

                      <div>
                        <Label>My conditions</Label>
                        <p className="mt-1 mb-2 text-xs text-muted-foreground">Selecting conditions lets you see and connect with peers who share them.</p>
                        <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-background p-3 space-y-2">
                          {conditions && conditions.length > 0 ? (
                            conditions.map((c: any) => (
                              <div key={c.id} className="flex items-center gap-2">
                                <Checkbox
                                  id={`cond-${c.id}`}
                                  checked={conditionIds.includes(c.id)}
                                  onCheckedChange={(v) => {
                                    setConditionIds((prev) => v === true ? [...prev, c.id] : prev.filter((id) => id !== c.id));
                                  }}
                                />
                                <label htmlFor={`cond-${c.id}`} className="text-sm text-foreground cursor-pointer">{c.name}</label>
                              </div>
                            ))
                          ) : (<p className="text-xs text-muted-foreground">No conditions available yet.</p>)}
                        </div>
                        {conditionIds.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{conditionIds.length} selected</p>}
                      </div>

                      <div className="rounded-lg border border-border bg-secondary/30 p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox id="contact-consent" checked={contactConsent} onCheckedChange={(v) => setContactConsent(v === true)} />
                          <div>
                            <label htmlFor="contact-consent" className="text-sm font-medium text-foreground cursor-pointer">Allow researchers to contact me</label>
                            <p className="mt-1 text-xs text-muted-foreground">If enabled, verified researchers can message you through DxCommons. Your email is never shared.</p>
                          </div>
                        </div>
                      </div>

                      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || (sharingMode === "named" && !displayName)}>
                        {saveMutation.isPending ? "Saving..." : profile ? "Update Profile" : "Create Profile"}
                      </Button>
                    </div>

                    <div className="mt-8 border-t border-border pt-6">
                      <h3 className="mb-2 text-sm font-medium text-destructive">Danger Zone</h3>
                      <p className="mb-3 text-xs text-muted-foreground">
                        Deleting your patient profile removes your public presence. Anonymized submissions remain in the dataset.
                      </p>
                      <Button variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive/10"
                        onClick={() => { if (confirm("Delete patient profile?")) deleteMutation.mutate(); }}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete Patient Profile
                      </Button>
                    </div>
                  </div>
                )}

                {profile && conditionIds.length > 0 && (
                  <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-card">
                    <h2 className="mb-1 font-heading text-xl text-foreground">Your contributions</h2>
                    <p className="mb-4 text-xs text-muted-foreground">
                      Submission completeness for each of your conditions. Adding more sections strengthens the dataset.
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Condition</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {conditionIds.map((cid) => {
                          const cond = conditions?.find((c: any) => c.id === cid);
                          if (!cond) return null;
                          const sub = submissionByCondition.get(cid);
                          const c = getCompleteness(sub);
                          const statusEl =
                            c.status === "complete" ? (
                              <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Complete ({c.filledSections}/{c.totalSections})</Badge>
                            ) : c.status === "incomplete" ? (
                              <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> Incomplete ({c.filledSections}/{c.totalSections})</Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 text-muted-foreground"><Circle className="h-3 w-3" /> Not started</Badge>
                            );
                          const actionLabel = c.status === "complete" ? "Edit" : c.status === "incomplete" ? "Continue" : "Start submission";
                          return (
                            <TableRow key={cid}>
                              <TableCell className="font-medium">{cond.name}</TableCell>
                              <TableCell>{statusEl}</TableCell>
                              <TableCell className="text-right">
                                <Link to={`/submit?condition=${cid}`}><Button variant="outline" size="sm">{actionLabel}</Button></Link>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}

            {/* SPECIALIST */}
            {activeRole === "specialist" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-fuchsia-500" />
                    Specialist profile
                  </CardTitle>
                  <CardDescription>Verified via NPI + institutional email + 3-peer panel review.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!specialistApp && !isSpecialist && (
                    <>
                      <p className="text-sm text-muted-foreground">You haven't applied to be a specialist yet.</p>
                      <Link to="/specialists/apply"><Button className="bg-fuchsia-500 text-white hover:bg-fuchsia-500/90">Apply as Specialist</Button></Link>
                    </>
                  )}

                  {specialistApp && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Application:</span>
                        <Badge variant={specialistApp.status === "approved" ? "default" : "secondary"}>{specialistApp.status}</Badge>
                      </div>
                      {specialistApp.full_name && <div><span className="text-muted-foreground">Name: </span>{specialistApp.full_name}</div>}
                      {specialistApp.npi && <div><span className="text-muted-foreground">NPI: </span><span className="font-mono">{specialistApp.npi}</span></div>}
                      {specialistApp.primary_taxonomy_display && <div><span className="text-muted-foreground">Primary specialty: </span>{specialistApp.primary_taxonomy_display}</div>}
                      {specialistApp.institutional_email && <div><span className="text-muted-foreground">Institutional email: </span>{specialistApp.institutional_email}</div>}
                      <div className="pt-2 flex gap-2">
                        <Link to="/specialists/apply"><Button variant="outline" size="sm">View / edit application</Button></Link>
                        <Link to="/specialists"><Button variant="outline" size="sm">Specialist Hub</Button></Link>
                      </div>
                    </div>
                  )}

                  {isSpecialist && (
                    <div className="border-t border-border pt-4">
                      <div className="mb-2 text-sm font-medium text-foreground">Active tiers</div>
                      {(specialistTiers ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">No active tiers yet.</p>
                      ) : (
                        <ul className="space-y-1.5 text-sm">
                          {specialistTiers!.map((t: any) => (
                            <li key={t.id} className="flex items-center gap-2">
                              <Badge variant={t.tier === "moderator" ? "default" : t.tier === "core" ? "secondary" : "outline"}>{t.tier}</Badge>
                              <span className="text-muted-foreground text-xs">{t.scope_type}</span>
                              <span className="font-mono text-xs">{t.scope_id}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* RESEARCHER */}
            {activeRole === "researcher" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-blue-500" />
                    Researcher profile
                  </CardTitle>
                  <CardDescription>Sign the Data Use Agreement to access exports and the API.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!researcher ? (
                    <>
                      <p className="text-sm text-muted-foreground">You haven't registered as a researcher yet.</p>
                      <Link to="/researchers"><Button className="bg-blue-500 text-white hover:bg-blue-500/90">Register as Researcher</Button></Link>
                    </>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div><span className="text-muted-foreground">Name: </span>{researcher.name}</div>
                      {researcher.institution && <div><span className="text-muted-foreground">Institution: </span>{researcher.institution}</div>}
                      {researcher.orcid && <div><span className="text-muted-foreground">ORCID: </span>{researcher.orcid}</div>}
                      {researcher.research_focus && <div><span className="text-muted-foreground">Focus: </span>{researcher.research_focus}</div>}
                      <div><span className="text-muted-foreground">DUA accepted: </span>{new Date(researcher.agreed_terms_at).toLocaleDateString()}</div>
                      {researcher.revoked_at && <div><Badge variant="destructive">Access revoked</Badge></div>}
                      <div className="pt-2 flex gap-2">
                        <Link to="/researchers"><Button variant="outline" size="sm">Researcher portal</Button></Link>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Profile;
