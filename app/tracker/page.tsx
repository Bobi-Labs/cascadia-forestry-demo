"use client";

import { Loader2 } from "lucide-react";
import { TrackerDashboard } from "@/components/tracker/tracker-dashboard";
import { useTrackerAuth } from "@/components/tracker/tracker-auth-provider";
import { TRACKER_PROJECT_ID } from "@/components/tracker/tracker-utils";

export default function TrackerPage() {
  const { user, isLoading } = useTrackerAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Auth provider handles redirect if not logged in
  if (!user) return null;

  return <TrackerDashboard projectId={TRACKER_PROJECT_ID} />;
}
