import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SimpleChat from "@/components/SimpleChat";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Hand, MessageCircle, Users, TrendingUp, Inbox, ChevronRight } from "lucide-react";

const Community = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [conditionFilter, setConditionFilter] = useState("mine");
  const [chatWith, setChatWith] = useState<{ userId: string; name: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  // All conditions (public)
  const { data: conditions } = useQuery({
    queryKey: ["conditions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conditions")
        .select("*")
        .eq("approved", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // My profile (for sharing_mode + my condition_ids)
  const { data: myProfile } = useQuery({
    queryKey: ["my-patient-profile", user?.id],
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

  const myConditionIds: string[] = useMemo(
    () => (myProfile as any)?.condition_ids || [],
    [myProfile],
  );

  // Visible peer profiles (RLS limits to peers sharing a condition or with mutual wave)
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ["community-profiles", conditionFilter, myConditionIds.join(",")],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_profiles")
        .select("*")
        .eq("sharing_mode", "named")
        .neq("user_id", user!.id);
      if (error) throw error;
      let list = data || [];
      if (conditionFilter === "mine") {
        list = list.filter((p: any) =>
          (p.condition_ids || []).some((id: string) => myConditionIds.includes(id)),
        );
      } else if (conditionFilter !== "all") {
        list = list.filter((p: any) => p.condition_ids?.includes(conditionFilter));
      }
      return list;
    },
  });

  // My waves sent
  const { data: myWaves } = useQuery({
    queryKey: ["my-waves", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waves")
        .select("*")
        .eq("from_user_id", user!.id);
      if (error) throw error;
      return data;
    },
  });

  // Waves received
  const { data: receivedWaves } = useQuery({
    queryKey: ["received-waves", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waves")
        .select("*")
        .eq("to_user_id", user!.id);
      if (error) throw error;
      return data;
    },
  });

  // Conversations from messages
  const { data: messages } = useQuery({
    queryKey: ["my-messages", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Mark received waves as seen on view
  useEffect(() => {
    if (!user || !receivedWaves) return;
    const unseen = receivedWaves.filter((w: any) => !w.seen_at);
    if (unseen.length > 0) {
      supabase
        .from("waves")
        .update({ seen_at: new Date().toISOString() })
        .in("id", unseen.map((w: any) => w.id))
        .then(() => queryClient.invalidateQueries({ queryKey: ["received-waves"] }));
    }
  }, [receivedWaves, user, queryClient]);

  // Peer submissions for accordion details
  const peerIds = useMemo(() => (profiles || []).map((p: any) => p.user_id), [profiles]);
  const { data: peerSubmissions } = useQuery({
    queryKey: ["peer-submissions", peerIds.join(",")],
    enabled: peerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("submitter_account_id, condition_id, universal_fields, dynamic_fields, sharing_preference")
        .in("submitter_account_id", peerIds)
        .in("sharing_preference", ["anonymized_public", "named_public"]);
      if (error) throw error;
      return data || [];
    },
  });

  // Top conditions (community pulse)
  const { data: topConditions } = useQuery({
    queryKey: ["top-conditions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conditions")
        .select("*")
        .eq("approved", true)
        .order("submission_count", { ascending: false })
        .limit(5);
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

  const conditionMap = useMemo(() => {
    const m = new Map<string, string>();
    conditions?.forEach((c: any) => m.set(c.id, c.name));
    return m;
  }, [conditions]);

  const hasWaved = (toUserId: string) => myWaves?.some((w) => w.to_user_id === toUserId);
  const canChat = (toUserId: string) => {
    const sent = myWaves?.some((w) => w.to_user_id === toUserId);
    const got = receivedWaves?.some((w: any) => w.from_user_id === toUserId);
    return sent || got;
  };

  // Conversations grouped by counterparty
  const conversations = useMemo(() => {
    if (!messages || !user) return [];
    const map = new Map<string, { otherId: string; lastMessage: any; unread: number }>();
    for (const m of messages as any[]) {
      const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      if (!map.has(otherId)) {
        map.set(otherId, { otherId, lastMessage: m, unread: 0 });
      }
      if (m.receiver_id === user.id && !m.read_at) {
        map.get(otherId)!.unread += 1;
      }
    }
    return Array.from(map.values());
  }, [messages, user]);

  const profileNameById = useMemo(() => {
    const m = new Map<string, string>();
    profiles?.forEach((p: any) => m.set(p.user_id, p.display_name || "User"));
    return m;
  }, [profiles]);

  const pendingWavesCount = receivedWaves?.length || 0;
  const peersVisible = profiles?.length || 0;
  const activeConvos = conversations.length;

  // Aggregate symptoms/treatments per peer
  const peerDetails = useMemo(() => {
    const m = new Map<string, { symptoms: Set<string>; treatments: Set<string>; conditionIds: Set<string> }>();
    (peerSubmissions || []).forEach((s: any) => {
      const id = s.submitter_account_id;
      if (!id) return;
      if (!m.has(id)) m.set(id, { symptoms: new Set(), treatments: new Set(), conditionIds: new Set() });
      const entry = m.get(id)!;
      entry.conditionIds.add(s.condition_id);
      const uf = s.universal_fields || {};
      const df = s.dynamic_fields || {};
      const collect = (val: any, target: Set<string>) => {
        if (Array.isArray(val)) val.forEach((v) => target.add(String(v)));
        else if (typeof val === "string" && val.trim()) target.add(val);
      };
      collect(uf.symptoms, entry.symptoms);
      collect(df.symptoms, entry.symptoms);
      collect(uf.treatments, entry.treatments);
      collect(df.treatments, entry.treatments);
    });
    return m;
  }, [peerSubmissions]);

  if (loading) return null;

  const sharingMode = (myProfile as any)?.sharing_mode;
  const isNamed = sharingMode === "named";

  const sharedConditionsFor = (peer: any): string[] => {
    return (peer.condition_ids || []).filter((id: string) => myConditionIds.includes(id));
  };

  const findReceivedWaveFor = (otherId: string) =>
    receivedWaves?.find((w: any) => w.from_user_id === otherId);

  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 text-center">
              <Users className="mx-auto mb-3 h-10 w-10 text-primary" />
              <h1 className="mb-2 font-heading text-3xl text-foreground">Community</h1>
              <p className="text-sm text-muted-foreground">
                Connect with others who share your condition. Wave to say hi, then chat! 👋
              </p>
            </div>

            {/* Disclaimer */}
            <div className="mb-6 rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
              <strong>Note:</strong> DxCommons is not a healthcare provider. Connections here are peer-to-peer and do not constitute medical advice. Never share personal medical decisions based solely on community interactions.
            </div>

            {/* Anonymity guard */}
            {myProfile && !isNamed && (
              <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
                You're browsing anonymously.{" "}
                <Link to="/profile" className="font-medium text-primary underline">
                  Switch to a Named profile
                </Link>{" "}
                so peers can wave back.
              </div>
            )}

            {/* No conditions guard */}
            {myProfile && myConditionIds.length === 0 && (
              <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
                You haven't selected any conditions yet.{" "}
                <Link to="/profile" className="font-medium text-primary underline">
                  Add your conditions
                </Link>{" "}
                to find peers who share them.
              </div>
            )}

            {/* Snapshot stats */}
            <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Conditions you follow" value={myConditionIds.length} />
              <StatCard label="Peers visible" value={peersVisible} />
              <StatCard label="Pending waves" value={pendingWavesCount} />
              <StatCard label="Active conversations" value={activeConvos} />
            </div>

            {/* Filter */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-heading text-xl text-foreground">People with your conditions</h2>
              <Select value={conditionFilter} onValueChange={setConditionFilter}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mine">Conditions I follow</SelectItem>
                  <SelectItem value="all">All conditions</SelectItem>
                  {conditions?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Peer list (table on md+, cards on mobile) */}
            {profilesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : profiles && profiles.length > 0 ? (
              <>
                {/* Desktop table */}
                <div className="hidden md:block rounded-xl border border-border bg-card shadow-card overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Shared conditions</TableHead>
                        <TableHead>Bio</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <Accordion type="multiple" asChild>
                        <>
                          {profiles.map((p: any) => {
                            const shared = sharedConditionsFor(p);
                            const details = peerDetails.get(p.user_id);
                            return (
                              <AccordionItem key={p.id} value={p.id} asChild>
                                <>
                                  <TableRow>
                                    <TableCell className="font-medium">
                                      <AccordionTrigger className="py-0 hover:no-underline">
                                        <div className="flex items-center gap-3">
                                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-heading">
                                            {(p.display_name || "?")[0].toUpperCase()}
                                          </div>
                                          <span>{p.display_name}</span>
                                        </div>
                                      </AccordionTrigger>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-wrap gap-1">
                                        {shared.length > 0 ? (
                                          shared.map((id: string) => (
                                            <Badge key={id} variant="secondary" className="text-xs">
                                              {conditionMap.get(id) || "—"}
                                            </Badge>
                                          ))
                                        ) : (
                                          <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground max-w-xs">
                                      <span className="line-clamp-1">{p.bio || "No bio yet"}</span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-2">
                                        <Button
                                          size="sm"
                                          variant={hasWaved(p.user_id) ? "outline" : "default"}
                                          disabled={hasWaved(p.user_id) || waveMutation.isPending}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            waveMutation.mutate({
                                              toUserId: p.user_id,
                                              conditionId: shared[0] || p.condition_ids?.[0] || "",
                                            });
                                          }}
                                        >
                                          <Hand className="mr-1.5 h-4 w-4" />
                                          {hasWaved(p.user_id) ? "Waved" : "Wave"}
                                        </Button>
                                        {canChat(p.user_id) && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setChatWith({ userId: p.user_id, name: p.display_name || "User" });
                                            }}
                                          >
                                            <MessageCircle className="h-4 w-4" />
                                          </Button>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                  <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={4} className="p-0">
                                      <AccordionContent>
                                        <PeerDetails
                                          peer={p}
                                          conditionMap={conditionMap}
                                          details={details}
                                        />
                                      </AccordionContent>
                                    </TableCell>
                                  </TableRow>
                                </>
                              </AccordionItem>
                            );
                          })}
                        </>
                      </Accordion>
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden">
                  <Accordion type="multiple" className="space-y-3">
                    {profiles.map((p: any) => {
                      const shared = sharedConditionsFor(p);
                      const details = peerDetails.get(p.user_id);
                      return (
                        <AccordionItem
                          key={p.id}
                          value={p.id}
                          className="rounded-xl border border-border bg-card shadow-card px-4"
                        >
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex flex-1 items-center gap-3 pr-2">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-heading">
                                {(p.display_name || "?")[0].toUpperCase()}
                              </div>
                              <div className="flex-1 text-left">
                                <div className="font-medium text-card-foreground">{p.display_name}</div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {shared.slice(0, 2).map((id: string) => (
                                    <Badge key={id} variant="secondary" className="text-xs">
                                      {conditionMap.get(id) || "—"}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <PeerDetails peer={p} conditionMap={conditionMap} details={details} />
                            <div className="mt-3 flex gap-2">
                              <Button
                                size="sm"
                                variant={hasWaved(p.user_id) ? "outline" : "default"}
                                disabled={hasWaved(p.user_id) || waveMutation.isPending}
                                onClick={() =>
                                  waveMutation.mutate({
                                    toUserId: p.user_id,
                                    conditionId: shared[0] || p.condition_ids?.[0] || "",
                                  })
                                }
                              >
                                <Hand className="mr-1.5 h-4 w-4" />
                                {hasWaved(p.user_id) ? "Waved" : "Wave"}
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
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
                <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  {myConditionIds.length === 0
                    ? "Add conditions to your profile to find peers."
                    : "No named peers yet for the selected condition(s)."}
                </p>
              </div>
            )}

            {/* Waves inbox */}
            <div className="mt-12">
              <h2 className="mb-4 flex items-center gap-2 font-heading text-xl text-foreground">
                <Inbox className="h-5 w-5 text-primary" /> Waves received
              </h2>
              {receivedWaves && receivedWaves.length > 0 ? (
                <div className="rounded-xl border border-border bg-card shadow-card divide-y divide-border">
                  {receivedWaves.map((w: any) => {
                    const name = profileNameById.get(w.from_user_id) || "Someone";
                    return (
                      <div key={w.id} className="flex items-center justify-between gap-3 p-4">
                        <div className="text-sm">
                          <span className="font-medium text-foreground">👋 {name}</span>{" "}
                          <span className="text-muted-foreground">
                            waved about <em>{conditionMap.get(w.condition_id) || "a condition"}</em>
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {!myWaves?.some((mw) => mw.to_user_id === w.from_user_id) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                waveMutation.mutate({ toUserId: w.from_user_id, conditionId: w.condition_id })
                              }
                            >
                              <Hand className="mr-1.5 h-4 w-4" /> Wave back
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => setChatWith({ userId: w.from_user_id, name })}
                          >
                            <MessageCircle className="mr-1.5 h-4 w-4" /> Chat
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No waves yet.</p>
              )}
            </div>

            {/* Conversations */}
            <div className="mt-12">
              <h2 className="mb-4 flex items-center gap-2 font-heading text-xl text-foreground">
                <MessageCircle className="h-5 w-5 text-primary" /> Conversations
              </h2>
              {conversations.length > 0 ? (
                <div className="rounded-xl border border-border bg-card shadow-card divide-y divide-border">
                  {conversations.map((c) => {
                    const name = profileNameById.get(c.otherId) || "User";
                    return (
                      <button
                        key={c.otherId}
                        onClick={() => setChatWith({ userId: c.otherId, name })}
                        className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-heading">
                            {name[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground">{name}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {c.lastMessage.content}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.unread > 0 && (
                            <Badge variant="default" className="text-xs">{c.unread}</Badge>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No conversations yet. Wave at someone to start!</p>
              )}
            </div>

            {/* Community pulse */}
            <div className="mt-12">
              <h2 className="mb-4 flex items-center gap-2 font-heading text-xl text-foreground">
                <TrendingUp className="h-5 w-5 text-primary" /> Community pulse
              </h2>
              <div className="rounded-xl border border-border bg-card shadow-card p-5">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Top conditions
                </p>
                {topConditions && topConditions.length > 0 ? (
                  <ul className="space-y-2">
                    {topConditions.map((c: any) => (
                      <li key={c.id} className="flex items-center justify-between">
                        <Link
                          to={`/conditions/${c.slug}`}
                          className="text-sm text-foreground hover:text-primary hover:underline"
                        >
                          {c.name}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {c.submission_count || 0} submissions
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No data yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

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

const StatCard = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-xl border border-border bg-card p-4 text-center shadow-card">
    <div className="font-heading text-2xl text-primary">{value}</div>
    <div className="mt-1 text-xs text-muted-foreground">{label}</div>
  </div>
);

const PeerDetails = ({
  peer,
  conditionMap,
  details,
}: {
  peer: any;
  conditionMap: Map<string, string>;
  details?: { symptoms: Set<string>; treatments: Set<string>; conditionIds: Set<string> };
}) => {
  const allConditions: string[] = peer.condition_ids || [];
  const symptoms = details ? Array.from(details.symptoms).slice(0, 12) : [];
  const treatments = details ? Array.from(details.treatments).slice(0, 12) : [];

  return (
    <div className="bg-muted/30 px-4 py-4 space-y-4">
      {peer.bio && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Bio</p>
          <p className="text-sm text-foreground">{peer.bio}</p>
        </div>
      )}
      {allConditions.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">All conditions</p>
          <div className="flex flex-wrap gap-1">
            {allConditions.map((id) => (
              <Badge key={id} variant="outline" className="text-xs">
                {conditionMap.get(id) || "—"}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {symptoms.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Reported symptoms</p>
          <div className="flex flex-wrap gap-1">
            {symptoms.map((s) => (
              <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
            ))}
          </div>
        </div>
      )}
      {treatments.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Treatments tried</p>
          <div className="flex flex-wrap gap-1">
            {treatments.map((t) => (
              <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
            ))}
          </div>
        </div>
      )}
      {!peer.bio && allConditions.length === 0 && symptoms.length === 0 && treatments.length === 0 && (
        <p className="text-sm text-muted-foreground">No additional details shared.</p>
      )}
    </div>
  );
};

export default Community;
