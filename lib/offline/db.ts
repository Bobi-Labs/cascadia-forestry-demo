import { openDB, type IDBPDatabase } from 'idb'
import { DB_NAME, DB_VERSION, STORES } from './constants'
import type { UserProfile } from '@/lib/auth-context'

// ─── Types ──────────────────────────────────────────────────

export interface RefDataRecord {
  table: string
  data: unknown[]
  syncedAt: number // Date.now()
}

export interface CachedAuth {
  userId: string
  profile: UserProfile
  cachedAt: number
}

export type SubmissionStatus = 'pending' | 'syncing' | 'failed' | 'synced'

export interface TimesheetPayload {
  timesheet: Record<string, unknown>
  entries: Record<string, unknown>[]
  unitHours: Record<string, unknown>[]
  productionLogs: Record<string, unknown>[]
}

export interface PendingSubmission {
  id: string // crypto.randomUUID()
  createdAt: number
  status: SubmissionStatus
  retryCount: number
  lastError: string | null
  dedupKey: string // `${foreman_id}:${contract_id}:${date}`
  contractName: string // for display
  date: string // for display
  payload: TimesheetPayload
}

// ─── Database ───────────────────────────────────────────────

export interface OfflineDBSchema {
  [STORES.REF_DATA]: {
    key: string
    value: RefDataRecord
  }
  [STORES.AUTH]: {
    key: string
    value: CachedAuth
  }
  [STORES.PENDING_SUBMISSIONS]: {
    key: string
    value: PendingSubmission
    indexes: {
      'by-status': SubmissionStatus
      'by-created': number
    }
  }
}

let dbInstance: IDBPDatabase<OfflineDBSchema> | null = null

export async function getOfflineDB(): Promise<IDBPDatabase<OfflineDBSchema>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<OfflineDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Reference data store
      if (!db.objectStoreNames.contains(STORES.REF_DATA)) {
        db.createObjectStore(STORES.REF_DATA, { keyPath: 'table' })
      }

      // Auth cache store
      if (!db.objectStoreNames.contains(STORES.AUTH)) {
        db.createObjectStore(STORES.AUTH)
      }

      // Pending submissions store
      if (!db.objectStoreNames.contains(STORES.PENDING_SUBMISSIONS)) {
        const store = db.createObjectStore(STORES.PENDING_SUBMISSIONS, { keyPath: 'id' })
        store.createIndex('by-status', 'status')
        store.createIndex('by-created', 'createdAt')
      }
    },
  })

  return dbInstance
}

/**
 * Reset the DB singleton — used only in tests to get a fresh database.
 */
export function _resetDBForTesting(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}
