"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  categoryLabels,
  priorityLabels,
  type TrackerCategory,
  type TrackerPriority,
} from "./tracker-utils";

interface Props {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onSubmit: (item: {
    project_id: string;
    title: string;
    category: TrackerCategory;
    priority: TrackerPriority;
    description?: string;
    assigned_to?: string;
    due_date?: string;
  }) => void;
  // Roster for the Assign To dropdown. Sourced from the parent so the
  // list can vary per board scope (Company gets the full team; Site Build
  // gets just Bees+Jaime; Personal gets the single user). Always falls
  // back to ["Bees", "Jaime"] if the parent didn't pass anything.
  assignees?: string[];
}

export function TrackerNewItemForm({ projectId, open, onClose, onSubmit, assignees }: Props) {
  const roster = assignees && assignees.length > 0 ? assignees : ["Bees", "Jaime"];
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TrackerCategory>("task");
  const [priority, setPriority] = useState<TrackerPriority>("medium");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");

  const handleSubmit = () => {
    if (!title.trim() || !assignedTo.trim()) return;
    onSubmit({
      project_id: projectId,
      title: title.trim(),
      category,
      priority,
      description: description.trim() || undefined,
      assigned_to: assignedTo.trim() || undefined,
      due_date: dueDate || undefined,
    });
    // Reset
    setTitle("");
    setCategory("task");
    setPriority("medium");
    setDescription("");
    setAssignedTo("");
    setDueDate("");
    onClose();
  };

  const handleCancel = () => {
    setTitle("");
    setCategory("task");
    setPriority("medium");
    setDescription("");
    setAssignedTo("");
    setDueDate("");
    onClose();
  };

  if (!open) return null;

  const inputClass =
    "rounded-md border border-border bg-elevated px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors";
  const selectClass =
    "rounded-md border border-border bg-elevated px-2 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors";

  return (
    <div className="rounded-lg border border-primary/30 bg-card p-4">
      <div className="flex flex-col gap-3">
        {/* Row 1: Title + close */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className={`flex-1 ${inputClass}`}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) handleSubmit();
            }}
          />
          <button
            type="button"
            onClick={handleCancel}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Row 2: Description */}
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)..."
          className={`${inputClass} text-xs`}
        />

        {/* Row 3: Category + Priority + Assigned To + Due Date + Create */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TrackerCategory)}
            className={selectClass}
          >
            {(Object.keys(categoryLabels) as TrackerCategory[]).map((c) => (
              <option key={c} value={c}>
                {categoryLabels[c]}
              </option>
            ))}
          </select>

          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TrackerPriority)}
            className={selectClass}
          >
            {(Object.keys(priorityLabels) as TrackerPriority[]).map((p) => (
              <option key={p} value={p}>
                {priorityLabels[p]}
              </option>
            ))}
          </select>

          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className={selectClass}
          >
            <option value="">Assign to...</option>
            {roster.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={`${selectClass} w-36`}
          />

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim() || !assignedTo.trim()}
            className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
