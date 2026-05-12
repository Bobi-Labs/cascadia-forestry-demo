import { getOfflineDB, type PendingSubmission, type TimesheetPayload } from './db'
import { STORES, SYNCED_CLEANUP_AGE_MS } from './constants'

/**
 * Enqueue a timesheet submission for later sync.
 */
export async function enqueueSubmission(
  payload: TimesheetPayload,
  dedupKey: string,
  contractName: string,
  date: string,
): Promise<PendingSubmission> {
  const db = await getOfflineDB()

  const submission: PendingSubmission = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    status: 'pending',
    retryCount: 0,
    lastError: null,
    dedupKey,
    contractName,
    date,
    payload,
  }

  await db.put(STORES.PENDING_SUBMISSIONS, submission)
  return submission
}

/**
 * Check if a submission with the same dedup key already exists in the queue.
 */
export async function hasDuplicateInQueue(dedupKey: string): Promise<boolean> {
  const db = await getOfflineDB()
  const all = await db.getAll(STORES.PENDING_SUBMISSIONS)
  return all.some(s => s.dedupKey === dedupKey && (s.status === 'pending' || s.status === 'syncing'))
}

/**
 * Get all pending submissions (for sync engine).
 */
export async function getPendingSubmissions(): Promise<PendingSubmission[]> {
  const db = await getOfflineDB()
  const all = await db.getAllFromIndex(STORES.PENDING_SUBMISSIONS, 'by-created')
  return all.filter(s => s.status === 'pending')
}

/**
 * Get all submissions (for UI display).
 */
export async function getAllSubmissions(): Promise<PendingSubmission[]> {
  const db = await getOfflineDB()
  return db.getAllFromIndex(STORES.PENDING_SUBMISSIONS, 'by-created')
}

/**
 * Update a submission's status.
 */
export async function updateSubmissionStatus(
  id: string,
  status: PendingSubmission['status'],
  error?: string,
): Promise<void> {
  const db = await getOfflineDB()
  const submission = await db.get(STORES.PENDING_SUBMISSIONS, id)
  if (!submission) return

  submission.status = status
  if (status === 'failed') {
    submission.retryCount += 1
    submission.lastError = error ?? null
  }
  if (status === 'synced') {
    submission.lastError = null
  }

  await db.put(STORES.PENDING_SUBMISSIONS, submission)
}

/**
 * Delete a submission from the queue.
 */
export async function deleteSubmission(id: string): Promise<void> {
  const db = await getOfflineDB()
  await db.delete(STORES.PENDING_SUBMISSIONS, id)
}

/**
 * Clean up synced submissions older than 24 hours.
 */
export async function cleanupSyncedSubmissions(): Promise<void> {
  const db = await getOfflineDB()
  const all = await db.getAll(STORES.PENDING_SUBMISSIONS)
  const cutoff = Date.now() - SYNCED_CLEANUP_AGE_MS

  for (const submission of all) {
    if (submission.status === 'synced' && submission.createdAt < cutoff) {
      await db.delete(STORES.PENDING_SUBMISSIONS, submission.id)
    }
  }
}

/**
 * Get count of pending + syncing submissions.
 */
export async function getPendingCount(): Promise<number> {
  const db = await getOfflineDB()
  const all = await db.getAll(STORES.PENDING_SUBMISSIONS)
  return all.filter(s => s.status === 'pending' || s.status === 'syncing').length
}
