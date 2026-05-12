"use client";

import { useState, useMemo, useEffect } from "react";
import { ArrowUpDown, CheckSquare, Square, MessageSquare, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import {
  priorityColors,
  categoryColors,
  statusColors,
  priorityLabels,
  categoryLabels,
  statusLabels,
  type TrackerPriority,
  type TrackerCategory,
  type TrackerStatus,
} from "./tracker-utils";

type TrackerItem = Database["public"]["Tables"]["tracker_items"]["Row"];

type SortKey = "title" | "priority" | "status" | "category" | "assigned_to" | "created_at" | "description";

const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
const statusOrder: Record<string, number> = {
  blocked: 0, in_progress: 1, pending: 2, done: 3, future_phase: 4,
};

interface Props {
  items: TrackerItem[];
  onItemClick: (item: TrackerItem) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkAction: (action: "done" | "in_progress" | "pending") => void;
  onStatusChange?: (itemId: string, status: string) => void;
}

export function TrackerListView({
  items,
  onItemClick,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBulkAction,
  onStatusChange,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortAsc, setSortAsc] = useState(true);
  // Note counts per item — { itemId: count }
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});

  // Fetch note counts for all visible items
  useEffect(() => {
    if (items.length === 0) return;
    const supabase = createClient();
    const itemIds = items.map((i) => i.id);

    supabase
      .from("tracker_notes")
      .select("item_id")
      .in("item_id", itemIds)
      .then(({ data }) => {
        if (!data) return;
        const counts: Record<string, number> = {};
        for (const row of data) {
          counts[row.item_id] = (counts[row.item_id] || 0) + 1;
        }
        setNoteCounts(counts);
      });
  }, [items]);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "title":
          cmp = (a.title ?? "").localeCompare(b.title ?? "");
          break;
        case "priority":
          cmp = (priorityOrder[a.priority ?? "medium"] ?? 2) - (priorityOrder[b.priority ?? "medium"] ?? 2);
          break;
        case "status":
          cmp = (statusOrder[a.status ?? "pending"] ?? 2) - (statusOrder[b.status ?? "pending"] ?? 2);
          break;
        case "category":
          cmp = (a.category ?? "").localeCompare(b.category ?? "");
          break;
        case "assigned_to":
          cmp = (a.assigned_to ?? "").localeCompare(b.assigned_to ?? "");
          break;
        case "created_at":
          cmp = (a.created_at ?? "").localeCompare(b.created_at ?? "");
          break;
        case "description":
          cmp = (a.description ?? "").localeCompare(b.description ?? "");
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [items, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const allSelected = items.length > 0 && selectedIds.size === items.length;

  return (
    <div className="space-y-2">
      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
          <span className="text-sm font-medium text-primary">{selectedIds.size} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => onBulkAction("done")} className="h-7 text-xs">
            Mark Done
          </Button>
          <Button size="sm" variant="outline" onClick={() => onBulkAction("in_progress")} className="h-7 text-xs">
            In Progress
          </Button>
          <Button size="sm" variant="outline" onClick={() => onBulkAction("pending")} className="h-7 text-xs">
            Reset
          </Button>
          <Button size="sm" variant="ghost" onClick={onClearSelection} className="h-7 text-xs text-muted-foreground">
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-card text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-3 py-2">
                <button type="button" onClick={allSelected ? onClearSelection : onSelectAll}>
                  {allSelected ? (
                    <CheckSquare className="h-4 w-4 text-primary" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              </th>
              {([
                ["status", "Status"],
                ["priority", "Priority"],
                ["category", "Category"],
                ["title", "Title"],
                ["description", "Description"],
                ["assigned_to", "Assigned"],
                ["created_at", "Created"],
              ] as [SortKey, string][]).map(([key, label]) => (
                <th key={key} className={`px-3 py-2 text-left font-medium ${key === "description" ? "hidden md:table-cell" : ""}`}>
                  <button
                    type="button"
                    onClick={() => toggleSort(key)}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    {label}
                    <ArrowUpDown className={`h-3 w-3 ${sortKey === key ? "text-primary" : ""}`} />
                  </button>
                </th>
              ))}
              <th className="w-10 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const noteCount = noteCounts[item.id] ?? 0;
              const desc = item.description ?? "";
              const truncated = desc.length > 60 ? desc.slice(0, 60) + "..." : desc;

              return (
                <tr
                  key={item.id}
                  onClick={() => onItemClick(item)}
                  className={`border-b border-border transition-colors hover:bg-elevated cursor-pointer ${
                    isSelected ? "bg-primary/5" : ""
                  }`}
                >
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => onToggleSelect(item.id)}>
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusColors[(item.status ?? "pending") as TrackerStatus]}`}>
                      {statusLabels[(item.status ?? "pending") as TrackerStatus]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priorityColors[(item.priority ?? "medium") as TrackerPriority]}`}>
                      {priorityLabels[(item.priority ?? "medium") as TrackerPriority]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${categoryColors[item.category as TrackerCategory]}`}>
                      {categoryLabels[item.category as TrackerCategory]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-foreground">
                      {item.title}
                    </span>
                  </td>
                  {/* Description + comment count */}
                  <td className="px-3 py-2.5 hidden md:table-cell max-w-[250px]">
                    <div className="flex items-start gap-1.5">
                      <span className="text-xs text-muted-foreground truncate block">
                        {truncated || <span className="italic">No description</span>}
                      </span>
                      {noteCount > 0 && (
                        <span className="flex-shrink-0 inline-flex items-center gap-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 text-[9px] font-bold text-purple-400">
                          <MessageSquare className="h-2.5 w-2.5" />
                          {noteCount}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {item.assigned_to ?? "\u2014"}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                    {item.created_at
                      ? new Date(item.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : "\u2014"}
                  </td>
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    {onStatusChange && item.status !== "done" && (
                      <button
                        type="button"
                        onClick={() => onStatusChange(item.id, "done")}
                        className="rounded-full p-1.5 transition-colors bg-green-500/10 hover:bg-green-500/30 text-green-500/50 hover:text-green-400"
                        title="Mark done"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No items match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
