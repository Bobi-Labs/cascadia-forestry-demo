"use client";

import { useState, useCallback } from "react";
import {
  Download,
  Trash2,
  FileText,
  Image,
  FileSpreadsheet,
  File,
  Loader2,
  Pencil,
  Check,
  X,
  Link2,
  ExternalLink,
  FolderOpen,
  ChevronRight,
  Home,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { paginatedSelect } from "@/lib/supabase/paginate";
import { TrackerFileUpload } from "./tracker-file-upload";
import { useTrackerAuth } from "./tracker-auth-provider";
import type { Database } from "@/lib/supabase/database.types";

type TrackerFileMeta = Database["public"]["Tables"]["tracker_files"]["Row"];

const FOLDER_MIME = "application/vnd.google-apps.folder";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: string;
  webViewLink: string;
}

interface MergedFile {
  driveId: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: string;
  webViewLink: string;
  isFolder: boolean;
  dbId?: string;
  uploadedBy?: string;
  note?: string | null;
  linkedItemTitle?: string | null;
}

interface BreadcrumbItem {
  id: string | null; // null = root
  name: string;
}

interface Props {
  projectId: string;
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File;
  if (mimeType === FOLDER_MIME) return FolderOpen;
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.includes("pdf")) return FileText;
  if (
    mimeType.includes("sheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("csv")
  )
    return FileSpreadsheet;
  return File;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TrackerFilesPanel({ projectId }: Props) {
  const { profile, displayName } = useTrackerAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");

  // Folder navigation state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: "Project Files" },
  ]);

  // Fetch files from Google Drive via API route
  const { data: driveFiles = [], isLoading: driveLoading, error: driveError } = useQuery({
    queryKey: ["trackerDriveFiles", currentFolderId],
    queryFn: async () => {
      const url = currentFolderId
        ? `/api/tracker/drive?folderId=${currentFolderId}`
        : "/api/tracker/drive";
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to fetch Drive files" }));
        throw new Error(err.error || "Failed to fetch Drive files");
      }
      const json = await res.json();
      return json.files as DriveFile[];
    },
    retry: 1,
    staleTime: 30_000,
  });

  // Fetch Supabase metadata (notes, linked items, uploaded_by). Paginated
  // to bypass the PostgREST 1000-row default cap. Note: this query uses
  // an embedded `tracker_items(title)` select. If it ever exhibits the
  // deliverable_* wedge symptom (hang at 5s+), swap to rawSelect — see
  // lib/supabase/raw-rest.ts.
  const { data: metaFiles = [], isLoading: metaLoading } = useQuery({
    queryKey: ["trackerFiles", projectId],
    queryFn: async () => {
      return paginatedSelect<TrackerFileMeta & { tracker_items: { title: string } | null }>(
        (from, to) =>
          supabase
            .from("tracker_files")
            .select("*, tracker_items(title)")
            .eq("project_id", projectId)
            .order("created_at", { ascending: false })
            .range(from, to),
      );
    },
    retry: 1,
    staleTime: 30_000,
  });

  // Merge Drive files with Supabase metadata (filter out dotfiles like .DS_Store)
  const files: MergedFile[] = driveFiles.filter((df) => !df.name.startsWith(".")).map((df) => {
    const meta = metaFiles.find(
      (m) => m.file_path === df.id || m.file_name === df.name,
    );
    return {
      driveId: df.id,
      name: df.name,
      mimeType: df.mimeType,
      size: df.size,
      createdTime: df.createdTime,
      webViewLink: df.webViewLink,
      isFolder: df.mimeType === FOLDER_MIME,
      dbId: meta?.id,
      uploadedBy: meta?.uploaded_by ?? undefined,
      note: meta ? (meta as Record<string, unknown>).note as string | null : null,
      linkedItemTitle: meta?.tracker_items?.title ?? null,
    };
  });

  const isLoading = driveLoading || metaLoading;

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["trackerDriveFiles", currentFolderId] });
    queryClient.invalidateQueries({ queryKey: ["trackerFiles", projectId] });
  }, [queryClient, currentFolderId, projectId]);

  const navigateToFolder = (folderId: string, folderName: string) => {
    setCurrentFolderId(folderId);
    setBreadcrumbs((prev) => [...prev, { id: folderId, name: folderName }]);
    setConfirmDeleteId(null);
    setEditingNoteId(null);
  };

  const navigateToBreadcrumb = (index: number) => {
    const target = breadcrumbs[index];
    setCurrentFolderId(target.id);
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setConfirmDeleteId(null);
    setEditingNoteId(null);
  };

  const handleOpen = (file: MergedFile) => {
    window.open(file.webViewLink, "_blank");
  };

  const handleDelete = async (file: MergedFile) => {
    const res = await fetch(`/api/tracker/drive/${file.driveId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      console.error("Delete failed");
    }
    setConfirmDeleteId(null);
    invalidate();
  };

  const handleSaveNote = async (file: MergedFile) => {
    if (file.dbId) {
      await supabase
        .from("tracker_files")
        .update({ note: editingNoteText.trim() || null } as Record<string, unknown>)
        .eq("id", file.dbId);
    }
    setEditingNoteId(null);
    invalidate();
  };

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <TrackerFileUpload
        projectId={projectId}
        uploadedBy={displayName}
        uploadedById={profile?.id}
        onUploaded={invalidate}
        folderId={currentFolderId}
      />

      {/* Breadcrumb navigation */}
      {breadcrumbs.length > 1 && (
        <nav className="flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.id ?? "root"} className="flex items-center gap-1 shrink-0">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <button
                type="button"
                onClick={() => navigateToBreadcrumb(i)}
                className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${
                  i === breadcrumbs.length - 1
                    ? "text-foreground font-medium"
                    : "hover:text-foreground hover:bg-elevated"
                }`}
              >
                {i === 0 && <Home className="h-3 w-3" />}
                {crumb.name}
              </button>
            </span>
          ))}
        </nav>
      )}

      {/* File list */}
      {driveError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <p className="font-medium">Drive connection error</p>
          <p className="text-xs mt-1 break-words">{driveError.message}</p>
        </div>
      )}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : files.length === 0 && !driveError ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {breadcrumbs.length > 1
            ? "This folder is empty"
            : "No files yet — upload or add files to the shared Drive folder"}
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => {
            const Icon = getFileIcon(file.mimeType);
            const isConfirming = confirmDeleteId === file.driveId;
            const isEditingNote = editingNoteId === file.driveId;

            return (
              <div
                key={file.driveId}
                className={`rounded-lg border border-border bg-card p-3 ${
                  file.isFolder ? "cursor-pointer hover:bg-elevated transition-colors" : ""
                }`}
                onClick={file.isFolder ? () => navigateToFolder(file.driveId, file.name) : undefined}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                    file.isFolder ? "bg-blue-500/10" : "bg-elevated"
                  }`}>
                    <Icon className={`h-4 w-4 ${
                      file.isFolder ? "text-blue-400" : "text-muted-foreground"
                    }`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-sm font-medium ${
                      file.isFolder ? "text-blue-400" : "text-foreground"
                    }`}>
                      {file.name}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {file.isFolder ? (
                        <span>Folder</span>
                      ) : (
                        <span>{formatFileSize(file.size)}</span>
                      )}
                      {file.uploadedBy && (
                        <>
                          <span>·</span>
                          <span>{file.uploadedBy}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>
                        {new Date(file.createdTime).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" },
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {!file.isFolder && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = `/api/tracker/drive/${file.driveId}`;
                          a.download = file.name;
                          a.click();
                        }}
                        className="h-7 w-7 p-0"
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpen(file)}
                      className="h-7 w-7 p-0"
                      title="Open in Drive"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>

                    {!file.isFolder && (
                      <>
                        {isConfirming ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(file)}
                              className="h-7 text-[10px]"
                            >
                              Confirm
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmDeleteId(null)}
                              className="h-7 text-[10px]"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDeleteId(file.driveId)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Linked task badge */}
                {file.linkedItemTitle && (
                  <div className="mt-1.5 ml-12 flex items-center gap-1.5">
                    <Link2 className="h-3 w-3 text-blue-400" />
                    <span className="text-[10px] font-medium text-blue-400 truncate">
                      {file.linkedItemTitle}
                    </span>
                  </div>
                )}

                {/* Note display / edit (files only) */}
                {!file.isFolder && file.dbId && (
                  <div className="mt-1.5 ml-12">
                    {isEditingNote ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          placeholder="Add a note..."
                          className="h-7 text-xs flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveNote(file);
                            if (e.key === "Escape") setEditingNoteId(null);
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSaveNote(file)}
                          className="h-7 w-7 p-0"
                        >
                          <Check className="h-3.5 w-3.5 text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingNoteId(null)}
                          className="h-7 w-7 p-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : file.note ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNoteId(file.driveId);
                          setEditingNoteText(file.note ?? "");
                        }}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors text-left"
                      >
                        {file.note}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNoteId(file.driveId);
                          setEditingNoteText("");
                        }}
                        className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors flex items-center gap-1"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                        Add note
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
