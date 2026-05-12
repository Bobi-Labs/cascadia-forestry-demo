"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  MessageCircle, Send, Loader2, Users, Coffee, Megaphone, ShieldAlert, Hammer, Trash2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";

/**
 * Communications page — surfaces all 4 ops TG chats inside the dashboard.
 *
 * Each chat card represents a TG group with role-filtered visibility.
 * Selecting a card loads the message thread; the input forwards back to
 * TG via the existing /api/tracker/chat POST handler (which routes ops
 * project IDs through the env-based bots in lib/ops-bots.ts).
 *
 * Reserved project IDs (seeded by migration 20260430010000):
 *   3000…0001  admin_office
 *   3000…0002  foreman
 *   3000…0003  updates
 *   3000…0004  watercooler
 *
 * Role visibility (MVP — refine to per-user membership later if needed):
 *   admin   → all 4
 *   office  → admin_office, updates, watercooler  (no foreman)
 *   foreman → foreman, updates, watercooler  (no admin_office)
 *   owner   → updates, watercooler  (read-only by default)
 *   employee → no access (page hidden)
 */

const OPS_PROJECT_IDS = {
  admin_office: "30000000-0000-0000-0000-000000000001",
  foreman:      "30000000-0000-0000-0000-000000000002",
  updates:      "30000000-0000-0000-0000-000000000003",
  watercooler:  "30000000-0000-0000-0000-000000000004",
  // Bees + Jaime direct (admin-only). Reuses the existing Site Build
  // tracker_projects row + tracker_telegram_config (Work Tracker bot).
  // Send-to-TG already routes non-ops project IDs through that config —
  // see app/api/tracker/chat/route.ts.
  bees_jaime:   "10000000-0000-0000-0000-000000000001",
} as const;

type OpsChannel = keyof typeof OPS_PROJECT_IDS;

interface ChannelDef {
  key: OpsChannel;
  label: string;
  description: string;
  icon: typeof MessageCircle;
  // Color for accent (status dot, header strip)
  accent: string;
}

const CHANNELS: ChannelDef[] = [
  {
    key: "admin_office",
    label: "Admin / Office",
    description: "Internal ops, timesheets, OT, compliance",
    icon: ShieldAlert,
    accent: "border-info/40 bg-info/5 text-info",
  },
  {
    key: "foreman",
    label: "Foreman",
    description: "Field crew coordination, photo timesheets",
    icon: Users,
    accent: "border-primary/40 bg-primary/5 text-primary",
  },
  {
    key: "updates",
    label: "Updates & Alerts",
    description: "Announcements, weather, safety alerts",
    icon: Megaphone,
    accent: "border-warning/40 bg-warning/5 text-warning",
  },
  {
    key: "watercooler",
    label: "Watercooler",
    description: "Casual chat for the team",
    icon: Coffee,
    accent: "border-purple-400/40 bg-purple-500/5 text-purple-300",
  },
  {
    key: "bees_jaime",
    label: "Bees + Jaime",
    description: "Direct dev / build coordination",
    icon: Hammer,
    accent: "border-cyan-400/40 bg-cyan-500/5 text-cyan-300",
  },
];

interface TrackerMessage {
  id: string;
  project_id: string;
  author: string;
  content: string;
  source: string | null;
  created_at: string | null;
}

function visibleChannelsForRole(role: string): OpsChannel[] {
  // Office + owner get the full 4 ops channels (per Bees, pending Jaime
  // confirm). Office staff coordinate with foremen so they need that
  // thread. Owner (Jose) is read-only on most surfaces but should see
  // the full comms picture so he isn't blind to field activity.
  //
  // Admin (Jaime + Bees) additionally gets the bees_jaime direct channel
  // — it's the dev/build coordination thread that used to live as the
  // Site Build chat panel inside Work Tracker. Office shouldn't see it.
  switch (role) {
    case "admin":
      return ["admin_office", "foreman", "updates", "watercooler", "bees_jaime"];
    case "office":
      return ["admin_office", "foreman", "updates", "watercooler"];
    case "foreman":
      return ["foreman", "updates", "watercooler"];
    case "owner":
      return ["admin_office", "foreman", "updates", "watercooler"];
    default:
      return [];
  }
}

