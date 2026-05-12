"use client";

import { useMemo } from "react";
import { Circle, Clock, Ban, CheckCircle2 } from "lucide-react";
import type { Database } from "@/lib/supabase/database.types";
import type { TrackerStatus } from "./tracker-utils";

type TrackerItem = Database["public"]["Tables"]["tracker_items"]["Row"];

interface Props {
  items: TrackerItem[];
}

const STATS = [
  { key: "pending", label: "To Do", Icon: Circle, color: "text-muted-foreground" },
  { key: "in_progress", label: "In Progress", Icon: Clock, color: "text-blue-400" },
  { key: "blocked", label: "Blocked", Icon: Ban, color: "text-red-400" },
  { key: "done", label: "Done", Icon: CheckCircle2, color: "text-emerald-400" },
] as const;

export function TrackerStatsCard({ items }: Props) {
  const counts = useMemo(() => {
    const byStatus: Record<TrackerStatus, number> = {
      pending: 0,
      in_progress: 0,
      done: 0,
      blocked: 0,
      future_phase: 0,
    };
    for (const item of items) {
      if (item.status) byStatus[item.status as TrackerStatus]++;
    }
    return byStatus;
  }, [items]);

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {STATS.map(({ key, label, Icon, color }) => (
        <div
          key={key}
          className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-3"
        >
          <div className="flex w-full items-center gap-2">
            <div className="h-px flex-1 bg-sky-300/30" />
            <div className="flex items-center gap-1.5">
              <Icon className={`h-3.5 w-3.5 ${color}`} />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-300">
                {label}
              </span>
            </div>
            <div className="h-px flex-1 bg-sky-300/30" />
          </div>
          <span className="text-2xl font-bold tabular-nums text-foreground">
            {counts[key]}
          </span>
        </div>
      ))}
    </div>
  );
}
