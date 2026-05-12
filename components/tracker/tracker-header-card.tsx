"use client";

import {
  List,
  Kanban,
  RefreshCw,
  MessageCircle,
  FolderOpen,
  Package,
  ImagePlus,
  Loader2,
} from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { TrackerBoardSwitcher } from "./tracker-board-switcher";
import { TrackerUserMenu } from "./tracker-user-menu";
import type { Database } from "@/lib/supabase/database.types";

type TrackerProject = Database["public"]["Tables"]["tracker_projects"]["Row"];
type ViewMode = "kanban" | "list" | "files" | "deliverables";

interface Props {
  project: TrackerProject | null;
  projects: TrackerProject[];
  currentProjectId: string;
  currentUserProfileId: string | null;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  refreshing: boolean;
  onRefresh: () => void;
  chatOpen: boolean;
  onToggleChat: () => void;
  // Forestry-only additions — bobi-worktracker doesn't pass these.
  // Threading them through here keeps HeaderCard generic; BoardSwitcher
  // hides itself when onProjectChange is absent (e.g. standalone /tracker).
  onProjectChange?: (id: string) => void;
  showSiteBuild?: boolean;
  userEmail?: string | null;
  // Banner upload — admin (or owner of personal board) only. Renders an
  // overlay button on the banner image when present.
  canEditBanner?: boolean;
  onUploadBanner?: (file: File) => void;
  bannerUploading?: boolean;
  // Forestry-only: hides the Deliverables view from non-admin (or
  // non-site-build) surfaces. Deliverables are Bees-internal billing
  // artifacts — must NEVER render on the Company board or for office /
  // foreman roles. Defaults to true (visible) so standalone /tracker
  // keeps full access.
  showDeliverables?: boolean;
}

const VIEWS = [
  { key: "kanban", label: "Board", Icon: Kanban },
  { key: "list", label: "List", Icon: List },
  { key: "files", label: "Files", Icon: FolderOpen },
  { key: "deliverables", label: "Deliverables", Icon: Package },
] as const;

export function TrackerHeaderCard({
  project,
  projects,
  currentProjectId,
  currentUserProfileId,
  view,
  onViewChange,
  refreshing,
  onRefresh,
  chatOpen,
  onToggleChat,
  onProjectChange,
  showSiteBuild,
  userEmail,
  canEditBanner,
  onUploadBanner,
  bannerUploading,
  showDeliverables = true,
}: Props) {
  const visibleViews = showDeliverables
    ? VIEWS
    : VIEWS.filter((v) => v.key !== "deliverables");
  const colsClass =
    visibleViews.length === 4
      ? "grid-cols-4"
      : visibleViews.length === 3
        ? "grid-cols-3"
        : "grid-cols-2";
  const title = project?.name ?? "Work Tracker";
  const subtitle =
    project?.client_name && project?.phase
      ? `${project.client_name} · ${project.phase}`
      : (project?.client_name ?? project?.phase ?? null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleBannerClick = () => fileInputRef.current?.click();
  const handleBannerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadBanner) onUploadBanner(file);
    // reset so re-selecting the same file fires onChange again
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      {/* Banner with project title overlay (opaque card top-left). The
          overlay floats over the image so a long project name auto-sizes
          its card without resizing any of the layout cells below.
          Forestry schema doesn't carry banner_url today — the cast +
          gradient fallback keeps the visual identical to bobi-worktracker
          when a banner is absent, and migrating to add the column later
          is a one-line schema change if we ever want it. */}
      <div
        className="relative w-full overflow-hidden rounded-lg border border-border"
        style={{ aspectRatio: "40 / 7" }}
      >
        {(project as { banner_url?: string | null } | null)?.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={(project as { banner_url?: string | null }).banner_url ?? ""}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-muted/40 to-muted/10" />
        )}
        <div className="absolute left-4 top-4 inline-block rounded-lg border border-border bg-card px-4 py-2">
          <h1 className="text-base font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && (
            <span className="block text-xs text-muted-foreground">
              {subtitle}
            </span>
          )}
        </div>

        {/* Admin (or personal-board owner) banner upload — overlay button.
            Forestry-only: bobi-worktracker has its own per-account banner
            upload flow that doesn't need a per-project overlay. */}
        {canEditBanner && onUploadBanner && (
          <>
            <button
              type="button"
              onClick={handleBannerClick}
              disabled={bannerUploading}
              className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md border border-border bg-card/90 px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-card hover:text-foreground disabled:opacity-60"
              title="Change banner image"
            >
              {bannerUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" />
              )}
              {bannerUploading ? "Uploading…" : "Banner"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleBannerFile}
              className="hidden"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
      {/* Cell 1 — board switcher (Company / Site Build / Personal). Hides
          itself when onProjectChange isn't provided (e.g. standalone
          /tracker, which is single-project) or when only one board is
          available to this user. */}
      <div className="flex items-center rounded-lg border border-border bg-card/60 p-2">
        <TrackerBoardSwitcher
          projects={projects}
          currentProjectId={currentProjectId}
          currentUserProfileId={currentUserProfileId}
          onProjectChange={onProjectChange}
          showSiteBuild={showSiteBuild}
          userEmail={userEmail}
        />
      </div>

      {/* Cell 2 — center-justified: view toggle, stretches to fill cell */}
      <div className="flex items-center rounded-lg border border-border bg-card/60 p-2">
        <div className={`grid w-full gap-1 ${colsClass}`}>
          {visibleViews.map(({ key, label, Icon }) => {
            const active = view === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onViewChange(key)}
                className={`flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-transparent text-amber-400 hover:text-amber-300"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cell 3 — right-justified: refresh + chat + user */}
      <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-border bg-card/60 px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          disabled={refreshing}
          onClick={onRefresh}
          className="h-8 gap-1.5 text-xs text-muted-foreground transition-all hover:text-foreground active:scale-95"
          title="Refresh all data"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>

        {/* Chat button removed — the Site Build / per-project chat panel
            became redundant once the Communications page surfaced all 4
            ops chats with role-filtered tabs. Chat lives at /communications
            now. The chatOpen / onToggleChat props stay on the interface
            for mirror compatibility with bobi-worktracker but render
            nothing on this surface. */}

        <TrackerUserMenu />
      </div>
      </div>
    </div>
  );
}
