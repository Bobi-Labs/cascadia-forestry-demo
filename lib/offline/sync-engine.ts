import { supabase } from '@/lib/supabase'
import { getPendingSubmissions, updateSubmissionStatus, cleanupSyncedSubmissions } from './offline-queue'
import { MAX_RETRY_COUNT, RETRY_BACKOFF_MS } from './constants'
import type { PendingSubmission } from './db'

type SyncListener = (event: SyncEvent) => void

export type SyncEvent =
  | { type: 'sync-start'; count: number }
  | { type: 'sync-progress'; submitted: PendingSubmission; remaining: number }
  | { type: 'sync-error'; submission: PendingSubmission; error: string }
  | { type: 'sync-complete'; synced: number; failed: number }
  | { type: 'auth-required' }

const listeners = new Set<SyncListener>()

export function onSyncEvent(listener: SyncListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emit(event: SyncEvent) {
  listeners.forEach(fn => fn(event))
}

let syncing = false

/**
 * Process the offline submission queue.
 * Called on reconnection, visibility change, manual trigger, or periodic poll.
 */
export async function processQueue(): Promise<void> {
  if (syncing) return
  if (!navigator.onLine) return

  syncing = true
  let syncedCount = 0
  let failedCount = 0

  try {
    // Verify auth session is still valid
    const { error: authError } = await supabase.auth.refreshSession()
    if (authError) {
      emit({ type: 'auth-required' })
      return
    }

    const pending = await getPendingSubmissions()
    if (pending.length === 0) {
      // Just do cleanup
      await cleanupSyncedSubmissions()
      return
    }

    emit({ type: 'sync-start', count: pending.length })

    for (const submission of pending) {
      // Check we're still online
      if (!navigator.onLine) break

      await updateSubmissionStatus(submission.id, 'syncing')

      try {
        await submitToSupabase(submission)
        await updateSubmissionStatus(submission.id, 'synced')
        syncedCount++
        emit({
          type: 'sync-progress',
          submitted: submission,
          remaining: pending.length - syncedCount - failedCount,
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)

        if (isNetworkError(err)) {
          // Network error — put back as pending, stop processing
          await updateSubmissionStatus(submission.id, 'pending')
          break
        }

        if (isDuplicateError(message)) {
          // Duplicate constraint — mark as failed, don't retry
          await updateSubmissionStatus(submission.id, 'failed', 'A timesheet for this contract on this date already exists.')
          failedCount++
          emit({ type: 'sync-error', submission, error: 'Duplicate entry' })
          continue
        }

        // Other error — increment retry count
        if (submission.retryCount >= MAX_RETRY_COUNT - 1) {
          await updateSubmissionStatus(submission.id, 'failed', message)
          failedCount++
          emit({ type: 'sync-error', submission, error: message })
        } else {
          await updateSubmissionStatus(submission.id, 'failed', message)
          // Wait with backoff before continuing
          const delay = RETRY_BACKOFF_MS[submission.retryCount] ?? 16000
          await new Promise(resolve => setTimeout(resolve, delay))
          // Set back to pending for next cycle
          await updateSubmissionStatus(submission.id, 'pending')
          failedCount++
        }
      }
    }

    emit({ type: 'sync-complete', synced: syncedCount, failed: failedCount })
    await cleanupSyncedSubmissions()
  } finally {
    syncing = false
  }
}

/**
 * Submit a queued timesheet to Supabase (same logic as foreman-timesheet.tsx handleSubmit).
 */
async function submitToSupabase(submission: PendingSubmission): Promise<void> {
  const { timesheet, entries, unitHours, productionLogs } = submission.payload

  // 1. Delete any existing rejected timesheet for this foreman/contract/date
  await supabase
    .from('timesheets')
    .delete()
    .eq('foreman_id', timesheet.foreman_id as string)
    .eq('contract_id', timesheet.contract_id as string)
    .eq('date', timesheet.date as string)
    .eq('status', 'rejected')

  // 2. Insert timesheet header
  const { data: ts, error: tsErr } = await supabase
    .from('timesheets')
    .insert(timesheet)
    .select('id')
    .single()

  if (tsErr) {
    if (tsErr.message?.includes('timesheets_foreman_id_contract_id_date_key')) {
      throw new Error('DUPLICATE')
    }
    throw new Error(`Timesheet insert failed: ${tsErr.message}`)
  }

  const timesheetId = ts.id

  // 3. Insert entries with the real timesheet ID
  if (entries.length > 0) {
    const withId = entries.map(e => ({ ...e, timesheet_id: timesheetId }))
    const { error: entErr } = await supabase.from('timesheet_entries').insert(withId)
    if (entErr) throw new Error(`Entries insert failed: ${entErr.message}`)
  }

  // 4. Insert unit hours
  if (unitHours.length > 0) {
    const withId = unitHours.map(u => ({ ...u, timesheet_id: timesheetId }))
    const { error: uhErr } = await supabase.from('timesheet_unit_hours').insert(withId)
    if (uhErr) throw new Error(`Unit hours insert failed: ${uhErr.message}`)
  }

  // 5. Insert production logs
  if (productionLogs.length > 0) {
    const withId = productionLogs.map(p => ({ ...p, timesheet_id: timesheetId }))
    const { error: prodErr } = await supabase.from('production_logs').insert(withId)
    if (prodErr) console.warn('[sync] Production log insert warning:', prodErr.message)
  }
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message === 'Failed to fetch') return true
  if (err instanceof DOMException && err.name === 'AbortError') return true
  return false
}

function isDuplicateError(message: string): boolean {
  return message.includes('DUPLICATE') || message.includes('timesheets_foreman_id_contract_id_date_key')
}
