"use client"

import { useEffect, useState, useMemo } from "react"
import { Loader2 } from "lucide-react"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { TrackerDashboard } from "@/components/tracker/tracker-dashboard"
import { TrackerAuthProvider } from "@/components/tracker/tracker-auth-provider"

// Hardcoded board project IDs. Personal is per-user and looked up
// (or lazy-bootstrapped) by tracker_projects.owned_by_email.
const SITE_BUILD_PROJECT_ID = "10000000-0000-0000-0000-000000000001"
const COMPANY_PROJECT_ID    = "20000000-0000-0000-0000-000000000001"

type BoardScope = "company" | "site_build" | "personal"

export function WorkTrackerPage() {
  const { role } = useApp()
  const { profile } = useAuth()
  const isAdmin = role === "admin"
  const userEmail = profile?.email ?? null

  const supabase = createClient()

  // Active board scope. Defaults to Company. Site Build is admin-only —
  // a non-admin who somehow lands on it gets bumped back.
  const [activeScope, setActiveScope] = useState<BoardScope>("company")
  useEffect(() => {
    if (activeScope === "site_build" && !isAdmin) setActiveScope("company")
  }, [activeScope, isAdmin])

  // Personal board id — looked up by the logged-in user's email, lazy
  // bootstrap on first visit (this is what the previous tab nav did).
  const { data: personalProjectId } = useQuery({
    queryKey: ["trackerPersonalProject", userEmail],
    enabled: !!userEmail,
    queryFn: async () => {
      if (!userEmail) return null
      const { data: found } = await supabase
        .from("tracker_projects")
        .select("id")
        .eq("owned_by_email", userEmail)
        .limit(1)
        .maybeSingle()
      if (found?.id) return found.id
      const { data: created } = await supabase
        .from("tracker_projects")
        .insert({
          name: `${profile?.name ?? userEmail.split("@")[0]} Personal`,
          client_name: "Personal",
          phase: "Personal",
          status: "active",
          scope: "personal",
          owned_by_email: userEmail,
        })
        .select("id")
        .single()
      return created?.id ?? null
    },
    staleTime: 5 * 60_000,
  })

  // Resolve scope → project id.
  const activeProjectId = useMemo(() => {
    if (activeScope === "site_build") return SITE_BUILD_PROJECT_ID
    if (activeScope === "personal") return personalProjectId ?? null
    return COMPANY_PROJECT_ID
  }, [activeScope, personalProjectId])

  // Banner edit gates:
  //   - admin can edit Company + Site Build banners
  //   - any logged-in user can edit their own Personal banner
  const canEditBanner = useMemo(() => {
    if (activeScope === "personal") return !!userEmail
    return isAdmin
  }, [activeScope, isAdmin, userEmail])

  // BoardSwitcher needs to swap scopes when the user clicks a pill. The
  // pill IDs come from tracker_projects rows so we have to map back to
  // the scope they represent.
  const handleProjectChange = (id: string) => {
    if (id === COMPANY_PROJECT_ID) setActiveScope("company")
    else if (id === SITE_BUILD_PROJECT_ID) setActiveScope("site_build")
    else if (id === personalProjectId) setActiveScope("personal")
  }

  // Personal board hasn't loaded yet — render a small spinner instead of
  // mounting TrackerDashboard against a null project.
  if (activeScope === "personal" && !activeProjectId) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <TrackerAuthProvider>
      <TrackerDashboard
        projectId={activeProjectId ?? COMPANY_PROJECT_ID}
        onProjectChange={handleProjectChange}
        showSiteBuild={isAdmin}
        userEmail={userEmail}
        canEditBanner={canEditBanner}
        fullWidth
        // Deliverables are Bees-internal billing artifacts. Only ever
        // visible to admin AND only on the Site Build board. Office /
        // foreman / owner / employee never see them; admin doesn't see
        // them on Company or Personal either.
        showDeliverables={isAdmin && activeScope === "site_build"}
      />
    </TrackerAuthProvider>
  )
}
