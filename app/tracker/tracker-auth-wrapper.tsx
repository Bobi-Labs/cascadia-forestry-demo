"use client";

import { TrackerAuthProvider } from "@/components/tracker/tracker-auth-provider";

export function TrackerAuthWrapper({ children }: { children: React.ReactNode }) {
  return <TrackerAuthProvider>{children}</TrackerAuthProvider>;
}
