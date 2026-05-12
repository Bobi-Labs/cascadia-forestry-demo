"use client";

/**
 * Discovery + Plan tab for the "Platform Security, Staging & Continuity"
 * deliverable. Same visual treatment as Item7DiscoveryPlan and
 * Item8DiscoveryPlan — stats, sections, color-coded benefit cards.
 *
 * This is a SCOPING document for Jaime. Language is intentionally
 * plain-English; no dev jargon ('RLS', 'PostgREST', 'JWT', etc.).
 * Pull from this when generating the bid + invoice.
 */

import {
  ShieldCheck,
  Database,
  GitBranch,
  Archive,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Lock,
  Sparkles,
  Clock,
  Layers,
  HelpCircle,
} from "lucide-react";

const stats = [
  { label: "Tables in your database", value: "54", sub: "everything from contracts to timesheets to expenses" },
  { label: "Storage buckets", value: "10", sub: "file containers — contract docs, photos, etc." },
  { label: "Confirmed users", value: "9", sub: "everyone who can sign in today" },
  { label: "Live + dev separation", value: "None", sub: "test work shares the same database as your live app" },
];

const currentState = [
  {
    icon: <AlertTriangle className="h-4 w-4 text-amber-400" />,
    title: "Some tables are reachable without signing in",
    body:
      "While the app was being built, several tables were left readable by anyone who has our app's public key (which lives inside the app itself, so anyone with the address can find it). The app uses sign-in everywhere now, but the back-door access is still there — it should be closed.",
  },
  {
    icon: <AlertTriangle className="h-4 w-4 text-amber-400" />,
    title: "A few file containers are world-readable",
    body:
      "Two of the buckets we store files in (unit documents and tracker files) are flagged 'public' — meaning anyone with the file's URL can see it without logging in. Profile photos and tracker banners are intentionally public; the other two should be locked down.",
  },
  {
    icon: <AlertTriangle className="h-4 w-4 text-amber-400" />,
    title: "Test work shows up in the live view",
    body:
      "When we test new features or upload sample files, those rows land in the same database the office is using. You've already seen this — the __TEST contracts that appeared in your project list during the unit-ingest demo. Office shouldn't ever see test data in their live view.",
  },
  {
    icon: <AlertTriangle className="h-4 w-4 text-amber-400" />,
    title: "Backup recovery isn't documented",
    body:
      "Supabase keeps automatic daily backups, but if something went badly wrong (data corruption, accidental deletion, full provider outage), nobody on your team knows how to actually restore. A written 'if X happens, do Y' runbook is the difference between a 30-minute recovery and a 30-hour scramble.",
  },
];

const scopeBlocks = [
  {
    icon: <Lock className="h-4 w-4 text-primary" />,
    title: "Lock down database access",
    accent: "border-primary/40 bg-primary/5",
    bullets: [
      "Audit every table and confirm only signed-in app users can reach it.",
      "Close the back-door access on the 22 tables that still allow unsigned-in reads/writes.",
      "Hide internal-only tables (ingest plumbing, bot configuration) from the client-side API surface entirely.",
      "Verify the most-sensitive table — the one that holds Telegram bot tokens — is no longer readable without admin auth.",
    ],
  },
  {
    icon: <Archive className="h-4 w-4 text-blue-400" />,
    title: "Lock down file storage",
    accent: "border-blue-500/40 bg-blue-500/5",
    bullets: [
      "Flip unit documents + tracker files to private. Direct URLs no longer work; downloads use short-lived signed links instead.",
      "Update the app so document downloads still work for logged-in users (one-time code change, transparent to the office).",
      "Keep profile photos + tracker banners public — those are visible-by-design.",
    ],
  },
  {
    icon: <GitBranch className="h-4 w-4 text-green-400" />,
    title: "Build a real staging environment",
    accent: "border-green-500/40 bg-green-500/5",
    bullets: [
      "Spin up an identical copy of the database, isolated from live data.",
      "Point staging.ramosreforestation.com at this copy. Office and clients never see staging.",
      "All test work — new features, ingest tests, demos — happens on staging first. Live database stays untouched.",
      "When something is ready to ship, the change moves from staging to live in one controlled step.",
    ],
  },
  {
    icon: <Database className="h-4 w-4 text-purple-400" />,
    title: "Backups + disaster recovery",
    accent: "border-purple-500/40 bg-purple-500/5",
    bullets: [
      "Confirm Supabase's daily backup retention and what tier we need for longer windows.",
      "Add a second, independent backup: nightly export of the entire database to Google Drive (where contract docs already live).",
      "Document the recovery runbook — exactly what steps to take if data is lost or corrupted, who can execute them, how long it takes.",
      "Test the recovery path once so we know it actually works. Untested backups are theoretical backups.",
    ],
  },
  {
    icon: <ShieldCheck className="h-4 w-4 text-orange-400" />,
    title: "Credential rotation + monitoring",
    accent: "border-orange-500/40 bg-orange-500/5",
    bullets: [
      "Rotate the database admin key (the credential that, if leaked, would give an attacker full access).",
      "Set up the automated test suite to catch security regressions: if anyone accidentally re-opens a back door in the future, the daily test run flags it the next morning.",
      "Add monitoring so we know if a backup ever fails to run — silent failure is the worst kind.",
    ],
  },
];

const shortTermBenefits = [
  "No more test data showing up in your live view — staging absorbs all of it.",
  "Office can keep working uninterrupted while we do this. They never see a maintenance window.",
  "Sensitive contract documents stop being world-accessible.",
  "Internal tables and bot tokens are no longer visible to anyone with the app's public key.",
];

