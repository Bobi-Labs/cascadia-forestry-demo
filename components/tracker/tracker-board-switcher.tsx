"use client";

// Forestry BoardSwitcher.
//
// Mirrors bobi-worktracker's switcher visually, but works against the
// forestry data model:
//   - boards are picked by tracker_projects.scope ('company' / 'site_build'
//     / 'personal') instead of bobi-worktracker's 'team'/'personal' shape
//   - personal board is matched by tracker_projects.owned_by_email against
//     the logged-in user's email instead of profile.id
//   - switching is by callback (onProjectChange) since the in-app Work
//     Tracker tab uses state — no routes to push to. When callback is
//     absent (e.g. the standalone /tracker route, which is single-project
//     Site Build only), the switcher hides itself.
//
// Site Build is admin-only — `showSiteBuild` from the parent gates it.

import { useMemo } from "react";
import type { Database } from "@/lib/supabase/database.types";

type TrackerProject = Database["public"]["Tables"]["tracker_projects"]["Row"];
type Scope = "company" | "site_build" | "personal";

interface Props {
  projects: TrackerProject[];
  currentProjectId: string;
  currentUserProfileId: string | null; // mirror prop, unused on forestry
  onProjectChange?: (id: string) => void;
  showSiteBuild?: boolean;
  userEmail?: string | null;
  className?: string;
}

const SCOPE_LABELS: Record<Scope, string> = {
  company: "Company",
  site_build: "Site Build",
  personal: "Personal",
};

export function TrackerBoardSwitcher({
  projects,
  currentProjectId,
  onProjectChange,
  showSiteBuild = false,
  userEmail,
  className,
}: Props) {
  const visible = useMemo(() => {
    const findByScope = (s: Scope): TrackerProject | null =>
      projects.find((p) => (p as { scope?: string | null }).scope === s) ?? null;

    const findPersonal = (): TrackerProject | null => {
      if (!userEmail) return null;
      return (
        projects.find(
          (p) =>
            (p as { scope?: string | null }).scope === "personal" &&
            p.owned_by_email === userEmail,
        ) ?? null
      );
    };

    const ordered: { scope: Scope; project: TrackerProject | null }[] = [
      { scope: "company", project: findByScope("company") },
      { scope: "site_build", project: showSiteBuild ? findByScope("site_build") : null },
      { scope: "personal", project: findPersonal() },
    ];

    return ordered.filter(
      (e): e is { scope: Scope; project: TrackerProject } => e.project !== null,
    );
  }, [projects, showSiteBuild, userEmail]);

  // Hide entirely when no callback (standalone surface) or only one option.
  if (!onProjectChange || visible.length <= 1) return null;

  const colsClass =
    visible.length === 3
      ? "grid-cols-3"
      : visible.length === 2
        ? "grid-cols-2"
        : "grid-cols-1";

  return (
    <div className={className ?? "w-full"}>
      <div className={`grid w-full gap-1 ${colsClass}`}>
        {visible.map(({ scope, project }) => {
          const active = project.id === currentProjectId;
          return (
            <button
              key={scope}
              type="button"
              onClick={() => onProjectChange(project.id)}
              className={`flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-transparent text-green-300 hover:text-green-200"
              }`}
              title={project.name}
            >
              {SCOPE_LABELS[scope]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
