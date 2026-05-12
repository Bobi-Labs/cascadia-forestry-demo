"use client";

import { useState, useRef, useEffect } from "react";
import { LogOut, User } from "lucide-react";
import { useTrackerAuth } from "./tracker-auth-provider";

export function TrackerUserMenu() {
  const { profile, displayName, logout } = useTrackerAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!profile) return null;

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-elevated transition-colors"
      >
        <div
          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ backgroundColor: profile.avatar_color ?? "#22c55e" }}
        >
          {initials}
        </div>
        <span className="hidden sm:inline">{displayName}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-border bg-card shadow-lg">
          <div className="border-b border-border px-3 py-2">
            <div className="text-sm font-medium text-foreground">{displayName}</div>
            <div className="text-xs text-muted-foreground">{profile.email}</div>
          </div>
          <button
            type="button"
            onClick={async () => {
              setOpen(false);
              await logout();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
