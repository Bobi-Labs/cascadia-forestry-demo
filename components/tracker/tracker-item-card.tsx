"use client";

import { memo } from "react";
import { Calendar, User, CheckCircle2, ArrowRight } from "lucide-react";
import type { Database } from "@/lib/supabase/database.types";
import {
  priorityColors,
  categoryColors,
  priorityLabels,
  categoryLabels,
  type TrackerPriority,
  type TrackerCategory,
} from "./tracker-utils";

type TrackerItem = Database["public"]["Tables"]["tracker_items"]["Row"];

interface Props {
  item: TrackerItem;
  onClick: () => void;
  onQuickDone?: () => void;
  onMoveForward?: () => void;
  onMoveBack?: () => void;
  compact?: boolean;
}

export const TrackerItemCard = memo(function TrackerItemCard({
  item,
  onClick,
  onQuickDone,
  onMoveForward,
  onMoveBack,
  compact,
}: Props) {
  const priority = (item.priority ?? "medium") as TrackerPriority;
  const category = item.category as TrackerCategory;
  const isDone = item.status === "done";

  return (
    <div
      onClick={onClick}
      className={`group hover-card-lift w-full text-left rounded-lg border border-border bg-card transition-colors hover:bg-accent cursor-pointer relative ${
        compact ? "p-2.5" : "p-3"
      } ${isDone ? "opacity-60" : ""}`}
    >
      {onQuickDone && !isDone && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onQuickDone();
          }}
          className="absolute top-2 right-2 z-10 rounded-full p-1.5 transition-colors bg-green-500/10 hover:bg-green-500/30 active:bg-green-500/50 text-green-500/50 hover:text-green-400 active:text-green-300"
          title="Mark done"
        >
          <CheckCircle2 className="h-4 w-4" />
        </button>
      )}

      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priorityColors[priority]}`}
        >
          {priorityLabels[priority]}
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${categoryColors[category]}`}
        >
          {categoryLabels[category]}
        </span>
      </div>

      <div
        className={`font-medium text-foreground leading-snug ${
          compact ? "text-xs" : "text-sm"
        }`}
      >
        {isDone && <span className="mr-1 text-green-400">✓</span>}
        {item.title}
      </div>

      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
          {item.assigned_to && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {item.assigned_to}
            </span>
          )}
          {item.due_date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(item.due_date + "T00:00:00").toLocaleDateString(
                "en-US",
                {
                  month: "short",
                  day: "numeric",
                },
              )}
            </span>
          )}
        </div>

        {(onMoveBack || onMoveForward) && (
          <div className="flex items-center gap-1">
            {onMoveBack && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveBack();
                }}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Move back"
              >
                <ArrowRight className="h-3 w-3 rotate-180" />
              </button>
            )}
            {onMoveForward && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveForward();
                }}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Move forward"
              >
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
