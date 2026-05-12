"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTrackerItems } from "@/lib/queries/get-tracker-items";
import { getTrackerProjects } from "@/lib/queries/get-tracker-projects";
import { TrackerHeaderCard } from "./tracker-header-card";
import { TrackerStatsCard } from "./tracker-stats-card";
import { TrackerFilterBar, type TrackerFilters } from "./tracker-filter-bar";
import { TrackerListView } from "./tracker-list-view";
import { TrackerKanbanView } from "./tracker-kanban-view";
import { TrackerItemDetail } from "./tracker-item-detail";
import { TrackerNewItemForm } from "./tracker-new-item-dialog";
import { TrackerFilesPanel } from "./tracker-files-panel";
import { TrackerDeliverablesPanel } from "./tracker-deliverables-panel";
import { useTrackerAuth } from "./tracker-auth-provider";
import type { Database } from "@/lib/supabase/database.types";
import type { TrackerStatus, TrackerCategory, TrackerPriority } from "./tracker-utils";

type TrackerItem = Database["public"]["Tables"]["tracker_items"]["Row"];
type TrackerProject = Database["public"]["Tables"]["tracker_projects"]["Row"];

// Stable empty-array references so consumers' memos don't bail out
// when items/projects haven't loaded yet.
const EMPTY_ITEMS: TrackerItem[] = [];
const EMPTY_PROJECTS: TrackerProject[] = [];

type ViewMode = "kanban" | "list" | "files" | "deliverables";

interface Props {
  projectId: string;
  // Forestry-only: enables the BoardSwitcher inside HeaderCard.
  // When omitted (e.g. standalone /tracker), the switcher hides itself.
  onProjectChange?: (id: string) => void;
  showSiteBuild?: boolean;
  userEmail?: string | null;
  // Forestry-only: gates the banner upload overlay. Pass true for admin
  // on company/site_build boards, or for the owner of a personal board.
  canEditBanner?: boolean;
  // Forestry-only: drops the `mx-auto max-w-[1400px]` reading-width cap
  // when embedded in the main app's Work Tracker tab, where the parent
  // shell already owns layout. Standalone /tracker keeps the cap.
  fullWidth?: boolean;
  // Forestry-only: hides the Deliverables view tab AND blocks the panel
  // from rendering even if the view state somehow lands there.
  // Deliverables are Bees-internal billing artifacts (Item 7 / 8 / etc.)
  // — must NEVER show on the Company board or to office / foreman.
  showDeliverables?: boolean;
}

