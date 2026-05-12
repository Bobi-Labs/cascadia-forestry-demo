"use client";

import { useState, useEffect } from "react";
import { Send, Trash2, Loader2, Save, Pencil, Check, X, Code2, Users, Paperclip, Download, File as FileIcon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { useTrackerAuth } from "./tracker-auth-provider";
import { TrackerFileUpload } from "./tracker-file-upload";
import { TRACKER_PROJECT_ID } from "./tracker-utils";
import {
  statusColors,
  statusLabels,
  statusOrder,
  priorityLabels,
  categoryLabels,
  isDevTeam,
  type TrackerStatus,
  type TrackerPriority,
  type TrackerCategory,
} from "./tracker-utils";

type TrackerItem = Database["public"]["Tables"]["tracker_items"]["Row"];
type TrackerNote = Database["public"]["Tables"]["tracker_notes"]["Row"];

/** Reusable note section for Dev Team or Client */
function NoteSection({
  label,
  icon,
  accentColor,
  notes,
  editingNoteId,
  editingNoteContent,
  setEditingNoteContent,
  onEditNote,
  onSaveNote,
  onCancelEdit,
}: {
  label: string;
  icon: React.ReactNode;
  accentColor: "blue" | "amber";
  notes: TrackerNote[];
  editingNoteId: string | null;
  editingNoteContent: string;
  setEditingNoteContent: (val: string) => void;
  onEditNote: (note: TrackerNote) => void;
  onSaveNote: (noteId: string) => Promise<void>;
  onCancelEdit: () => void;
}) {
  const borderColor = accentColor === "blue" ? "border-blue-500/30" : "border-amber-500/30";
  const bgColor = accentColor === "blue" ? "bg-blue-500/5" : "bg-amber-500/5";
  const badgeCls =
    accentColor === "blue"
      ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
      : "bg-amber-500/20 text-amber-400 border-amber-500/30";

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-3`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${badgeCls}`}>
          {notes.length}
        </span>
      </div>
      {notes.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No comments yet</p>
      ) : (
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {notes.map((note) => (
            <div key={note.id} className="rounded-md border border-border bg-card/80 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">{note.author}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {note.created_at
                      ? new Date(note.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : ""}
                  </span>
                  {editingNoteId !== note.id && (
                    <button
                      type="button"
                      onClick={() => onEditNote(note)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit note"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              {editingNoteId === note.id ? (
                <div className="mt-1.5 space-y-1.5">
                  <Textarea
                    value={editingNoteContent}
                    onChange={(e) => setEditingNoteContent(e.target.value)}
                    rows={2}
                    className="resize-none text-sm"
                    autoFocus
                  />
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => onSaveNote(note.id)}
                      className="h-6 gap-1 text-[10px]"
                    >
                      <Check className="h-3 w-3" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onCancelEdit}
                      className="h-6 gap-1 text-[10px]"
                    >
                      <X className="h-3 w-3" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type TrackerFileRow = Database["public"]["Tables"]["tracker_files"]["Row"];

/** Inline file list + upload for an item */
function ItemFiles({ itemId }: { itemId: string }) {
  const { displayName, profile } = useTrackerAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const { data: files = [] } = useQuery({
    queryKey: ["trackerItemFiles", itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracker_files")
        .select("*")
        .eq("item_id", itemId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Filter out dotfiles (e.g. .DS_Store)
      return (data as TrackerFileRow[]).filter((f) => !f.file_name.startsWith("."));
    },
  });

  const invalidateFiles = () => {
    queryClient.invalidateQueries({ queryKey: ["trackerItemFiles", itemId] });
    queryClient.invalidateQueries({ queryKey: ["trackerFiles"] });
    queryClient.invalidateQueries({ queryKey: ["trackerDriveFiles"] });
    queryClient.invalidateQueries({ queryKey: ["trackerFilesCount"] });
  };

  const handleDownload = (file: TrackerFileRow) => {
    // file_path stores the Drive file ID for new uploads
    const driveId = file.file_path;
    window.open(`https://drive.google.com/file/d/${driveId}/view`, "_blank");
  };

  const handleDelete = async (file: TrackerFileRow) => {
    // Delete from Drive + Supabase metadata via API route
    const driveId = file.file_path;
    await fetch(`/api/tracker/drive/${driveId}`, { method: "DELETE" });
    invalidateFiles();
  };

  return (
    <div>
      <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-muted-foreground">
        <Paperclip className="inline h-3 w-3 mr-1" />
        Attached Files
      </label>

      {files.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 rounded-md border border-border bg-card/80 px-2.5 py-1.5"
            >
              <FileIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs font-medium text-foreground truncate flex-1">
                {file.file_name}
              </span>
              <button
                type="button"
                onClick={() => handleDownload(file)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Download"
              >
                <Download className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(file)}
                className="text-muted-foreground hover:text-destructive transition-colors"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <TrackerFileUpload
        projectId={TRACKER_PROJECT_ID}
        itemId={itemId}
        uploadedBy={displayName}
        uploadedById={profile?.id}
        onUploaded={invalidateFiles}
        compact
      />
    </div>
  );
}

interface Props {
  item: TrackerItem | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, fields: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}

export function TrackerItemDetail({ item, open, onClose, onUpdate, onDelete }: Props) {
  const { displayName } = useTrackerAuth();
  const [notes, setNotes] = useState<TrackerNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [noteAuthor, setNoteAuthor] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TrackerPriority>("medium");
  const [category, setCategory] = useState<TrackerCategory>("task");
  const [localStatus, setLocalStatus] = useState<TrackerStatus>("pending");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");
  // Track which item ID we loaded notes for to avoid refetching on status-only changes
  const [loadedItemId, setLoadedItemId] = useState<string | null>(null);

  // Set note author from auth when displayName loads
  useEffect(() => {
    if (displayName && !noteAuthor) setNoteAuthor(displayName);
  }, [displayName, noteAuthor]);

  // Full reset when opening a different item
  useEffect(() => {
    if (!item) return;
    if (item.id === loadedItemId) return; // Same item — don't reset

    setLoadedItemId(item.id);
    setTitle(item.title);
    setDescription(item.description ?? "");
    setAssignedTo(item.assigned_to ?? "");
    setDueDate(item.due_date ?? "");
    setPriority((item.priority ?? "medium") as TrackerPriority);
    setCategory(item.category as TrackerCategory);
    setLocalStatus((item.status ?? "pending") as TrackerStatus);
    setConfirmDelete(false);
    setDirty(false);
    setEditingNoteId(null);

    // Fetch notes for the new item
    setNotesLoading(true);
    const supabase = createClient();
    supabase
      .from("tracker_notes")
      .select("*")
      .eq("item_id", item.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setNotes(data ?? []);
        setNotesLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  if (!item) return null;

  const handleStatusChange = (status: TrackerStatus) => {
    // Instant local update — no waiting for DB
    setLocalStatus(status);
    onUpdate(item.id, { status });
  };

  const handleSave = () => {
    const fields: Record<string, unknown> = {};
    if (title.trim() && title !== item.title) fields.title = title.trim();
    if (description !== (item.description ?? "")) fields.description = description || null;
    if (assignedTo !== (item.assigned_to ?? "")) fields.assigned_to = assignedTo || null;
    if (dueDate !== (item.due_date ?? "")) fields.due_date = dueDate || null;
    if (priority !== (item.priority ?? "medium")) fields.priority = priority;
    if (category !== item.category) fields.category = category;
    if (Object.keys(fields).length > 0) {
      onUpdate(item.id, fields);
    }
    setDirty(false);
  };

  const markDirty = () => setDirty(true);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("tracker_notes")
      .insert({ item_id: item.id, author: noteAuthor, content: newNote.trim() })
      .select("*")
      .single();
    if (data) {
      setNotes((prev) => [...prev, data]);
      setNewNote("");

      // Fire-and-forget: notify @mentions via TG
      if (newNote.includes("@")) {
        fetch("/api/tracker/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: TRACKER_PROJECT_ID,
            event: "new_note",
            item: { title: item.title, assigned_to: noteAuthor },
            note: { author: noteAuthor, content: newNote.trim() },
          }),
        }).catch(() => {});
      }
    }
  };

  const handleEditNote = (note: TrackerNote) => {
    setEditingNoteId(note.id);
    setEditingNoteContent(note.content);
  };

  const handleSaveNote = async (noteId: string) => {
    if (!editingNoteContent.trim()) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("tracker_notes")
      .update({ content: editingNoteContent.trim() })
      .eq("id", noteId);
    if (!error) {
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, content: editingNoteContent.trim() } : n)),
      );
    }
    setEditingNoteId(null);
  };

  return (
    <Sheet open={open} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start justify-between">
            <SheetTitle className="text-left pr-4 flex-1">
              {editingTitle ? (
                <Input
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); markDirty(); }}
                  onBlur={() => setEditingTitle(false)}
                  onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
                  autoFocus
                  className="text-lg font-bold"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingTitle(true)}
                  className="text-left hover:text-primary transition-colors"
                >
                  {title || item.title}
                </button>
              )}
            </SheetTitle>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Save button — sticky at top when dirty */}
          {dirty && (
            <div className="sticky top-0 z-10 -mx-6 px-6 py-2 bg-background/95 backdrop-blur border-b border-primary/20">
              <Button onClick={handleSave} size="sm" className="w-full gap-1.5">
                <Save className="h-3.5 w-3.5" />
                Save Changes
              </Button>
            </div>
          )}

          {/* Status pills */}
          <div>
            <label className="mb-2 block text-[10px] uppercase tracking-widest text-muted-foreground">
              Status
            </label>
            <div className="flex flex-wrap gap-1.5">
              {statusOrder.map((s) => {
                const isActive = localStatus === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleStatusChange(s)}
                    className={`rounded-full border px-3 py-2 text-xs font-medium transition-all duration-150 active:scale-95 min-h-[36px] ${
                      isActive
                        ? `${statusColors[s]} ring-1 ring-offset-1 ring-offset-background ${
                            s === "done" ? "ring-green-500/50" :
                            s === "in_progress" ? "ring-blue-500/50" :
                            s === "blocked" ? "ring-red-500/50" :
                            "ring-border"
                          }`
                        : "border-border bg-card text-muted-foreground hover:bg-elevated hover:border-muted-foreground/50"
                    }`}
                  >
                    {s === "done" && isActive ? "✓ " : ""}{statusLabels[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority + Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-muted-foreground">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => { setPriority(e.target.value as TrackerPriority); markDirty(); }}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                {(["high", "medium", "low"] as TrackerPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {priorityLabels[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-muted-foreground">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value as TrackerCategory); markDirty(); }}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                {(["data_needed", "question", "decision", "task", "bug", "feature"] as TrackerCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {categoryLabels[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-muted-foreground">
                Assigned To
              </label>
              <Input
                value={assignedTo}
                onChange={(e) => { setAssignedTo(e.target.value); markDirty(); }}
                placeholder="developer, client..."
                className="h-9"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-muted-foreground">
                Due Date
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => { setDueDate(e.target.value); markDirty(); }}
                className="h-9"
              />
            </div>
          </div>

          {/* ═══ TIER 1: Description (original task details) ═══ */}
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-muted-foreground">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); markDirty(); }}
              placeholder="Add details..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Save button at bottom too */}
          {dirty && (
            <Button onClick={handleSave} size="sm" className="w-full gap-1.5">
              <Save className="h-3.5 w-3.5" />
              Save Changes
            </Button>
          )}

          {notesLoading && (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading notes...
            </div>
          )}

          {/* ═══ TIER 2: Dev Team Comments ═══ */}
          <NoteSection
            label="Dev Team"
            icon={<Code2 className="h-3.5 w-3.5 text-blue-400" />}
            accentColor="blue"
            notes={notes.filter((n) => isDevTeam(n.author))}
            editingNoteId={editingNoteId}
            editingNoteContent={editingNoteContent}
            setEditingNoteContent={setEditingNoteContent}
            onEditNote={handleEditNote}
            onSaveNote={handleSaveNote}
            onCancelEdit={() => setEditingNoteId(null)}
          />

          {/* ═══ TIER 3: Client Comments ═══ */}
          <NoteSection
            label="Client"
            icon={<Users className="h-3.5 w-3.5 text-amber-400" />}
            accentColor="amber"
            notes={notes.filter((n) => !isDevTeam(n.author))}
            editingNoteId={editingNoteId}
            editingNoteContent={editingNoteContent}
            setEditingNoteContent={setEditingNoteContent}
            onEditNote={handleEditNote}
            onSaveNote={handleSaveNote}
            onCancelEdit={() => setEditingNoteId(null)}
          />

          {/* Add note — auto-tagged to your team */}
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-muted-foreground">
              Add Comment
              {noteAuthor && (
                <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                  isDevTeam(noteAuthor)
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                }`}>
                  {isDevTeam(noteAuthor) ? "Dev Team" : "Client"}
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <Input
                value={noteAuthor}
                onChange={(e) => setNoteAuthor(e.target.value)}
                placeholder="Your name"
                className="h-8 w-28 text-xs"
              />
              <div className="flex-1 relative">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a comment..."
                  rows={2}
                  className="resize-none pr-10"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleAddNote();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="absolute right-2 bottom-2 h-7 w-7 p-0"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* ═══ Attached Files ═══ */}
          <ItemFiles itemId={item.id} />

          {/* Delete */}
          <div className="border-t border-border pt-4">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-destructive">Delete this item?</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => { onDelete(item.id); onClose(); }}
                  className="h-7"
                >
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDelete(false)}
                  className="h-7"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete Item
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
