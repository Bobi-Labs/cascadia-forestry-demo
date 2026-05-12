"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, X, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTrackerAuth } from "./tracker-auth-provider";
import type { Database } from "@/lib/supabase/database.types";

type TrackerMessage = Database["public"]["Tables"]["tracker_messages"]["Row"];

interface Props {
  projectId: string;
  open: boolean;
  onClose: () => void;
  knownUsers: string[]; // display names for @mention autocomplete
}

export function TrackerChatPanel({ projectId, open, onClose, knownUsers }: Props) {
  const { profile, displayName } = useTrackerAuth();
  const [input, setInput] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  // Fetch messages with polling. Cadence is 30s (was 5s) — five-second
  // polling burned ~720 requests/hour per open chat panel against the
  // /api/tracker/chat route, which proxies a Supabase read. The tradeoff
  // is up to 30s lag on inbound TG messages, but the chat panel is a
  // sidebar, not a primary surface, and 30s is acceptable for the
  // operator-coordination use case. Add staleTime so re-mounts within
  // the window don't trigger an immediate refetch.
  const { data: messagesData, isLoading } = useQuery({
    queryKey: ["trackerMessages", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/tracker/chat?projectId=${projectId}&limit=100`);
      const json = await res.json();
      return (json.messages ?? []) as TrackerMessage[];
    },
    refetchInterval: 30000,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    enabled: open,
  });

  const messages = messagesData ?? [];

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, open]);

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch("/api/tracker/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          author: displayName,
          authorId: profile?.id,
          content,
        }),
      });
      if (!res.ok) throw new Error("Failed to send");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trackerMessages", projectId] });
    },
  });

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage.mutate(trimmed);
    setInput("");
    setShowMentions(false);
  }, [input, sendMessage]);

  // Handle @mention autocomplete
  const handleInputChange = (value: string) => {
    setInput(value);

    // Check if user is typing an @mention
    const cursorPos = textareaRef.current?.selectionStart ?? value.length;
    const textBefore = value.slice(0, cursorPos);
    const atMatch = textBefore.match(/@(\w*)$/);

    if (atMatch) {
      setShowMentions(true);
      setMentionFilter(atMatch[1].toLowerCase());
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (name: string) => {
    const cursorPos = textareaRef.current?.selectionStart ?? input.length;
    const textBefore = input.slice(0, cursorPos);
    const textAfter = input.slice(cursorPos);
    const replaced = textBefore.replace(/@\w*$/, `@${name} `);
    setInput(replaced + textAfter);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const filteredUsers = knownUsers.filter(
    (name) =>
      name.toLowerCase().includes(mentionFilter) &&
      name.toLowerCase() !== displayName.toLowerCase(),
  );

  if (!open) return null;

  return (
    <div className="fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-border bg-background shadow-xl sm:w-[380px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Team Chat</h2>
          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
            {messages.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            No messages yet. Start the conversation!
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.author.toLowerCase() === displayName.toLowerCase();
          const isTelegram = msg.source === "telegram";

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {msg.author}
                  {isTelegram && " (TG)"}
                </span>
                <span className="text-[9px] text-muted-foreground/60">
                  {msg.created_at
                    ? new Date(msg.created_at).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : ""}
                </span>
              </div>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  isMe
                    ? "bg-primary/20 text-foreground"
                    : isTelegram
                      ? "bg-blue-500/10 border border-blue-500/20 text-foreground"
                      : "bg-card border border-border text-foreground"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{renderMentions(msg.content)}</p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="relative border-t border-border px-4 py-3">
        {/* @mention dropdown */}
        {showMentions && filteredUsers.length > 0 && (
          <div className="absolute bottom-full left-4 right-4 mb-1 rounded-lg border border-border bg-card shadow-lg">
            {filteredUsers.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => insertMention(name)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-elevated transition-colors first:rounded-t-lg last:rounded-b-lg"
              >
                <span className="text-primary">@</span>
                {name}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Type a message... (use @ to mention)"
            rows={2}
            className="flex-1 resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
            className="h-auto self-end px-3"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Ctrl+Enter to send · Messages mirror to Telegram
        </p>
      </div>
    </div>
  );
}

/** Highlight @mentions in message text */
function renderMentions(text: string) {
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="font-semibold text-primary">
        {part}
      </span>
    ) : (
      part
    ),
  );
}
