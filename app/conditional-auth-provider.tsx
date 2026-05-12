"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "@/lib/auth-context";

/**
 * Wraps children in the main app's AuthProvider ONLY for non-tracker routes.
 * The /tracker route has its own TrackerAuthProvider that handles auth independently.
 * Without this, the main AuthProvider tries to fetch from public.users for tracker-only
 * users (who don't have a row there), causing session errors.
 */
export function ConditionalAuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Skip main AuthProvider for tracker routes — they have their own auth
  if (pathname?.startsWith("/tracker")) {
    return <>{children}</>;
  }

  return <AuthProvider>{children}</AuthProvider>;
}