const longTermBenefits = [
  "Foundation that scales as you bring on more clients without re-doing the security audit.",
  "If a disaster ever happens — corruption, accidental deletion, provider outage — there's a documented plan and verified backups.",
  "New features ship faster and safer because they get tested in staging without risk to live data.",
  "Auditable security posture — if a partner or insurer ever asks 'how do you protect client data,' there's a real answer.",
];

const safetyMeasures = [
  {
    title: "All work happens on the staging copy first",
    body: "Every change gets applied to the staging database, the app gets pointed at it, and we verify everything still works. Only then does the change touch the live system.",
  },
  {
    title: "A backup is taken before anything is changed",
    body: "Day-of-work, before the first migration runs, we snapshot the live database. If anything looks off after the change, restoring is one click.",
  },
  {
    title: "Each change is reversible",
    body: "Every database update has a written undo. If we ship something that turns out wrong, we roll it back without data loss.",
  },
  {
    title: "Live system flips happen off-hours",
    body: "The brief window where staging changes apply to live is scheduled for after business hours so the office never hits an inconsistent state.",
  },
];

const whatDoneLooksLike = [
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Every database table verified — only signed-in users can reach client data." },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "All four sensitive file containers locked down. Only profile photos + banners stay public." },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Staging environment live at staging.ramosreforestation.com — fully isolated from live data." },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Daily backup verification running automatically + nightly export to Google Drive." },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Disaster recovery runbook delivered as a printable doc + walked through together." },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Daily test suite catches any future regression — if someone re-opens a back door, it flags the next morning." },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Database admin credentials rotated. Old ones invalidated." },
];

export function Item16SecurityDiscoveryPlan() {
  return (
    <div className="px-4 py-4 space-y-6">
      {/* Intro */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">Discovery + Plan</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Where the platform stands today on security, separation, and disaster recovery — plus what it'd take to bring it up to a posture that matches a real production system serving an active client.
        </p>
        <p className="text-[10px] text-muted-foreground mt-1 italic">Updated 2026-05-13 · scope locked, awaiting approval</p>
      </div>

      {/* Section 1 — Stats */}
      <Section title="1. The lay of the land" icon={<Database className="h-4 w-4" />}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card/40 px-3 py-2">
              <div className="text-lg font-bold font-mono text-primary">{s.value}</div>
              <div className="text-[11px] font-medium text-foreground">{s.label}</div>
              <div className="text-[10px] text-muted-foreground leading-tight">{s.sub}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Section 2 — Where we are today */}
      <Section title="2. Where we are today" icon={<AlertTriangle className="h-4 w-4" />} subtitle="four things worth fixing">
        <div className="space-y-2">
          {currentState.map((item) => (
            <div key={item.title} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
              <span className="mt-0.5 shrink-0">{item.icon}</span>
              <div>
                <div className="text-[11px] font-semibold text-foreground">{item.title}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{item.body}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Section 3 — The work */}
      <Section title="3. The work" icon={<Layers className="h-4 w-4" />} subtitle="five chunks, sequenced safely">
        <div className="space-y-3">
          {scopeBlocks.map((block, i) => (
            <div key={block.title} className={`rounded-lg border ${block.accent} p-3`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold font-mono text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                {block.icon}
                <h4 className="text-xs font-semibold text-foreground">{block.title}</h4>
              </div>
              <ul className="space-y-1 ml-1">
                {block.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-[11px] text-foreground/90 leading-relaxed">
                    <span className="text-muted-foreground mt-1 shrink-0">•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* Section 4 + 5 — Benefits */}
      <Section title="4. Benefits" icon={<Sparkles className="h-4 w-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="h-3.5 w-3.5 text-green-400" />
              <h4 className="text-[11px] font-semibold text-green-300 uppercase tracking-wide">Short-term</h4>
            </div>
            <ul className="space-y-1.5">
              {shortTermBenefits.map((b) => (
                <li key={b} className="flex items-start gap-2 text-[11px] text-foreground/90 leading-relaxed">
                  <CheckCircle2 className="h-3 w-3 text-green-400 mt-0.5 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              <h4 className="text-[11px] font-semibold text-blue-300 uppercase tracking-wide">Long-term</h4>
            </div>
            <ul className="space-y-1.5">
              {longTermBenefits.map((b) => (
                <li key={b} className="flex items-start gap-2 text-[11px] text-foreground/90 leading-relaxed">
                  <CheckCircle2 className="h-3 w-3 text-blue-400 mt-0.5 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Section 6 — How we do this without disruption */}
      <Section title="5. How we do this without disrupting the team" icon={<ShieldCheck className="h-4 w-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {safetyMeasures.map((m) => (
            <div key={m.title} className="rounded-lg border border-border bg-card/30 p-3">
              <h4 className="text-[11px] font-semibold text-foreground mb-1">{m.title}</h4>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{m.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Section 7 — What done looks like */}
      <Section title="6. What 'done' looks like" icon={<CheckCircle2 className="h-4 w-4" />}>
        <ul className="space-y-2">
          {whatDoneLooksLike.map((d, i) => (
            <li key={i} className="flex items-start gap-2 text-[11px]">
              <span className="mt-0.5 shrink-0">{d.icon}</span>
              <span className="text-foreground">{d.text}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Section 8 — One-line summary */}
      <Section title="7. The pitch in one sentence">
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
          <p className="text-[12px] text-foreground leading-relaxed">
            <span className="font-semibold">Bring the platform up to a real production-grade posture</span> — closed back doors, separated dev from live, documented disaster recovery, automated guardrails — without the office team noticing any disruption while we do it.
          </p>
        </div>
      </Section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Helpers                                                         */
/* ─────────────────────────────────────────────────────────────── */

function Section({
  title,
  icon,
  subtitle,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <h4 className="text-xs font-semibold text-foreground">{title}</h4>
        {subtitle && <span className="text-[10px] text-muted-foreground italic">{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}
