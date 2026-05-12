"use client";

/**
 * Admin Units Dashboard — cross-contract units browser.
 *
 * The dashboard surface for the ingest pipeline output. Office sees
 * Pending Units (the triage queue); admin sees ALL units across ALL
 * contracts, filterable by landowner, contract, status, acres range,
 * work type, with a search box for unit name.
 *
 * Click a row → opens the contract detail page with that unit
 * scrolled into view (existing per-contract Units tab handles
 * detailed editing). This page is for find-and-context, not editing.
 */

import { useMemo, useState } from "react";
import { Loader2, Search, ExternalLink, MapPin, Layers } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/lib/app-context";
import { createClient } from "@/lib/supabase/client";

interface UnitRow {
  id: string;
  name: string;
  contract_id: string;
  amount: number | null;
  amount_type: string | null;
  county: string | null;
  state: string | null;
  status: string | null;
  work_type: string | null;
  target_spacing: string | null;
  stand_key: string | null;
  notes: string | null;
  contracts?: {
    id: string;
    name: string;
    company_id: string | null;
    landowner: string | null;
  } | null;
}

const CASCADIA_ID = "00000000-0000-0000-0000-000000000001";
const RAMOS_ID = "00000000-0000-0000-0000-000000000002";

export function AdminUnitsPage() {
  const supabase = createClient();
  const { t, setActivePage, company, setSelectedContractId, role } = useApp();

  const [search, setSearch] = useState("");
  const [filterLandowner, setFilterLandowner] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterWorkType, setFilterWorkType] = useState<string | null>(null);

  const { data: units, isLoading } = useQuery({
    queryKey: ["adminUnitsAll"],
    queryFn: async (): Promise<UnitRow[]> => {
      const { data, error } = await supabase
        .from("units")
        .select(`
          id, name, contract_id, amount, amount_type, county, state, status,
          work_type, target_spacing, stand_key, notes,
          contracts:contracts!contract_id (
            id, name, company_id, landowner
          )
        `)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as UnitRow[];
    },
    staleTime: 60_000,
  });

  // Apply company toggle (from app-context) — restrict to the active
  // company's units. "all" passes through.
  const companyFiltered = useMemo(() => {
    if (!units) return [];
    if (company === "cascadia") {
      return units.filter((u) => u.contracts?.company_id === CASCADIA_ID || !u.contracts?.company_id);
    }
    if (company === "ramos") {
      return units.filter((u) => u.contracts?.company_id === RAMOS_ID || !u.contracts?.company_id);
    }
    return units;
  }, [units, company]);

  // Build filter option lists from data
  const landowners = useMemo(() => {
    const set = new Set<string>();
    for (const u of companyFiltered) if (u.contracts?.landowner) set.add(u.contracts.landowner);
    return Array.from(set).sort();
  }, [companyFiltered]);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    for (const u of companyFiltered) if (u.status) set.add(u.status);
    return Array.from(set).sort();
  }, [companyFiltered]);

  const workTypes = useMemo(() => {
    const set = new Set<string>();
    for (const u of companyFiltered) if (u.work_type) set.add(u.work_type);
    return Array.from(set).sort();
  }, [companyFiltered]);

  const filtered = useMemo(() => {
    return companyFiltered.filter((u) => {
      if (filterLandowner && u.contracts?.landowner !== filterLandowner) return false;
      if (filterStatus && u.status !== filterStatus) return false;
      if (filterWorkType && u.work_type !== filterWorkType) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = [u.name, u.county, u.state, u.contracts?.name, u.notes, u.stand_key]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [companyFiltered, filterLandowner, filterStatus, filterWorkType, search]);

  const totalAcres = useMemo(() => {
    return filtered.reduce((s, u) => s + (Number(u.amount) || 0), 0);
  }, [filtered]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Layers className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">{t('au_heading')}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {filtered.length}{filtered.length !== companyFiltered.length ? ` of ${companyFiltered.length}` : ""} units
        </span>
        <span className="text-[11px] text-muted-foreground">
          · {totalAcres.toLocaleString("en-US", { maximumFractionDigits: 1 })} acres
        </span>
      </div>

      {/* Search + filter pills */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("au_searchPlaceholder")}
            className="h-8 w-full rounded-md border border-border bg-elevated pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <FilterRow
          label="Landowner"
          options={landowners}
          value={filterLandowner}
          onChange={setFilterLandowner}
        />
        <FilterRow
          label="Status"
          options={statuses}
          value={filterStatus}
          onChange={setFilterStatus}
        />
        <FilterRow
          label="Work type"
          options={workTypes}
          value={filterWorkType}
          onChange={setFilterWorkType}
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-elevated/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">{t('au_colUnit')}</th>
                <th className="px-3 py-2 text-left font-medium">{t('au_colContract')}</th>
                <th className="px-3 py-2 text-left font-medium">{t('au_colLandowner')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('au_colAcres')}</th>
                <th className="px-3 py-2 text-left font-medium">{t('au_colLocation')}</th>
                <th className="px-3 py-2 text-left font-medium">{t('au_colWork')}</th>
                <th className="px-3 py-2 text-left font-medium">{t('au_colStatus')}</th>
                <th className="px-3 py-2 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-sm text-muted-foreground">
                    No units match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => {
                      // Navigate to contract detail via app-context — the
                      // contracts page reads selectedContractId on mount and
                      // pre-selects the matching contract row. Foremen land
                      // on ForemanMyContracts (no financials), everyone else
                      // on the full ContractsPage.
                      if (u.contract_id) {
                        setSelectedContractId(u.contract_id);
                        setActivePage(role === "foreman" ? "myContracts" : "contracts");
                      }
                    }}
                    className="border-b border-border last:border-b-0 cursor-pointer transition-colors hover:bg-elevated/50"
                  >
                    <td className="px-3 py-2 text-foreground font-medium">{u.name}</td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px]">
                      {u.contracts?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{u.contracts?.landowner ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-foreground">
                      {u.amount !== null ? Number(u.amount).toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {u.county || u.state ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {[u.county, u.state].filter(Boolean).join(", ")}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{u.work_type ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusToneFor(u.status)}`}>
                        {u.status ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <ExternalLink className="inline h-3.5 w-3.5 text-muted-foreground" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground w-20">{label}</span>
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
          !value ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-elevated"
        }`}
      >
        All
      </button>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(value === o ? null : o)}
          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
            value === o ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-elevated"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function statusToneFor(status: string | null): string {
  switch (status) {
    case "completed":   return "bg-primary/15 text-primary";
    case "in_progress": return "bg-info/15 text-info";
    case "blocked":     return "bg-destructive/15 text-destructive";
    case "not_started": return "bg-muted text-muted-foreground";
    default:            return "bg-muted/60 text-muted-foreground";
  }
}
