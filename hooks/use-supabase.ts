'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { paginatedSelect } from '@/lib/supabase/paginate'
import { getCachedRefData } from '@/lib/offline/ref-data-sync'
import type { RefTableName } from '@/lib/offline/constants'
import type {
  WorkType,
  Company,
  Contract,
  Employee,
  Unit,
  UnitDraw,
  Vehicle,
  ComplianceItem,
  CrewSet,
  CrewSetMember,
  Timesheet,
  TimesheetEntry,
  ProductionLog,
} from '@/lib/database.types'

// Map Supabase table names to IndexedDB cache keys
const TABLE_TO_CACHE_KEY: Record<string, RefTableName> = {
  contracts: 'contracts',
  units: 'units',
  employees: 'employees',
  crew_sets: 'crewSets',
  crew_set_members: 'crewSetMembers',
  work_types: 'workTypes',
}

// In-memory cache to prevent redundant fetches across component remounts
const queryCache = new Map<string, { data: any[]; timestamp: number }>()
const CACHE_STALE_MS = 2 * 60 * 1000 // 2 minutes

function getCacheKey(table: string, filterCol?: string, filterVal?: any): string {
  return `${table}:${filterCol || ''}:${filterVal ?? ''}`
}

// Global refresh counter — custom hooks (useTimesheetsWithDetails, useWeeklyOTData, etc.)
// subscribe to this to know when to refetch
let globalRefreshCounter = 0
const refreshListeners = new Set<() => void>()

// Clear all cached data (called by global refresh)
export function invalidateSupabaseCache() {
  queryCache.clear()
  globalRefreshCounter++
  refreshListeners.forEach(fn => fn())
}

// Hook: returns a counter that increments on every global refresh
function useGlobalRefresh() {
  const [counter, setCounter] = useState(globalRefreshCounter)
  useEffect(() => {
    const listener = () => setCounter(c => c + 1)
    refreshListeners.add(listener)
    return () => { refreshListeners.delete(listener) }
  }, [])
  return counter
}

