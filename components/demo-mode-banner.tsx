"use client";

import { IS_DEMO_MODE } from "@/lib/demo-mode";

/**
 * Renders a slim banner at the top of every page when IS_DEMO_MODE is on.
 * Tells visitors they're in a synthetic-data demo and links back to the
 * studio site. Renders nothing in production (non-demo) builds.
 */
export function DemoModeBanner() {
  if (!IS_DEMO_MODE) return null;

  return (
    <div className="sticky top-0 z-40 w-full border-b border-amber-500/40 bg-amber-500/10 backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-4 py-2 text-xs sm:text-sm">
        <div className="flex items-center gap-2 text-amber-200">
          <span className="rounded bg-amber-500/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-100">
            Demo
          </span>
          <span className="hidden sm:inline text-amber-100/90">
            All names, dollars, and dates are synthetic. Click anything. Switch roles in the sidebar.
          </span>
          <span className="sm:hidden text-amber-100/90">
            Synthetic data. Click anything.
          </span>
        </div>
        <a
          href="https://bobilabs.dev/work/cascadia-forestry"
          className="shrink-0 rounded-md border border-amber-400/50 bg-amber-500/20 px-2.5 py-1 text-amber-50 hover:bg-amber-500/30 transition-colors"
        >
          Read the case study →
        </a>
      </div>
    </div>
  );
}