export function CommunicationsPage() {
  const { role } = useApp();
  const { profile } = useAuth();
  const visible = useMemo(() => visibleChannelsForRole(role), [role]);
  const [activeKey, setActiveKey] = useState<OpsChannel | null>(visible[0] ?? null);

  // Re-anchor active chat when role changes (e.g. demo "View as" toggle)
  useEffect(() => {
    if (visible.length === 0) {
      setActiveKey(null);
    } else if (!activeKey || !visible.includes(activeKey)) {
      setActiveKey(visible[0]);
    }
  }, [visible, activeKey]);

  if (visible.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">
          You don&apos;t have access to any team chats.
        </p>
      </div>
    );
  }

  const visibleChannels = CHANNELS.filter((c) => visible.includes(c.key));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Communications</h2>
      </div>

      {/* Horizontal channel tabs — full-width row, equal-flex pills.
          Replaces the old left-rail card layout: dead space is gone, the
          chat thread below gets the full page width. Each tab shows the
          channel label + icon + tiny last-message timestamp; the unread
          dot appears when there are messages newer than the user's last
          view (tracked in localStorage per chat). */}
      <div className={`grid gap-2 ${
        visibleChannels.length === 5 ? "grid-cols-2 sm:grid-cols-5" :
        visibleChannels.length === 4 ? "grid-cols-2 sm:grid-cols-4" :
        visibleChannels.length === 3 ? "grid-cols-3" :
        visibleChannels.length === 2 ? "grid-cols-2" :
        "grid-cols-1"
      }`}>
        {visibleChannels.map((ch) => (
          <ChannelTab
            key={ch.key}
            def={ch}
            active={ch.key === activeKey}
            onClick={() => setActiveKey(ch.key)}
          />
        ))}
      </div>

      {/* Active chat thread — full page width */}
      <div className="rounded-lg border border-border bg-card">
        {activeKey ? (
          <ChatThread
            channel={CHANNELS.find((c) => c.key === activeKey)!}
            userDisplayName={profile?.name || profile?.email?.split("@")[0] || "You"}
            canSend={role !== "owner" || activeKey === "watercooler"}
            canDelete={role === "admin"}
          />
        ) : (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
            Select a chat to view messages.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Channel tab (horizontal, compact) ─────────────────────────────────────

/**
 * Read the last-seen timestamp for a chat from localStorage. Stored per
 * chat key; each user's browser keeps its own "I've read up to here"
 * marker. Returns null if never visited.
 */
function getLastSeenAt(channelKey: OpsChannel): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(`comms-last-seen-${channelKey}`);
  return raw ? Number(raw) || 0 : 0;
}

function setLastSeenAt(channelKey: OpsChannel, timestamp: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`comms-last-seen-${channelKey}`, String(timestamp));
  // Notify the sidebar (and any other listeners) that the unread state
  // for this channel changed — they re-read localStorage.
  window.dispatchEvent(new CustomEvent("comms-last-seen-updated"));
}