// Generic fetch hook — exported for ad-hoc queries
// Re-fetches when tableName or filter value changes
// Falls back to IndexedDB cache when offline
// Uses in-memory cache to prevent redundant fetches within 2 minutes
export function useSupabaseQuery<T>(
  tableName: string,
  options?: {
    select?: string
    orderBy?: string
    ascending?: boolean
    filter?: { column: string; value: any }
    enabled?: boolean
  }
) {
  const filterValue = options?.filter?.value
  const filterColumn = options?.filter?.column
  const enabled = options?.enabled !== false
  const cacheKey = getCacheKey(tableName, filterColumn, filterValue)

  // Initialize from cache if available and fresh
  const cached = queryCache.get(cacheKey)
  const hasFreshCache = cached && (Date.now() - cached.timestamp) < CACHE_STALE_MS

  const globalRefresh = useGlobalRefresh()
  const [data, setData] = useState<T[]>(hasFreshCache ? cached.data : [])
  const [loading, setLoading] = useState(!hasFreshCache)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const refetch = useCallback(() => {
    queryCache.delete(cacheKey)
    setRefreshKey(k => k + 1)
  }, [cacheKey])

  useEffect(() => {
    if (!enabled) {
      setData([])
      setLoading(false)
      return
    }

    // Skip fetch if cache is still fresh (unless manually refreshed or global refresh)
    const existing = queryCache.get(cacheKey)
    if (existing && (Date.now() - existing.timestamp) < CACHE_STALE_MS && refreshKey === 0 && globalRefresh === 0) {
      setData(existing.data)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    async function fetchData() {
      try {
        let query = supabase
          .from(tableName)
          .select(options?.select || '*')

        if (options?.orderBy) {
          query = query.order(options.orderBy, {
            ascending: options.ascending ?? true,
          })
        }

        if (filterColumn && filterValue !== undefined && filterValue !== null) {
          query = query.eq(filterColumn, filterValue)
        }

        const { data: result, error: err } = await query

        if (cancelled) return
        if (err) throw err
        setData(result as T[])
        // Store in cache
        queryCache.set(cacheKey, { data: result as any[], timestamp: Date.now() })
      } catch (err: any) {
        if (cancelled) return

        // Try IndexedDB fallback for offline
        const offlineCacheKey = TABLE_TO_CACHE_KEY[tableName]
        if (offlineCacheKey) {
          try {
            const cached = await getCachedRefData<T>(offlineCacheKey)
            if (cached) {
              console.log(`[offline] Using cached ${tableName} (${cached.data.length} rows, age: ${Math.round((Date.now() - cached.syncedAt) / 60000)}min)`)
              let result = cached.data

              // Apply client-side filter if needed
              if (filterColumn && filterValue !== undefined && filterValue !== null) {
                result = result.filter((row: any) => row[filterColumn] === filterValue)
              }

              setData(result)
              setLoading(false)
              return
            }
          } catch {
            // IndexedDB not available
          }
        }

        console.error(`Error fetching ${tableName}:`, err)
        setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [tableName, filterColumn, filterValue, enabled, refreshKey, cacheKey, globalRefresh])

  return { data, loading, error, refetch }
}

// -- Specific hooks --

export function useWorkTypes() {
  return useSupabaseQuery<WorkType>('work_types', {
    orderBy: 'display_order',
    ascending: true,
    filter: { column: 'is_active', value: true },
  })
}

export function useCompanies() {
  return useSupabaseQuery<Company>('companies')
}

export function useContracts() {
  return useSupabaseQuery<Contract>('contracts', {
    orderBy: 'name',
    ascending: true,
  })
}

export function useActiveContracts() {
  return useSupabaseQuery<Contract>('contracts', {
    orderBy: 'name',
    ascending: true,
    filter: { column: 'status', value: 'active' },
  })
}

export function useEmployees() {
  return useSupabaseQuery<Employee>('employees', {
    orderBy: 'last_name',
    ascending: true,
  })
}

export function useUnits() {
  return useSupabaseQuery<Unit>('units', {
    orderBy: 'name',
    ascending: true,
  })
}

export function useUnitDraws(unitId: string | null) {
  return useSupabaseQuery<UnitDraw>('unit_draws', {
    orderBy: 'draw_number',
    ascending: true,
    filter: unitId ? { column: 'unit_id', value: unitId } : undefined,
    enabled: !!unitId,
  })
}

export function useContractUnits(contractId: string | null) {
  return useSupabaseQuery<Unit>('units', {
    orderBy: 'name',
    ascending: true,
    filter: contractId ? { column: 'contract_id', value: contractId } : undefined,
    enabled: !!contractId,
  })
}

export function useVehicles() {
  return useSupabaseQuery<Vehicle>('vehicles', {
    orderBy: 'type',
    ascending: true,
  })
}

export function useComplianceItems() {
  return useSupabaseQuery<ComplianceItem>('compliance_items', {
    orderBy: 'due_date',
    ascending: true,
  })
}

export function useCrewSets() {
  return useSupabaseQuery<CrewSet>('crew_sets', {
    orderBy: 'name',
    ascending: true,
  })
}

export function useCrewSetMembers(crewSetId: string | null) {
  return useSupabaseQuery<CrewSetMember>('crew_set_members', {
    filter: crewSetId ? { column: 'crew_set_id', value: crewSetId } : undefined,
    enabled: !!crewSetId,
  })
}

export function useAllCrewSetMembers() {
  return useSupabaseQuery<CrewSetMember>('crew_set_members')
}

// -- Timesheet hooks --

export type TimesheetWithDetails = Timesheet & {
  foreman: { first_name: string; last_name: string; is_driver: boolean; is_foreman: boolean } | null
  contract: { name: string; company_id: string } | null
}

export function useTimesheetsWithDetails() {
  const [data, setData] = useState<TimesheetWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const globalRefresh = useGlobalRefresh()

  const refetch = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function fetch() {
      try {
        // Paginated to bypass the PostgREST 1000-row default cap. Timesheets
        // grow continuously (one row per foreman per day per contract) — by
        // mid-2026 we'll be well past the cap. Without this, older entries
        // silently disappear from the admin Timesheets view.
        const result = await paginatedSelect<TimesheetWithDetails>((from, to) =>
          supabase
            .from('timesheets')
            .select(`
              *,
              foreman:employees!foreman_id(first_name, last_name, is_driver, is_foreman),
              contract:contracts!contract_id(name, company_id)
            `)
            .order('date', { ascending: false })
            .range(from, to),
        )

        if (cancelled) return
        setData(result)
      } catch (err: any) {
        if (cancelled) return
        console.error('Error fetching timesheets:', err)
        setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch()
    return () => { cancelled = true }
  }, [refreshKey, globalRefresh])

  return { data, loading, error, refetch }
}

export function useTimesheetEntries(timesheetId: string | null) {
  return useSupabaseQuery<TimesheetEntry>('timesheet_entries', {
    filter: timesheetId ? { column: 'timesheet_id', value: timesheetId } : undefined,
    enabled: !!timesheetId,
  })
}

export function useProductionLogs() {
  return useSupabaseQuery<ProductionLog>('production_logs', {
    orderBy: 'created_at',
    ascending: false,
  })
}

// Weekly hours aggregation for OT monitor
// Returns hours grouped by employee for timesheets in a given week
export type WeeklyEmployeeHours = {
  employee_id: string
  first_name: string
  last_name: string
  is_driver: boolean
  is_foreman: boolean
  total_hours: number
  total_drive_hours: number
  total_ot: number
}

export function useWeeklyOTData(weekStart: string, weekEnd: string) {
  const [data, setData] = useState<WeeklyEmployeeHours[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const globalRefresh = useGlobalRefresh()

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function fetch() {
      try {
        // Get timesheets for the week
        const { data: timesheets, error: tsErr } = await supabase
          .from('timesheets')
          .select('id')
          .gte('date', weekStart)
          .lte('date', weekEnd)

        if (cancelled) return
        if (tsErr) throw tsErr
        if (!timesheets || timesheets.length === 0) {
          setData([])
          setLoading(false)
          return
        }

        const tsIds = timesheets.map(t => t.id)

        // Get all entries for those timesheets
        const { data: entries, error: entErr } = await supabase
          .from('timesheet_entries')
          .select('employee_id, hours_worked, drive_hours, ot_hours, is_present')
          .in('timesheet_id', tsIds)

        if (cancelled) return
        if (entErr) throw entErr

        // Get employees for names + roles
        const { data: employees, error: empErr } = await supabase
          .from('employees')
          .select('id, first_name, last_name, is_driver, is_foreman')

        if (cancelled) return
        if (empErr) throw empErr

        const empMap = new Map(employees?.map(e => [e.id, e]) || [])

        // Aggregate by employee
        const agg = new Map<string, { hours: number; drive: number; ot: number }>()
        for (const entry of (entries || [])) {
          if (!entry.is_present) continue
          const cur = agg.get(entry.employee_id) || { hours: 0, drive: 0, ot: 0 }
          cur.hours += entry.hours_worked || 0
          cur.drive += entry.drive_hours || 0
          cur.ot += entry.ot_hours || 0
          agg.set(entry.employee_id, cur)
        }

        const result: WeeklyEmployeeHours[] = []
        for (const [empId, totals] of agg) {
          const emp = empMap.get(empId)
          if (!emp) continue
          result.push({
            employee_id: empId,
            first_name: emp.first_name,
            last_name: emp.last_name,
            is_driver: emp.is_driver,
            is_foreman: emp.is_foreman,
            total_hours: totals.hours,
            total_drive_hours: totals.drive,
            total_ot: totals.ot,
          })
        }

        // Sort by hours descending
        result.sort((a, b) => b.total_hours - a.total_hours)
        setData(result)
      } catch (err: any) {
        if (cancelled) return
        console.error('Error fetching weekly OT data:', err)
        setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch()
    return () => { cancelled = true }
  }, [weekStart, weekEnd, globalRefresh])

  return { data, loading, error }
}

// Contract hours aggregation from approved timesheets
export type ContractHoursData = {
  totalCrewHours: number
  totalDriveHours: number
  approvedTimesheetCount: number
  unitHoursMap: Map<string, number> // unit_id → aggregated hours from timesheet_unit_hours
}

export function useContractHours(contractId: string | null) {
  const [data, setData] = useState<ContractHoursData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const globalRefresh = useGlobalRefresh()

  const refetch = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    if (!contractId) {
      setData(null)
      return
    }

    let cancelled = false
    setLoading(true)

    async function fetchHours() {
      try {
        // Get approved timesheets for this contract
        const { data: timesheets, error: tsErr } = await supabase
          .from('timesheets')
          .select('id')
          .eq('contract_id', contractId!)
          .eq('status', 'approved')

        if (cancelled) return
        if (tsErr) throw tsErr
        if (!timesheets || timesheets.length === 0) {
          setData({ totalCrewHours: 0, totalDriveHours: 0, approvedTimesheetCount: 0, unitHoursMap: new Map() })
          setLoading(false)
          return
        }

        const tsIds = timesheets.map(t => t.id)

        // Fetch timesheet entries for crew hours
        const { data: entries, error: entErr } = await supabase
          .from('timesheet_entries')
          .select('hours_worked, drive_hours, is_present')
          .in('timesheet_id', tsIds)

        if (cancelled) return
        if (entErr) throw entErr

        let totalCrewHours = 0
        let totalDriveHours = 0
        for (const entry of (entries || [])) {
          if (!entry.is_present) continue
          totalCrewHours += entry.hours_worked || 0
          totalDriveHours += entry.drive_hours || 0
        }

        // Fetch unit hours for per-unit breakdown
        const { data: unitHours, error: uhErr } = await supabase
          .from('timesheet_unit_hours')
          .select('unit_id, hours_on_unit')
          .in('timesheet_id', tsIds)

        if (cancelled) return
        if (uhErr) throw uhErr

        const unitHoursMap = new Map<string, number>()
        for (const uh of (unitHours || [])) {
          const current = unitHoursMap.get(uh.unit_id) || 0
          unitHoursMap.set(uh.unit_id, current + (uh.hours_on_unit || 0))
        }

        setData({
          totalCrewHours,
          totalDriveHours,
          approvedTimesheetCount: timesheets.length,
          unitHoursMap,
        })
      } catch (err: any) {
        if (cancelled) return
        console.error('Error fetching contract hours:', err)
        setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchHours()
    return () => { cancelled = true }
  }, [contractId, refreshKey, globalRefresh])

  return { data, loading, error, refetch }
}
