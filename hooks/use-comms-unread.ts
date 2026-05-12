"use client";

import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

/**
 * Returns the number of comms channels with unread messages for the
 * given role. Powers the red-dot badge on the sidebar's Communications
 * nav entry.
 *
 * Unread = the channel has messages newer than the user's last-seen
 * timestamp (stored in localStorage by the Communications page each
 * time the user views a channel).
 *
 * Polls /api/communications/last-messages every 30s. Re-reads
 * localStorage when the Communications page dispatches the
 * `comms-last-seen-updated` event after the user views a chat.
 *
 * Channels not visible to the role are excluded. Mirrors the visibility
 * rules in components/pages/communications.tsx.
 */

type OpsChannel = "admin_office" | "foreman" | "updates" | "watercooler" | "bees_jaime";

const OPS_PROJECT_IDS: Record<OpsChannel, string> = {
  admin_office: "30000000-0000-0000-0000-000000000001",
  foreman:      "30000000-0000-0000-0000-000000000002",
  updates:      "30000000-0000-0000-0000-000000000003",
  watercooler:  "30000000-0000-0000-0000-000000000004",
  bees_jaime:   "10000000-0000-0000-0000-000000000001",
};

// Mirror of the visibility rules in components/pages/communications.tsx —
// keep these in sync when adding/removing channels or tweaking access.
function visibleChannelsForRole(role: string): OpsChannel[] {
  switch (role) {
    case "admin":   return ["admin_office", "foreman", "updates", "watercooler", "bees_jaime"];
    case "office":  return ["admin_office", "foreman", "updates", "watercooler"];
    case "foreman": return ["foreman", "updates", "watercooler"];
    case "owner":   return ["admin_office", "foreman", "updates", "watercooler"];
    default:        return [];
  }
}

function getLastSeenAt(channelKey: OpsChannel): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(`comms-last-seen-${channelKey}`);
  return raw ? Number(raw) || 0 : 0;
}

export function useCommsUnreadCount(role: string): number {
  const visible = visibleChannelsForRole(role);

  // Re-render trigger when localStorage last-seen changes (event dispatched
  // by the Communications page when a chat is viewed). Keeps the badge
  // accurate without a full page refresh.
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener("comms-last-seen-updated", bump);
    // Also pick up cross-tab changes
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener("comms-last-seen-updated", bump);
      window.removeEventListener("storage", bump);
    };
  }, [bump]);

  const { data: lastByProject } = useQuery({
    queryKey: ["commsLastMessages"],
    queryFn: async (): Promise<Record<string, string | null>> => {
      const res = await fetch("/api/communications/last-messages");
      if (!res.ok) return {};
      return res.json();
    },
    refetchInterval: 30_000,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: visible.length > 0,
  });

  if (!lastByProject || visible.length === 0) return 0;

  // Count channels where last-message timestamp > last-seen timestamp.
  // refreshKey is in deps to force re-evaluation when localStorage changes.
  void refreshKey;

  let unread = 0;
  for (const channel of visible) {
    const projectId = OPS_PROJECT_IDS[channel];
    const lastMsgIso = lastByProject[projectId];
    if (!lastMsgIso) continue;
    const lastMsgTs = new Date(lastMsgIso).getTime();
    const lastSeen = getLastSeenAt(channel);
    if (lastMsgTs > lastSeen) unread += 1;
  }
  return unread;
}