export function TrackerDashboard({
  projectId,
  onProjectChange,
  showSiteBuild,
  userEmail,
  canEditBanner,
  fullWidth,
  showDeliverables = true,
}: Props) {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { profile } = useTrackerAuth();
  const [bannerUploading, setBannerUploading] = useState(false);

  // Banner upload: PUT to Supabase Storage `tracker-banners`, then write
  // the public URL onto tracker_projects.banner_url. Same pattern used
  // for profile-photos elsewhere in this app.
  const handleUploadBanner = useCallback(
    async (file: File) => {
      setBannerUploading(true);
      try {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
        const path = `${projectId}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("tracker-banners")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (uploadErr) throw uploadErr;
        const { data: pub } = supabase.storage
          .from("tracker-banners")
          .getPublicUrl(path);
        const { error: updateErr } = await supabase
          .from("tracker_projects")
          .update({ banner_url: pub.publicUrl })
          .eq("id", projectId);
        if (updateErr) throw updateErr;
        await queryClient.invalidateQueries({ queryKey: ["trackerProjects"] });
      } catch (err) {
        console.error("Banner upload failed:", err);
        window.alert(
          err instanceof Error
            ? `Banner upload failed: ${err.message}`
            : "Banner upload failed.",
        );
      } finally {
        setBannerUploading(false);
      }
    },
    [projectId, supabase, queryClient],
  );

  // Queries — Infinity-cache pattern (mutations explicitly invalidate). Avoids
  // the "5 min idle → cache GC → fresh fetch hangs" failure mode that was
  // showing up as a perpetual spinner on standalone /tracker.
  const { data: projects = EMPTY_PROJECTS, isLoading: projectsLoading } = useQuery({
    queryKey: ["trackerProjects"],
    queryFn: getTrackerProjects,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 0,
  });
  const project = projects.find((p) => p.id === projectId) ?? null;

  const { data: items = EMPTY_ITEMS, isLoading: itemsLoading } = useQuery({
    queryKey: ["trackerItems", projectId],
    queryFn: () => getTrackerItems(projectId),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 0,
  });

  const loading = projectsLoading || itemsLoading;

  // Refresh state
  const [refreshing, setRefreshing] = useState(false);

  // View state
  const [view, setView] = useState<ViewMode>("kanban");

  // Force-bounce off deliverables if the caller drops permission mid-session
  // (e.g. switching from Site Build to Company on the embedded tab).
  useEffect(() => {
    if (!showDeliverables && view === "deliverables") setView("kanban");
  }, [showDeliverables, view]);
  const [selectedItem, setSelectedItem] = useState<TrackerItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // chatOpen retained as a const-false so the chat-shrink margin class
  // and the HeaderCard prop interface stay structurally identical to
  // bobi-worktracker (mirror compatibility). Never flips true now that
  // the Chat button + panel were removed in favor of /communications.
  const chatOpen = false;
  const [showAddForm, setShowAddForm] = useState(false);
  const [filters, setFilters] = useState<TrackerFilters>({
    search: "",
    categories: [],
    priorities: [],
    statuses: [],
    assignedTo: null,
    dueDate: null,
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "/") { e.preventDefault(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Roster for the Assign-To dropdown + filter pills, seeded per board scope.
  // Before the multi-board refactor, the legacy Company-board work-tracker
  // had a hardcoded trackerUsers list (Jaime, Jose, Nancy, Carolina, Agustin,
  // Maya). When all boards routed through this single component, that list
  // was dropped — only items already assigned to someone surfaced as options,
  // so a fresh-board Add Task only saw "Bees" and "Jaime". Restoring the
  // per-scope roster here.
  //
  // Site Build / Bees+Jaime DM = dev coordination → Bees + Jaime only.
  // Personal = the user's own board → that user only.
  // Company / ops → full team.
  const assignees = useMemo(() => {
    const scope = (project as { scope?: string | null } | null)?.scope ?? null;
    let seed: string[];
    if (scope === "site_build") {
      seed = ["Bees", "Jaime"];
    } else if (scope === "personal") {
      // owned_by_email → take the local-part for display (matches the
      // bootstrap pattern in components/pages/work-tracker.tsx)
      const email = (project as { owned_by_email?: string | null } | null)?.owned_by_email;
      const display = email ? email.split("@")[0] : "Me";
      seed = [display];
    } else {
      // Company / ops / unknown → full forestry team. Order matches who's
      // most-likely to be assigned in practice. Bees is intentionally
      // omitted — Site Build is the dev-coordination board, not Company.
      seed = ["Jaime", "Jose", "Nancy", "Carolina", "Agustin", "Maya"];
    }
    const set = new Set<string>(seed);
    // Plus any assignee that's already used on existing items (legacy or
    // manually-typed names) — keeps the list complete even if someone
    // assigned to a name not in the seed.
    for (const item of items) {
      if (item.assigned_to) set.add(item.assigned_to);
    }
    return Array.from(set);
  }, [items, project]);

  // (knownUsers list for @mention autocomplete was used only by the
  // removed TrackerChatPanel — dropped along with the Chat button.)

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (
          !item.title.toLowerCase().includes(q) &&
          !(item.description ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      if (filters.categories.length > 0 && !filters.categories.includes(item.category as TrackerCategory))
        return false;
      if (filters.priorities.length > 0 && !filters.priorities.includes((item.priority ?? "medium") as TrackerPriority))
        return false;
      if (filters.statuses.length > 0 && !filters.statuses.includes((item.status ?? "pending") as TrackerStatus))
        return false;
      if (filters.assignedTo && item.assigned_to !== filters.assignedTo)
        return false;
      if (filters.dueDate) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekEnd = new Date(today);
        weekEnd.setDate(today.getDate() + 7);
        const due = item.due_date ? new Date(item.due_date) : null;
        switch (filters.dueDate) {
          case "overdue":
            if (!due || due >= today) return false;
            break;
          case "today":
            if (!due || due.toDateString() !== today.toDateString())
              return false;
            break;
          case "thisWeek":
            if (!due || due < today || due > weekEnd) return false;
            break;
          case "noDate":
            if (due) return false;
            break;
        }
      }
      return true;
    });
  }, [items, filters]);

  // Invalidate helper
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["trackerItems", projectId] });
  }, [queryClient, projectId]);

  // Mutations
  const updateItem = useMutation({
    mutationFn: async ({ id, fields }: { id: string; fields: Record<string, unknown> }) => {
      const updates = { ...fields } as Record<string, unknown>;
      if (fields.status === "done") updates.completed_at = new Date().toISOString();
      else if (fields.status) updates.completed_at = null;
      const { error } = await supabase.from("tracker_items").update(updates).eq("id", id);
      if (error) throw error;
      // Capture item info now before queries invalidate
      const item = items.find((i) => i.id === id);
      return { id, fields, title: item?.title, assigned_to: item?.assigned_to };
    },
    onMutate: async ({ id, fields }) => {
      await queryClient.cancelQueries({ queryKey: ["trackerItems", projectId] });
      const previous = queryClient.getQueryData<TrackerItem[]>(["trackerItems", projectId]);
      // Optimistic update in cache
      queryClient.setQueryData<TrackerItem[]>(
        ["trackerItems", projectId],
        (old) => old?.map((i) => i.id === id ? { ...i, ...fields } as TrackerItem : i) ?? [],
      );
      if (selectedItem?.id === id) {
        setSelectedItem({ ...selectedItem, ...fields } as TrackerItem);
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["trackerItems", projectId], context.previous);
      }
    },
    onSuccess: (result) => {
      invalidate();

      // Send TG notification when an item is marked done
      if (result?.fields.status === "done" && result.title) {
        fetch("/api/tracker/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            event: "item_done",
            item: { title: result.title, assigned_to: result.assigned_to },
          }),
        }).catch(() => {});
      }
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tracker_items").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onMutate: async (id: string) => {
      // Cancel outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: ["trackerItems", projectId] });
      const previous = queryClient.getQueryData<TrackerItem[]>(["trackerItems", projectId]);
      // Optimistically remove from cache
      queryClient.setQueryData<TrackerItem[]>(
        ["trackerItems", projectId],
        (old) => old?.filter((i) => i.id !== id) ?? [],
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(["trackerItems", projectId], context.previous);
      }
    },
    onSettled: () => invalidate(),
  });

  const createItem = useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const payload = { status: "pending", ...input } as Database["public"]["Tables"]["tracker_items"]["Insert"];
      const { error } = await supabase.from("tracker_items").insert(payload);
      if (error) {
        console.error("Failed to create item:", error);
        throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      setShowAddForm(false);
    },
  });

  const reorderItems = useMutation({
    mutationFn: async (updates: { id: string; sort_order: number }[]) => {
      await Promise.all(
        updates.map(({ id, sort_order }) =>
          supabase.from("tracker_items").update({ sort_order }).eq("id", id),
        ),
      );
    },
    onSuccess: invalidate,
  });

  const bulkUpdate = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "done") updates.completed_at = new Date().toISOString();
      else updates.completed_at = null;
      const { error } = await supabase.from("tracker_items").update(updates).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setSelectedIds(new Set());
    },
  });

  const clearDoneItems = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("tracker_items")
        .delete()
        .eq("project_id", projectId)
        .eq("status", "done");
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Handlers
  const handleItemClick = (item: TrackerItem) => setSelectedItem(item);
  const handleUpdate = (id: string, fields: Record<string, unknown>) => updateItem.mutate({ id, fields });
  const handleDelete = (id: string) => {
    deleteItem.mutate(id);
    if (selectedItem?.id === id) setSelectedItem(null);
  };
  const handleCreateItem = (input: Record<string, unknown>) => createItem.mutate(input);
  const handleStatusChange = (itemId: string, newStatus: TrackerStatus) => {
    updateItem.mutate({ id: itemId, fields: { status: newStatus } });
  };
  const handleReorder = (updates: { id: string; sort_order: number }[]) => reorderItems.mutate(updates);
  const handleBulkAction = (action: "done" | "in_progress" | "pending") => {
    bulkUpdate.mutate({ ids: Array.from(selectedIds), status: action });
  };
  const handleClearDone = () => {
    const doneCount = items.filter((i) => i.status === "done").length;
    if (doneCount === 0) return;
    if (window.confirm(`Delete all ${doneCount} cards from the Done column? This cannot be undone.`)) {
      clearDoneItems.mutate();
    }
  };
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.race([
        queryClient.invalidateQueries(),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    } catch (e) {
      console.error("Refresh error:", e);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);
  // No-op — Chat button was removed but HeaderCard still expects the prop
  // for mirror compatibility with bobi-worktracker.
  const handleToggleChat = useCallback(() => {}, []);
  const handleToggleAddForm = useCallback(() => setShowAddForm((s) => !s), []);

  return (
    <div
      className={`${
        fullWidth
          ? "" // block default (width:auto) so sm:mr-[380px] actually shrinks
          : "mx-auto max-w-[1400px] px-4 py-4 md:px-6"
      } transition-[margin] duration-200 ${chatOpen ? "sm:mr-[380px]" : ""}`}
    >
      {/* Header: banner + project title overlay, board switcher, view toggle, refresh/chat/user-menu */}
      <TrackerHeaderCard
        project={project}
        projects={projects}
        currentProjectId={projectId}
        currentUserProfileId={profile?.id ?? null}
        view={view}
        onViewChange={setView}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        chatOpen={chatOpen}
        onToggleChat={handleToggleChat}
        onProjectChange={onProjectChange}
        showSiteBuild={showSiteBuild}
        userEmail={userEmail}
        canEditBanner={canEditBanner}
        onUploadBanner={canEditBanner ? handleUploadBanner : undefined}
        bannerUploading={bannerUploading}
        showDeliverables={showDeliverables}
      />

      {/* Status counts strip — replaces the old summary-strip */}
      <div className="mt-4">
        <TrackerStatsCard items={items} />
      </div>

      {/* Filters (only for kanban/list views) */}
      {view !== "files" && view !== "deliverables" && (
        <div className="mt-4">
          <TrackerFilterBar
            filters={filters}
            onChange={setFilters}
            assignees={assignees}
            isPersonalBoard={false}
            canAdd
            onToggleAddForm={handleToggleAddForm}
          />
        </div>
      )}

      {/* Inline add form */}
      {showAddForm && view !== "files" && view !== "deliverables" && (
        <div className="mt-3">
          <TrackerNewItemForm
            projectId={projectId}
            open={showAddForm}
            onClose={() => setShowAddForm(false)}
            onSubmit={handleCreateItem}
            assignees={assignees}
          />
        </div>
      )}

      {/* Content */}
      <div className="mt-3">
        {view === "deliverables" && showDeliverables ? (
          // editorEmailOverride: forwards the main forestry app's auth
          // email (useAuth()) into the panel so the Sent? / Paid?
          // buttons render for admins regardless of whether they have
          // a separate /tracker session. Without this Jaime saw no
          // buttons because his TrackerAuthProvider session was null —
          // he'd never logged into /tracker directly.
          <TrackerDeliverablesPanel editorEmailOverride={userEmail ?? null} />
        ) : view === "files" ? (
          <TrackerFilesPanel projectId={projectId} />
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : view === "kanban" ? (
          <TrackerKanbanView
            items={filteredItems}
            onItemClick={handleItemClick}
            onStatusChange={handleStatusChange}
            onReorder={handleReorder}
            onClearDone={handleClearDone}
          />
        ) : (
          <TrackerListView
            items={filteredItems}
            onItemClick={handleItemClick}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSelectAll={() => setSelectedIds(new Set(filteredItems.map((i) => i.id)))}
            onClearSelection={() => setSelectedIds(new Set())}
            onBulkAction={handleBulkAction}
            onStatusChange={handleStatusChange}
          />
        )}
      </div>

      {/* Item detail */}
      <TrackerItemDetail
        item={selectedItem}
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      {/* Chat panel removed — chat lives at /communications now (4 ops
          channels with role-filtered tabs). The Site Build per-project
          panel was redundant + confusing once Communications shipped. */}
    </div>
  );
}
