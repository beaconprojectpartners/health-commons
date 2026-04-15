import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send } from "lucide-react";

interface SimpleChatProps {
  otherUserId: string;
  otherDisplayName: string;
  onClose: () => void;
}

const SimpleChat = ({ otherUserId, otherDisplayName, onClose }: SimpleChatProps) => {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["chat-messages", user?.id, otherUserId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user!.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user!.id})`
        )
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });

  // Mark unread messages as read
  useEffect(() => {
    if (!user || !messages) return;
    const unread = messages.filter(
      (m: any) => m.receiver_id === user.id && !m.read_at
    );
    if (unread.length > 0) {
      supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unread.map((m: any) => m.id))
        .then(() => queryClient.invalidateQueries({ queryKey: ["chat-messages"] }));
    }
  }, [messages, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`chat-${user.id}-${otherUserId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["chat-messages", user.id, otherUserId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, otherUserId]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("messages").insert({
        sender_id: user!.id,
        receiver_id: otherUserId,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendMutation.mutate(message.trim());
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex h-96 w-80 flex-col rounded-xl border border-border bg-card shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-heading">
            {otherDisplayName[0]?.toUpperCase()}
          </div>
          <span className="text-sm font-medium text-card-foreground">{otherDisplayName}</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : messages && messages.length > 0 ? (
          messages.map((m: any) => (
            <div
              key={m.id}
              className={`flex ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  m.sender_id === user?.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Start the conversation
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-border px-3 py-2 flex gap-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          className="text-sm h-9"
          maxLength={500}
        />
        <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!message.trim() || sendMutation.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};

export default SimpleChat;
