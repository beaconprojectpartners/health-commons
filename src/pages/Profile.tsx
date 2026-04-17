import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
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
import { Shield, Trash2, User, CheckCircle2, AlertCircle, Circle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getCompleteness } from "@/lib/completeness";

const Profile = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      const { data, error } = await supabase
        .from("patient_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
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

  // Latest submission per condition
  const submissionByCondition = new Map<string, any>();
  (mySubmissions || []).forEach((s) => {
    if (!submissionByCondition.has(s.condition_id)) submissionByCondition.set(s.condition_id, s);
  });

  // Profile-level completeness pill
  const profileFieldsScore = (() => {
    let score = 0;
    const total = 3; // sharing mode, conditions, (bio if named)
    if (sharingMode) score += 1;
    if (conditionIds.length > 0) score += 1;
    if (sharingMode === "named" ? !!displayName : true) score += 1;
    return { score, total };
  })();

  const submissionScore = (() => {
    if (conditionIds.length === 0) return { score: 0, total: 0 };
    let score = 0;
    conditionIds.forEach((cid) => {
      if (submissionByCondition.has(cid)) score += 1;
    });
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
      toast({ title: "Error saving profile", description: "Please try again. Contact support if the issue persists.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("patient_profiles").delete().eq("user_id", user!.id);
      if (error) throw error;
      await signOut();
    },
    onSuccess: () => {
      toast({ title: "Profile deleted" });
      navigate("/");
    },
  });

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
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
              <User className="mx-auto mb-3 h-10 w-10 text-primary" />
              <h1 className="mb-2 font-heading text-3xl text-foreground">Your Profile</h1>
              <p className="text-sm text-muted-foreground">
                Control how your data is shared with the community
              </p>
              {profile && (
                <div className="mx-auto mt-4 max-w-xs">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Profile completeness</span>
                    <span className="font-medium text-foreground">{completenessPct}%</span>
                  </div>
                  <Progress value={completenessPct} className="h-2" />
                </div>
              )}
            </div>

            {/* Data Sharing T&Cs */}
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
                    <p className="mt-1 text-xs text-muted-foreground">
                      {sharingMode === "named"
                        ? "Other users with the same condition can see your name and wave to connect."
                        : sharingMode === "anonymous"
                        ? "Your data contributes to research but your identity stays hidden."
                        : "Your data is stored privately and not shared with anyone."}
                    </p>
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

                  {/* My conditions multi-select */}
                  <div>
                    <Label>My conditions</Label>
                    <p className="mt-1 mb-2 text-xs text-muted-foreground">
                      Selecting conditions lets you see and connect with peers who share them.
                    </p>
                    <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-background p-3 space-y-2">
                      {conditions && conditions.length > 0 ? (
                        conditions.map((c: any) => (
                          <div key={c.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`cond-${c.id}`}
                              checked={conditionIds.includes(c.id)}
                              onCheckedChange={(v) => {
                                setConditionIds((prev) =>
                                  v === true ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                                );
                              }}
                            />
                            <label htmlFor={`cond-${c.id}`} className="text-sm text-foreground cursor-pointer">
                              {c.name}
                            </label>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">No conditions available yet.</p>
                      )}
                    </div>
                    {conditionIds.length > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {conditionIds.length} selected
                      </p>
                    )}
                  </div>

                  {/* Researcher contact consent */}
                  <div className="rounded-lg border border-border bg-secondary/30 p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="contact-consent"
                        checked={contactConsent}
                        onCheckedChange={(v) => setContactConsent(v === true)}
                      />
                      <div>
                        <label htmlFor="contact-consent" className="text-sm font-medium text-foreground cursor-pointer">
                          Allow researchers to contact me
                        </label>
                        <p className="mt-1 text-xs text-muted-foreground">
                          If enabled, verified researchers can message you through DxCommons to ask follow-up questions about your experience. Your email is never shared — all communication happens through the platform.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending || (sharingMode === "named" && !displayName)}
                  >
                    {saveMutation.isPending ? "Saving..." : profile ? "Update Profile" : "Create Profile"}
                  </Button>
                </div>

                {/* Delete account */}
                <div className="mt-8 border-t border-border pt-6">
                  <h3 className="mb-2 text-sm font-medium text-destructive">Danger Zone</h3>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Deleting your profile removes your public presence. Your anonymized submissions remain in the research dataset.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm("Are you sure? This will delete your profile.")) {
                        deleteMutation.mutate();
                      }
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Profile
                  </Button>
                </div>
              </div>
            )}

            {/* Your contributions */}
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
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Complete ({c.filledSections}/{c.totalSections})
                          </Badge>
                        ) : c.status === "incomplete" ? (
                          <Badge variant="secondary" className="gap-1">
                            <AlertCircle className="h-3 w-3" /> Incomplete ({c.filledSections}/{c.totalSections})
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-muted-foreground">
                            <Circle className="h-3 w-3" /> Not started
                          </Badge>
                        );
                      const actionLabel =
                        c.status === "complete" ? "Edit" : c.status === "incomplete" ? "Continue" : "Start submission";
                      return (
                        <TableRow key={cid}>
                          <TableCell className="font-medium">{cond.name}</TableCell>
                          <TableCell>{statusEl}</TableCell>
                          <TableCell className="text-right">
                            <Link to={`/submit?condition=${cid}`}>
                              <Button variant="outline" size="sm">{actionLabel}</Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Profile;
