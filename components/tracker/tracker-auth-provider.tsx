"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import type { Database } from "@/lib/supabase/database.types";

type TrackerUser = Database["public"]["Tables"]["tracker_users"]["Row"];

interface TrackerAuthContextType {
  user: User | null;
  profile: TrackerUser | null;
  displayName: string;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const TrackerAuthContext = createContext<TrackerAuthContextType>({
  user: null,
  profile: null,
  displayName: "",
  isLoading: true,
  logout: async () => {},
});

export function useTrackerAuth() {
  return useContext(TrackerAuthContext);
}

export function TrackerAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<TrackerUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const initDone = useRef(false);
  const loggingOut = useRef(false);

  const isLoginPage = pathname === "/tracker/login";
  // The provider used to be /tracker-only and would redirect to
  // /tracker/login on any missing session. The provider is now also
  // mounted inside the main forestry app's Work Tracker → Site Build tab.
  // When mounted outside /tracker we skip the redirect so we don't yank
  // admin users out of the main app on a stale session.
  const isInsideTrackerArea = pathname?.startsWith("/tracker") ?? false;

  const fetchProfile = useCallback(
    async (authUser: User): Promise<TrackerUser | null> => {
      try {
        const { data } = await supabase
          .from("tracker_users")
          .select("*")
          .eq("auth_id", authUser.id)
          .single();
        setProfile(data);
        return data;
      } catch {
        setProfile(null);
        return null;
      }
    },
    [supabase],
  );

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user);
        } else if (!isLoginPage && isInsideTrackerArea) {
          // No session and not on login page → redirect to login
          router.replace("/tracker/login");
        }
      } catch {
        if (mounted && !isLoginPage && isInsideTrackerArea) {
          router.replace("/tracker/login");
        }
      } finally {
        if (mounted) {
          initDone.current = true;
          setIsLoading(false);
        }
      }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (event === "INITIAL_SESSION") return;
        if (!initDone.current) return;
        // During logout, the hard navigation handles redirect — skip listener
        if (loggingOut.current) return;

        if (event === "SIGNED_OUT") {
          setUser(null);
          setProfile(null);
          if (isInsideTrackerArea) router.replace("/tracker/login");
        } else if (event === "SIGNED_IN" && session?.user) {
          setUser(session.user);
          await fetchProfile(session.user);
          // Only redirect to /tracker when we're already in that area.
          // Outside (e.g. embedded in the main app), the user is fine
          // where they are.
          if (isInsideTrackerArea) router.replace("/tracker");
        } else if (event === "TOKEN_REFRESHED" && session?.user) {
          setUser(session.user);
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = useCallback(async () => {
    // Prevent the onAuthStateChange listener from racing with our redirect
    loggingOut.current = true;

    // Clear local state first so UI immediately reflects logged-out
    setUser(null);
    setProfile(null);

    // Sign out from Supabase — use 'local' scope to ensure cookies are cleared
    // even if the server-side session revocation fails (e.g. network issues)
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Ignore — we're clearing the session regardless
    }

    // Hard navigation ensures a full page reset — no stale React state.
    // The loggingOut ref prevents the auth listener from also navigating.
    window.location.href = "/tracker/login";
  }, [supabase]);

  return (
    <TrackerAuthContext.Provider
      value={{
        user,
        profile,
        displayName: profile?.display_name ?? "",
        isLoading,
        logout,
      }}
    >
      {children}
    </TrackerAuthContext.Provider>
  );
}
