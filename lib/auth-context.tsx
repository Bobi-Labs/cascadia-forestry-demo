"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cacheUserProfile, getCachedUserProfile, clearCachedAuth } from "@/lib/offline/cached-auth";
import { IS_DEMO_MODE } from "@/lib/demo-mode";


/**
 * Profile from public.users — the authorization layer.
 * Supabase Auth = identity (who), public.users = authorization (what they can do).
 */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: "admin" | "office" | "foreman" | "crew";
  company_id: string | null;
  language_pref: "en" | "es";
  permissions: Record<string, unknown>;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isOfflineAuth: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  isOfflineAuth: false,
  signOut: async () => {},
});

function parseProfile(data: Record<string, unknown>): UserProfile {
  return {
    id: data.id as string,
    email: data.email as string,
    name: data.name as string,
    role: data.role as UserProfile["role"],
    company_id: data.company_id as string | null,
    language_pref: (data.language_pref as UserProfile["language_pref"]) ?? "en",
    permissions: (data.permissions as Record<string, unknown>) ?? {},
  };
}

// Synthetic admin profile used in demo mode. Drives the initial role
// (admin), company filter (all), and language (en). Visitors switch
// roles from the sidebar's "View as" selector, which calls
// AppContext.setRole directly without ever touching this profile.
const DEMO_PROFILE: UserProfile = {
  id: "demo-admin-00000000-0000-0000-0000-000000000000",
  email: "demo@cascadia.example",
  name: "Jaime Castillo",
  role: "admin",
  company_id: null,
  language_pref: "en",
  permissions: {},
};

