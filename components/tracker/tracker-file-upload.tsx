"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Loader2, FileIcon } from "lucide-react";

interface Props {
  projectId: string;
  itemId?: string;
  uploadedBy: string;
  uploadedById?: string;
  onUploaded: () => void;
  compact?: boolean;
  folderId?: string | null;
}

export function TrackerFileUpload({
  projectId,
  itemId,
  uploadedBy,
  uploadedById,
  onUploaded,
  compact,
  folderId,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!files.length) return;
      setUploading(true);
      setError(null);

      let anySuccess = false;

      try {
        for (const file of Array.from(files)) {
          // Skip dotfiles (e.g. .DS_Store)
          if (file.name.startsWith(".")) {
            setError(`Dotfiles like "${file.name}" cannot be uploaded.`);
            continue;
          }
          const form = new FormData();
          form.append("file", file);
          form.append("projectId", projectId);
          form.append("uploadedBy", uploadedBy);
          if (uploadedById) form.append("uploadedById", uploadedById);
          if (itemId) form.append("itemId", itemId);
          if (folderId) form.append("folderId", folderId);

          const res = await fetch("/api/tracker/drive", {
            method: "POST",
            body: form,
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "Upload failed" }));
            setError(err.error || "Upload failed");
            console.error("Upload error:", err);
          } else {
            anySuccess = true;
          }
        }

        if (anySuccess) onUploaded();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [projectId, itemId, uploadedBy, uploadedById, onUploaded, folderId],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        uploadFiles(e.dataTransfer.files);
      }
    },
    [uploadFiles],
  );

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Upload File
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
        dragOver
          ? "border-primary bg-primary/5"
          : "border-border hover:border-muted-foreground/30"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && uploadFiles(e.target.files)}
      />

      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Uploading to Drive...</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-card border border-border">
            <FileIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-sm font-medium text-primary hover:underline"
            >
              Choose files
            </button>
            <span className="text-sm text-muted-foreground"> or drag and drop</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Files are stored in Google Drive
          </p>
          {error && (
            <p className="text-xs text-red-400 mt-1 max-w-md break-words">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