function ChannelTab({
  def,
  active,
  onClick,
}: {
  def: ChannelDef;
  active: boolean;
  onClick: () => void;
}) {
  const projectId = OPS_PROJECT_IDS[def.key];
  // Pull the most recent message timestamp to drive the unread dot.
  const { data: lastMsg } = useQuery<TrackerMessage | null>({
    queryKey: ["commsLastMessage", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/tracker/chat?projectId=${projectId}&limit=1`);
      if (!res.ok) return null;
      const json = await res.json();
      const msgs = (json.messages ?? []) as TrackerMessage[];
      return msgs[msgs.length - 1] ?? null;
    },
    refetchInterval: 30000,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const Icon = def.icon;
  const lastMsgTs = lastMsg?.created_at ? new Date(lastMsg.created_at).getTime() : 0;
  const lastSeen = getLastSeenAt(def.key);
  const hasUnread = lastMsgTs > 0 && lastMsgTs > lastSeen && !active;

  // When the user opens (becomes active), mark as read.
  useEffect(() => {
    if (active && lastMsgTs > 0) {
      setLastSeenAt(def.key, Date.now());
    }
  }, [active, lastMsgTs, def.key]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-elevated ${
        active ? "border-primary bg-primary/5" : "border-border bg-card"
      }`}
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${def.accent}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="flex-1 text-sm font-semibold text-foreground truncate">
        {def.label}
      </span>
      {hasUnread && (
        <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" aria-label="Unread messages" />
      )}
    </button>
  );
}

// ─── Chat thread ───────────────────────────────────────────────────────────

function ChatThread({
  channel,
  userDisplayName,
  canSend,
  canDelete,
}: {
  channel: ChannelDef;
  userDisplayName: string;
  canSend: boolean;
  canDelete: boolean;
}) {
  const projectId = OPS_PROJECT_IDS[channel.key];
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  // Inline confirm state for per-message delete (admin only). Holds the
  // message id currently in "Yes/Cancel" mode; null otherwise.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 5s polling on the active chat thread — only one chat is open at a
  // time (bounded by user attention), so this isn't a query storm. Kept
  // the sidebar last-messages endpoint at 30s where many channels are
  // polled in parallel for the unread badge.
  const { data: messagesData, isLoading } = useQuery({
    queryKey: ["commsMessages", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/tracker/chat?projectId=${projectId}&limit=100`);
      if (!res.ok) return [] as TrackerMessage[];
      const json = await res.json();
      return (json.messages ?? []) as TrackerMessage[];
    },
    refetchInterval: 5000,
    staleTime: 5000,
    refetchOnWindowFocus: false,
  });

  const messages = messagesData ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    // Mark this chat as read whenever new messages arrive while it's open
    // (drops the unread dot on the tab + the badge on the sidebar).
    if (messages.length > 0) {
      setLastSeenAt(channel.key, Date.now());
    }
  }, [messages.length, channel.key]);

  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const res = await fetch(`/api/tracker/chat?messageId=${messageId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Delete failed: ${res.status} ${err}`);
      }
      return messageId;
    },
    onMutate: async (messageId) => {
      // Optimistic remove — drop the message from the cache before the
      // round-trip resolves so the UI feels instant.
      const queryKey = ["commsMessages", projectId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TrackerMessage[]>(queryKey);
      queryClient.setQueryData<TrackerMessage[]>(queryKey, (old) =>
        (old ?? []).filter((m) => m.id !== messageId),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      // Rollback on error.
      if (ctx?.previous) {
        queryClient.setQueryData(["commsMessages", projectId], ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["commsMessages", projectId] });
      queryClient.invalidateQueries({ queryKey: ["commsLastMessage", projectId] });
      setConfirmDeleteId(null);
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch("/api/tracker/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          author: userDisplayName,
          content,
        }),
      });
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Send failed: ${res.status} ${err}`);
      }
      return res.json();
    },
    onSuccess: () => {
      setSendError(null);
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["commsMessages", projectId] });
      queryClient.invalidateQueries({ queryKey: ["commsLastMessage", projectId] });
    },
    onError: (err) => {
      setSendError(err instanceof Error ? err.message : "Send failed");
    },
  });

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage.mutate(trimmed);
  }, [input, sendMessage]);

  const Icon = channel.icon;

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[480px] flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className={`flex h-8 w-8 items-center justify-center rounded-md border ${channel.accent}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">{channel.label}</span>
          <span className="text-[10px] text-muted-foreground">{channel.description}</span>
        </div>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          {messages.length} {messages.length === 1 ? "message" : "messages"}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageCircle className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">
              Messages mirror to and from the {channel.label} TG chat.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.author.toLowerCase() === userDisplayName.toLowerCase();
          const isTG = msg.source === "telegram";
          const isBot = msg.author === "Bot";
          const isConfirming = confirmDeleteId === msg.id;
          return (
            <div
              key={msg.id}
              className={`group flex flex-col ${isMe ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {msg.author}
                  {isTG && !isBot ? " (TG)" : ""}
                </span>
                <span className="text-[9px] text-muted-foreground/60">
                  {msg.created_at
                    ? new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                    : ""}
                </span>
              </div>
              <div className="flex items-center gap-2 max-w-[85%]">
                {/* Delete trash icon — admin only. Renders on the LEFT of
                    a "me" bubble (since bubble is right-aligned), RIGHT
                    of others. Visible on hover only to keep the chat
                    clean; first click flips to inline Yes/Cancel. */}
                {canDelete && isMe && (
                  <DeleteControl
                    msg={msg}
                    isConfirming={isConfirming}
                    onAskConfirm={() => setConfirmDeleteId(msg.id)}
                    onCancel={() => setConfirmDeleteId(null)}
                    onConfirm={() => deleteMessage.mutate(msg.id)}
                  />
                )}
                <div
                  className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                    isBot
                      ? "bg-amber-500/10 border border-amber-500/30 text-foreground"
                      : isMe
                        ? "bg-primary/20 text-foreground"
                        : isTG
                          ? "bg-blue-500/10 border border-blue-500/20 text-foreground"
                          : "bg-elevated border border-border text-foreground"
                  }`}
                >
                  {msg.content}
                </div>
                {canDelete && !isMe && (
                  <DeleteControl
                    msg={msg}
                    isConfirming={isConfirming}
                    onAskConfirm={() => setConfirmDeleteId(msg.id)}
                    onCancel={() => setConfirmDeleteId(null)}
                    onConfirm={() => deleteMessage.mutate(msg.id)}
                  />
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-4 py-3">
        {canSend ? (
          <>
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Message ${channel.label}…`}
                rows={2}
                className="flex-1 resize-none rounded-md border border-border bg-elevated px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || sendMessage.isPending}
                className="self-end rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
                title="Send (Ctrl+Enter)"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            {sendError && (
              <p className="mt-1 text-[10px] text-destructive font-medium">{sendError}</p>
            )}
            <p className="mt-1 text-[10px] text-muted-foreground">
              Ctrl+Enter to send · Mirrors to TG
            </p>
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground italic">
            Read-only for your role.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Delete control (admin only) ───────────────────────────────────────────

function DeleteControl({
  msg: _msg,
  isConfirming,
  onAskConfirm,
  onCancel,
  onConfirm,
}: {
  msg: TrackerMessage;
  isConfirming: boolean;
  onAskConfirm: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (isConfirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onConfirm}
          className="rounded bg-destructive/20 px-1.5 py-0.5 text-[10px] font-medium text-destructive hover:bg-destructive/30 transition-colors"
        >
          Yes
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onAskConfirm}
      className="opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
      title="Delete (also removes from Telegram if within 48h)"
    >
      <Trash2 className="h-3 w-3" />
    </button>
  );
}