const DEMO_USER = {
  id: DEMO_PROFILE.id,
  email: DEMO_PROFILE.email,
  user_metadata: {},
  app_metadata: {},
  aud: "authenticated",
  created_at: "2024-01-01T00:00:00Z",
} as unknown as User;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Demo mode seeds synthetic user + profile inside the first effect tick
  // (see below), not at initial state. This keeps SSR / static prerender
  // rendering the loader instead of the full dashboard tree, which avoids
  // exercising hooks that assume window/navigator/IndexedDB at build time.
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineAuth, setIsOfflineAuth] = useState(false);
  const profileCache = useRef<string | null>(null);
  const initDone = useRef(false);
  const loggingOut = useRef(false);
  const router = useRouter();

  /**
   * Fetch profile using a specific access_token passed in the Authorization header.
   * This bypasses the cookie-based auth entirely, avoiding the race condition where
   * getUser() refreshes the token but the cookie hasn't been updated yet.
   */
  async function fetchProfileWithToken(
    userId: string,
    accessToken: string,
  ): Promise<UserProfile | null> {
    if (profileCache.current === userId && profile) {
      return profile;
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    try {
      const res = await fetch(
        `${url}/rest/v1/users?id=eq.${userId}&select=id,email,name,role,company_id,language_pref,permissions`,
        {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
            "Accept-Profile": "public",
          },
        },
      );

      if (!res.ok) {
        console.error("Profile fetch HTTP error:", res.status, await res.text());
        return null;
      }

      const rows = await res.json();
      if (!rows || rows.length === 0) {
        console.error("Profile fetch returned no rows for user:", userId);
        return null;
      }

      const p = parseProfile(rows[0]);
      profileCache.current = userId;
      setProfile(p);
      // Cache to IndexedDB for offline access
      cacheUserProfile(userId, p).catch(() => {});
      return p;
    } catch (err) {
      console.error("Profile fetch network error:", err);
      return null;
    }
  }

  useEffect(() => {
    if (IS_DEMO_MODE) {
      // Hydrate the synthetic admin on the client only. SSR rendered
      // the loader; one tick after mount we flip into the dashboard.
      setUser(DEMO_USER);
      setProfile(DEMO_PROFILE);
      setIsLoading(false);
      return;
    }
    const supabase = createClient();
    let mounted = true;

    async function initializeAuth() {
      try {
        // If offline, skip network auth entirely — use cached profile from IndexedDB.
        // This avoids Supabase's refresh retry loop + lock timeout (8s+ delay).
        if (!navigator.onLine) {
          console.log("[auth] Offline detected — skipping network auth");
          try {
            const cached = await getCachedUserProfile();
            if (cached) {
              console.log("[auth] Using cached offline profile for:", cached.profile.name);
              setProfile(cached.profile);
              setIsOfflineAuth(true);
              return;
            }
          } catch {
            // IndexedDB not available
          }
          // No cached auth and offline — nothing we can do
          setUser(null);
          setProfile(null);
          return;
        }

        // refreshSession() is the most reliable way to get a valid session on reload.
        // Unlike getUser() (which refreshes internally but may not update cookies in time)
        // or getSession() (which reads from storage without validating), refreshSession()
        // explicitly contacts the auth server AND returns the fresh tokens directly.
        const { data: refreshData, error: refreshError } =
          await supabase.auth.refreshSession();

        if (!mounted) return;

        if (refreshError || !refreshData.session) {
          // No valid session — user needs to log in.
          // Try getSession() as fallback in case refreshSession fails on fresh login
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session?.user) {
            const session = sessionData.session;
            setUser(session.user);
            await fetchProfileWithToken(session.user.id, session.access_token);
          } else {
            // No session at all — try offline fallback
            try {
              const cached = await getCachedUserProfile();
              if (cached) {
                console.log("[auth] Using cached offline profile for:", cached.profile.name);
                setProfile(cached.profile);
                setIsOfflineAuth(true);
                return;
              }
            } catch {
              // IndexedDB not available
            }
            setUser(null);
            setProfile(null);
          }
          return;
        }

        const session = refreshData.session;
        setUser(session.user);

        // Use the access_token directly from the refreshed session — guaranteed fresh.
        await fetchProfileWithToken(session.user.id, session.access_token);
      } catch (err) {
        console.error("Auth initialization error:", err);
        if (mounted) {
          // Try offline fallback — use cached profile from IndexedDB
          try {
            const cached = await getCachedUserProfile();
            if (cached) {
              console.log("[auth] Using cached offline profile for:", cached.profile.name);
              setProfile(cached.profile);
              setIsOfflineAuth(true);
              return;
            }
          } catch {
            // IndexedDB not available
          }
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) {
          initDone.current = true;
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    // Handle subsequent auth events (sign in, sign out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // Skip INITIAL_SESSION — handled by initializeAuth
      if (event === "INITIAL_SESSION") return;

      // Skip if init hasn't finished yet (avoid race condition)
      if (!initDone.current) return;

      // If we're in the process of logging out, don't process any more events
      // (prevents race between signOut navigation and auth listener)
      if (loggingOut.current) return;

      if (event === "TOKEN_REFRESHED" && session?.user && profileCache.current === session.user.id) {
        setUser(session.user);
        return;
      }

      if (event === "SIGNED_OUT") {
        profileCache.current = null;
        setUser(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      const newUser = session?.user ?? null;
      setUser(newUser);

      if (newUser && session) {
        await fetchProfileWithToken(newUser.id, session.access_token);
      } else {
        profileCache.current = null;
        setProfile(null);
      }

      setIsLoading(false);
    });

    // Safety timeout — reduced from 8s to 3s since offline fast-path
    // handles the common case; this catches edge cases where navigator.onLine
    // is wrong or the network is extremely slow.
    const timeout = setTimeout(() => {
      if (mounted && isLoading) {
        console.warn("Auth timeout: forcing isLoading=false after 3s");
        setIsLoading(false);
      }
    }, 3000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = useCallback(async () => {
    if (IS_DEMO_MODE) {
      // No real session to end. Keep the synthetic admin so the chrome
      // stays usable. The DEMO MODE banner is the canonical "you're in
      // a demo" surface, so sign-out doesn't need to do anything here.
      return;
    }
    // Set flag FIRST. Prevents auth listener from racing with navigation
    loggingOut.current = true;
    const supabase = createClient();
    profileCache.current = null;
    setUser(null);
    setProfile(null);
    setIsOfflineAuth(false);
    // Clear cached offline auth
    clearCachedAuth().catch(() => {});
    // scope: "local" ensures cookies clear immediately in this browser tab
    await supabase.auth.signOut({ scope: "local" });
    // Hard navigation. Avoids client-side routing conflicts with middleware redirect
    window.location.href = "/auth/login";
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, isOfflineAuth, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
