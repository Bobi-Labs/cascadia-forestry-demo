// Offline/PWA configuration constants

export const DB_NAME = 'cascadia-ops-offline'
export const DB_VERSION = 1

// IndexedDB store names
export const STORES = {
  REF_DATA: 'refData',
  AUTH: 'auth',
  PENDING_SUBMISSIONS: 'pendingSubmissions',
} as const

// Reference data table names (must match keys used in ref-data-sync)
export const REF_TABLES = [
  'contracts',
  'units',
  'employees',
  'crewSets',
  'crewSetMembers',
  'workTypes',
] as const

export type RefTableName = typeof REF_TABLES[number]

// How long cached auth is considered valid (7 days = Supabase default refresh token TTL)
export const AUTH_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

// How old reference data can be before showing a warning (24 hours)
export const REF_DATA_STALE_WARNING_MS = 24 * 60 * 60 * 1000

// Background ref data sync interval (15 minutes)
export const REF_DATA_SYNC_INTERVAL_MS = 15 * 60 * 1000

// Sync engine polling interval when online (60 seconds)
export const SYNC_POLL_INTERVAL_MS = 60 * 1000

// Submission retry config
export const MAX_RETRY_COUNT = 5
export const RETRY_BACKOFF_MS = [1000, 2000, 4000, 8000, 16000] // exponential

// Clean up synced submissions after this duration (24 hours)
export const SYNCED_CLEANUP_AGE_MS = 24 * 60 * 60 * 1000
