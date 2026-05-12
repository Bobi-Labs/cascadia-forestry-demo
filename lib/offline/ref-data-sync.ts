import { getOfflineDB, type RefDataRecord } from './db'
import { STORES, type RefTableName } from './constants'
import { supabase } from '@/lib/supabase'

// In-flight sync coalescing — if a sync is already running (e.g. mount
// effect fired and the user mashed the topbar refresh button before it
// finished), return the same promise instead of starting a second
// parallel sync. Six concurrent syncs against the same six tables is
// pure waste.
let inFlight: Promise<void> | null = null

/**
 * Sync all reference tables from Supabase to IndexedDB.
 * Called on app load, periodically, and on manual refresh.
 * Non-blocking — errors are logged but don't throw.
 *
 * Idempotent under concurrency: overlapping callers share the same
 * in-flight promise.
 */
export async function syncAllRefData(): Promise<void> {
  if (!navigator.onLine) return
  if (inFlight) return inFlight
  inFlight = doSync().finally(() => {
    inFlight = null
  })
  return inFlight
}

async function doSync(): Promise<void> {
  const syncTasks: Array<{ name: RefTableName; fetch: () => Promise<unknown[]> }> = [
    {
      name: 'contracts',
      fetch: async () => {
        const { data } = await supabase
          .from('contracts')
          .select('*')
          .in('status', ['active', 'upcoming', 'seasonal'])
          .order('name')
        return data ?? []
      },
    },
    {
      name: 'units',
      fetch: async () => {
        const { data } = await supabase.from('units').select('*').order('name')
        return data ?? []
      },
    },
    {
      name: 'employees',
      fetch: async () => {
        const { data } = await supabase
          .from('employees')
          .select('*')
          .eq('status', 'active')
          .order('last_name')
        return data ?? []
      },
    },
    {
      name: 'crewSets',
      fetch: async () => {
        const { data } = await supabase.from('crew_sets').select('*').order('name')
        return data ?? []
      },
    },
    {
      name: 'crewSetMembers',
      fetch: async () => {
        const { data } = await supabase.from('crew_set_members').select('*')
        return data ?? []
      },
    },
    {
      name: 'workTypes',
      fetch: async () => {
        const { data } = await supabase
          .from('work_types')
          .select('*')
          .eq('is_active', true)
          .order('display_order')
        return data ?? []
      },
    },
  ]

  const db = await getOfflineDB()

  await Promise.allSettled(
    syncTasks.map(async (task) => {
      try {
        const data = await task.fetch()
        const record: RefDataRecord = {
          table: task.name,
          data,
          syncedAt: Date.now(),
        }
        await db.put(STORES.REF_DATA, record)
      } catch (err) {
        console.warn(`[offline] Failed to sync ${task.name}:`, err)
      }
    })
  )
}

/**
 * Read cached reference data from IndexedDB.
 * Returns null if no cache exists for the table.
 */
export async function getCachedRefData<T = unknown>(tableName: RefTableName): Promise<{ data: T[]; syncedAt: number } | null> {
  try {
    const db = await getOfflineDB()
    const record = await db.get(STORES.REF_DATA, tableName)
    if (!record) return null
    return { data: record.data as T[], syncedAt: record.syncedAt }
  } catch (err) {
    console.warn(`[offline] Failed to read cached ${tableName}:`, err)
    return null
  }
}

/**
 * Get the oldest syncedAt across all reference tables.
 * Returns null if no data is cached.
 */
export async function getRefDataAge(): Promise<number | null> {
  try {
    const db = await getOfflineDB()
    const all = await db.getAll(STORES.REF_DATA)
    if (all.length === 0) return null
    const oldest = Math.min(...all.map(r => r.syncedAt))
    return Date.now() - oldest
  } catch {
    return null
  }
}
