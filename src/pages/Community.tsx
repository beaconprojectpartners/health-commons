import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SimpleChat from "@/components/SimpleChat";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Hand, MessageCircle, Users } from "lucide-react";

const Community = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [conditionFilter, setConditionFilter] = useState("all");
  const [chatWith, setChatWith] = useState<{ userId: string; name: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const { data: conditions } = useQuery({
    queryKey: ["conditions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("conditions").select("*").eq("approved", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ["community-profiles", conditionFilter],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_profiles")
        .select("*")
        .eq("sharing_mode", "named")
        .neq("user_id", user!.id);
      if (error) throw error;
      if (conditionFilter !== "all") {
        return data?.filter((p: any) => p.condition_ids?.includes(conditionFilter)) || [];
      }
      return data;
    },
  });

  const { data: myWaves } = useQuery({
    queryKey: ["my-waves", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("waves").select("*").eq("from_user_id", user!.id);
      if (error) throw error;
      return data;
    },
  });

  const { data: receivedWaves } = useQuery({
    queryKey: ["received-waves", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waves")
        .select("*")
        .eq("to_user_id", user!.id)
        .is("seen_at", null);
      if (error) throw error;
      return data;
    },
  });

  const waveMutation = useMutation({
    mutationFn: async ({ toUserId, conditionId }: { toUserId: string; conditionId: string }) => {
      const { error } = await supabase.from("waves").insert({
        from_user_id: user!.id,
        to_user_id: toUserId,
        condition_id: conditionId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-waves"] });
      toast({ title: "Wave sent! 👋", description: "They'll see your wave next time they visit." });
    },
    onError: (err: any) => {
      if (err.message?.includes("duplicate")) {
        toast({ title: "Already waved", description: "You've already waved at this person for this condition.", variant: "destructive" });
      } else {
        console.error("[Community] wave error:", err);
        toast({ title: "Could not send wave", description: "Please try again.", variant: "destructive" });
      }
    },
  });

  const hasWaved = (toUserId: string) => myWaves?.some((w) => w.to_user_id === toUserId);
  const canChat = (toUserId: string) => {
    // Can chat if mutual wave exists
    const sentWave = myWaves?.some((w) => w.to_user_id === toUserId);
    const receivedWave = receivedWaves?.some((w: any) => w.from_user_id === toUserId);
    return sentWave || receivedWave;
  };

  if (loading) return null;

  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 text-center">
              <Users className="mx-auto mb-3 h-10 w-10 text-primary" />
              <h1 className="mb-2 font-heading text-3xl text-foreground">Community</h1>
              <p className="text-sm text-muted-foreground">
                Connect with others who share your condition. Wave to say hi, then chat! 👋
              </p>
            </div>

            {/* Disclaimer */}
            <div className="mb-6 rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
              <strong>Note:</strong> CrowdDx is not a healthcare provider. Connections here are peer-to-peer and do not constitute medical advice. Never share personal medical decisions based solely on community interactions.
            </div>

            {/* Received waves notification */}
            {receivedWaves && receivedWaves.length > 0 && (
              <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
                <p className="text-sm text-foreground">
                  👋 You have <strong>{receivedWaves.length}</strong> new wave{receivedWaves.length > 1 ? "s" : ""}!
                  Someone with the same condition wants to connect.
                </p>
              </div>
            )}

            {/* Filter */}
            <div className="mb-6">
              <Select value={conditionFilter} onValueChange={setConditionFilter}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="Filter by condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All conditions</SelectItem>
                  {conditions?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Profiles */}
            {profilesLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : profiles && profiles.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {profiles.map((p: any) => (
                  <div key={p.id} className="rounded-xl border border-border bg-card p-5 shadow-card">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-heading text-lg">
                        {(p.display_name || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-medium text-card-foreground">{p.display_name}</h3>
                      </div>
                    </div>
                    {p.bio && (
                      <p className="mb-4 text-sm text-muted-foreground line-clamp-2">{p.bio}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={hasWaved(p.user_id) ? "outline" : "default"}
                        disabled={hasWaved(p.user_id) || waveMutation.isPending}
                        onClick={() => waveMutation.mutate({
                          toUserId: p.user_id,
                          conditionId: conditionFilter !== "all" ? conditionFilter : conditions?.[0]?.id || "",
                        })}
                      >
                        <Hand className="mr-1.5 h-4 w-4" />
                        {hasWaved(p.user_id) ? "Waved 👋" : "Wave"}
                      </Button>
                      {canChat(p.user_id) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setChatWith({ userId: p.user_id, name: p.display_name || "User" })}
                        >
                          <MessageCircle className="mr-1.5 h-4 w-4" /> Chat
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
                <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  No named profiles yet. Be the first to{" "}
                  <button onClick={() => navigate("/profile")} className="text-primary underline">
                    create a named profile
                  </button>
                  !
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Chat widget */}
      {chatWith && (
        <SimpleChat
          otherUserId={chatWith.userId}
          otherDisplayName={chatWith.name}
          onClose={() => setChatWith(null)}
        />
      )}

      <Footer />
    </div>
  );
};

export default Community;
