import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Auth = () => {
  const [tab, setTab] = useState("signin");
  const { toast } = useToast();
  const navigate = useNavigate();

  // Sign In
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInLoading, setSignInLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: signInEmail,
      password: signInPassword,
    });
    setSignInLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Welcome back!" });
      navigate("/");
    }
  };

  // Sign Up (Researcher)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [institution, setInstitution] = useState("");
  const [researchFocus, setResearchFocus] = useState("");
  const [intendedUse, setIntendedUse] = useState("");
  const [orcid, setOrcid] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [signUpLoading, setSignUpLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      toast({ title: "Please agree to data use terms", variant: "destructive" });
      return;
    }
    setSignUpLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });

    if (authError) {
      toast({ title: "Error", description: authError.message, variant: "destructive" });
      setSignUpLoading(false);
      return;
    }

    if (authData.user) {
      const { error: profileError } = await supabase.from("researchers").insert({
        user_id: authData.user.id,
        name,
        institution: institution || null,
        research_focus: researchFocus || null,
        intended_use: intendedUse || null,
        orcid: orcid || null,
      });

      if (profileError) {
        console.error("Profile creation error:", profileError);
      }
    }

    setSignUpLoading(false);
    toast({
      title: "Account created!",
      description: "Check your email to verify your account.",
    });
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-md">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-8 grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Create Account</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <div className="rounded-xl border border-border bg-card p-6 shadow-card">
                  <h2 className="mb-6 text-center font-heading text-2xl text-card-foreground">Welcome Back</h2>
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div>
                      <Label htmlFor="si-email">Email</Label>
                      <Input id="si-email" type="email" value={signInEmail} onChange={(e) => setSignInEmail(e.target.value)} required />
                    </div>
                    <div>
                      <Label htmlFor="si-password">Password</Label>
                      <Input id="si-password" type="password" value={signInPassword} onChange={(e) => setSignInPassword(e.target.value)} required />
                    </div>
                    <Button type="submit" className="w-full" disabled={signInLoading}>
                      {signInLoading ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>
                </div>
              </TabsContent>

              <TabsContent value="signup">
                <div className="rounded-xl border border-border bg-card p-6 shadow-card">
                  <h2 className="mb-2 text-center font-heading text-2xl text-card-foreground">Researcher Registration</h2>
                  <p className="mb-6 text-center text-sm text-muted-foreground">Free access to the full dataset</p>
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Full Name *</Label>
                      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div>
                      <Label htmlFor="password">Password *</Label>
                      <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                    </div>
                    <div>
                      <Label htmlFor="institution">Institution / Affiliation</Label>
                      <Input id="institution" value={institution} onChange={(e) => setInstitution(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="focus">Research Focus</Label>
                      <Input id="focus" value={researchFocus} onChange={(e) => setResearchFocus(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="use">Intended Use of Data</Label>
                      <Textarea id="use" value={intendedUse} onChange={(e) => setIntendedUse(e.target.value)} rows={3} />
                    </div>
                    <div>
                      <Label htmlFor="orcid">ORCID iD</Label>
                      <Input id="orcid" value={orcid} onChange={(e) => setOrcid(e.target.value)} placeholder="0000-0000-0000-0000" />
                    </div>
                    <div className="flex items-start gap-2">
                      <Checkbox id="terms" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
                      <label htmlFor="terms" className="text-xs text-muted-foreground leading-tight">
                        I agree to use this data only for research purposes. Data is anonymized, not for re-identification or commercial resale. Attribution to workingTitle is encouraged.
                      </label>
                    </div>
                    <Button type="submit" className="w-full" disabled={signUpLoading || !agreed}>
                      {signUpLoading ? "Creating account..." : "Create Account"}
                    </Button>
                  </form>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Auth;
