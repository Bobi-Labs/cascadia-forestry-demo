"use client";

import { useMemo, useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Trash2 } from "lucide-react";
import type { Database } from "@/lib/supabase/database.types";
import { TrackerItemCard } from "./tracker-item-card";
import {
  statusColors,
  statusLabels,
  statusOrder,
  type TrackerStatus,
} from "./tracker-utils";

type TrackerItem = Database["public"]["Tables"]["tracker_items"]["Row"];

interface Props {
  items: TrackerItem[];
  onItemClick: (item: TrackerItem) => void;
  onStatusChange: (itemId: string, newStatus: TrackerStatus) => void;
  onReorder: (items: { id: string; sort_order: number }[]) => void;
  onClearDone?: () => void;
  /** Drag-drop / quick-done / move arrows / clear-done hidden when false. */
  canEdit?: boolean;
}

export function TrackerKanbanView({
  items,
  onItemClick,
  onStatusChange,
  onReorder,
  onClearDone,
  canEdit = true,
}: Props) {
  // DnD requires client-side only rendering (SSR hydration mismatch fix)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const columns = useMemo(() => {
    const map: Record<TrackerStatus, TrackerItem[]> = {
      pending: [],
      in_progress: [],
      done: [],
      blocked: [],
      future_phase: [],
    };
    for (const item of items) {
      const status = (item.status ?? "pending") as TrackerStatus;
      map[status].push(item);
    }
    // Sort within each column by sort_order
    for (const status of statusOrder) {
      map[status].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }
    return map;
  }, [items]);

  const handleDragEnd = (result: DropResult) => {
    if (!canEdit) return;
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const sourceStatus = source.droppableId as TrackerStatus;
    const destStatus = destination.droppableId as TrackerStatus;

    if (sourceStatus === destStatus && source.index === destination.index) return;

    // Status change
    if (sourceStatus !== destStatus) {
      onStatusChange(draggableId, destStatus);
    }

    // Reorder within destination column
    const destItems = [...columns[destStatus]];
    const item = items.find((i) => i.id === draggableId);
    if (!item) return;

    // Remove from source if same column
    if (sourceStatus === destStatus) {
      destItems.splice(source.index, 1);
    }
    destItems.splice(destination.index, 0, item);

    // Compute new sort orders
    const orderUpdates = destItems.map((it, idx) => ({
      id: it.id,
      sort_order: idx * 10,
    }));
    onReorder(orderUpdates);
  };

  // Render static columns while waiting for mount (avoids SSR hydration mismatch)
  if (!mounted) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-4">
        {statusOrder.map((status) => (
          <div key={status} className="min-w-[260px] flex-1">
            <div className="mb-2 flex items-center justify-between rounded-lg bg-card px-3 py-2">
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${statusColors[status]}`}>
                {statusLabels[status]}
              </span>
              <span className="text-xs font-mono text-muted-foreground">{columns[status].length}</span>
            </div>
            <div className="min-h-[100px] space-y-2 rounded-lg">
              {columns[status].map((item) => (
                <TrackerItemCard key={item.id} item={item} onClick={() => onItemClick(item)} compact />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-2 overflow-x-auto pb-4">
        {statusOrder.map((status) => (
          <div key={status} className="min-w-[260px] flex-1">
            {/* Column header */}
            <div className="mb-2 flex items-center justify-between rounded-lg bg-card px-3 py-2">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${statusColors[status]}`}
                >
                  {statusLabels[status]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && status === "done" && onClearDone && columns[status].length > 0 && (
                  <button
                    type="button"
                    onClick={onClearDone}
                    title="Delete all Done cards"
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear
                  </button>
                )}
                <span className="text-xs font-mono text-muted-foreground">
                  {columns[status].length}
                </span>
              </div>
            </div>

            {/* Droppable column */}
            <Droppable droppableId={status}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`min-h-[100px] space-y-2 rounded-lg transition-colors ${
                    snapshot.isDraggingOver ? "bg-primary/5" : ""
                  }`}
                >
                  {columns[status].map((item, index) => (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(dragProvided, dragSnapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          {...dragProvided.dragHandleProps}
                          className={`${dragSnapshot.isDragging ? "opacity-80 rotate-1" : ""}`}
                        >
                          <TrackerItemCard
                            item={item}
                            onClick={() => onItemClick(item)}
                            onQuickDone={canEdit ? () => onStatusChange(item.id, "done") : undefined}
                            onMoveBack={
                              canEdit && statusOrder.indexOf(status) > 0
                                ? () => onStatusChange(item.id, statusOrder[statusOrder.indexOf(status) - 1])
                                : undefined
                            }
                            onMoveForward={
                              canEdit && statusOrder.indexOf(status) < statusOrder.length - 1
                                ? () => onStatusChange(item.id, statusOrder[statusOrder.indexOf(status) + 1])
                                : undefined
                            }
                            compact
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
