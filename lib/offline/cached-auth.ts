import { getOfflineDB } from './db'
import { STORES, AUTH_CACHE_MAX_AGE_MS } from './constants'
import type { UserProfile } from '@/lib/auth-context'
import type { CachedAuth } from './db'

const AUTH_KEY = 'currentUser'

/**
 * Cache user profile to IndexedDB after successful login/session refresh.
 */
export async function cacheUserProfile(userId: string, profile: UserProfile): Promise<void> {
  try {
    const db = await getOfflineDB()
    const record: CachedAuth = {
      userId,
      profile,
      cachedAt: Date.now(),
    }
    await db.put(STORES.AUTH, record, AUTH_KEY)
  } catch (err) {
    console.warn('[offline] Failed to cache user profile:', err)
  }
}

/**
 * Retrieve cached user profile from IndexedDB.
 * Returns null if no cache exists or cache is expired (>7 days).
 */
export async function getCachedUserProfile(): Promise<CachedAuth | null> {
  try {
    const db = await getOfflineDB()
    const record = await db.get(STORES.AUTH, AUTH_KEY)
    if (!record) return null

    // Check if cache is expired
    if (Date.now() - record.cachedAt > AUTH_CACHE_MAX_AGE_MS) {
      console.warn('[offline] Cached auth expired, clearing')
      await db.delete(STORES.AUTH, AUTH_KEY)
      return null
    }

    return record
  } catch (err) {
    console.warn('[offline] Failed to read cached auth:', err)
    return null
  }
}

/**
 * Clear cached auth (e.g., on sign out).
 */
export async function clearCachedAuth(): Promise<void> {
  try {
    const db = await getOfflineDB()
    await db.delete(STORES.AUTH, AUTH_KEY)
  } catch (err) {
    console.warn('[offline] Failed to clear cached auth:', err)
  }
}
