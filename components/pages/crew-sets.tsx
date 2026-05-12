"use client"

import { useState, useMemo } from 'react'
import { Users, Loader2, ChevronLeft, Pencil, Trash2, Plus, Star } from 'lucide-react'
import { useCrewSets, useCrewSetMembers, useAllCrewSetMembers, useEmployees } from '@/hooks/use-supabase'
import type { CrewSet, Employee } from '@/lib/database.types'
import { CreateCrewSetSheet } from './create-crew-set-sheet'
import { EditCrewSetSheet } from './edit-crew-set-sheet'
import useClientMutation from '@/hooks/use-client-mutation'
import { toast } from '@/hooks/use-toast'

// ─── Helpers ────────────────────────────────────────────

function formatLastUsed(dateStr: string | null): string {
  if (!dateStr) return 'Never used'
  const d = new Date(dateStr)
  const now = new Date()
  const days = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Used today'
  if (days === 1) return 'Used yesterday'
  if (days < 7) return `Used ${days}d ago`
  if (days < 30) return `Used ${Math.floor(days / 7)}w ago`
  return `Used ${d.toLocaleDateString()}`
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w.charAt(0)).join('').toUpperCase().slice(0, 2)
}

// ─── Crew Set Card ──────────────────────────────────────

function CrewSetCard({
  crewSet,
  foremanName,
  memberCount,
  isSelected,
  onSelect,
}: {
  crewSet: CrewSet
  foremanName: string
  memberCount: number
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-lg border p-4 text-left transition-all hover-card-lift ${
        isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
          <Users className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground truncate">{crewSet.name}</span>
            {crewSet.is_default && (
              <Star className="h-3 w-3 text-warning fill-warning shrink-0" />
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{foremanName}</div>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="font-mono text-foreground">{memberCount} members</span>
            <span className="text-muted-foreground">{formatLastUsed(crewSet.last_used_at)}</span>
          </div>
        </div>
      </div>
    </button>
  )
}

// ─── Detail Panel ───────────────────────────────────────

function CrewSetDetail({
  crewSet,
  foreman,
  onClose,
  onEdit,
  onDelete,
}: {
  crewSet: CrewSet
  foreman: Employee | undefined
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { data: members, loading: membersLoading } = useCrewSetMembers(crewSet.id)
  const { data: employees } = useEmployees()

  const memberDetails = useMemo(() => {
    if (!members || !employees) return []
    return members
      .map(m => employees.find(e => e.id === m.employee_id))
      .filter((e): e is Employee => !!e)
      .sort((a, b) => {
        // Foremen first, then drivers, then crew
        const roleOrder = (e: Employee) => e.is_foreman ? 0 : e.is_driver ? 1 : 2
        return roleOrder(a) - roleOrder(b) || a.last_name.localeCompare(b.last_name)
      })
  }, [members, employees])

  function getRole(emp: Employee): string {
    if (emp.is_foreman) return 'Foreman'
    if (emp.is_driver) return 'Driver'
    return 'Crew'
  }

  function getRoleBadgeClass(emp: Employee): string {
    if (emp.is_foreman) return 'bg-primary text-primary-foreground'
    if (emp.is_driver) return 'bg-info text-foreground'
    return 'bg-muted text-muted-foreground'
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{crewSet.name}</span>
              {crewSet.is_default && <Star className="h-3 w-3 text-warning fill-warning" />}
            </div>
            <div className="text-xs text-muted-foreground">
              {foreman ? `${foreman.first_name} ${foreman.last_name}` : 'Unknown foreman'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="flex h-7 items-center gap-1 rounded-md border border-border bg-elevated px-2 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-card transition-colors">
            <Pencil className="h-3 w-3" /> Edit
          </button>
          <button onClick={onDelete} className="flex h-7 items-center gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-2 text-[10px] font-medium text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 className="h-3 w-3" /> Delete
          </button>
          <button onClick={onClose} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors md:hidden">
            <ChevronLeft className="h-3.5 w-3.5" /> Back
          </button>
          <button onClick={onClose} className="hidden md:flex rounded p-1 text-muted-foreground hover:bg-elevated hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Members ({memberDetails.length})
          </h4>
        </div>

        {membersLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading members...
          </div>
        ) : memberDetails.length === 0 ? (
          <div className="py-4 text-sm text-muted-foreground">No members</div>
        ) : (
          <div className="flex flex-col gap-2">
            {memberDetails.map(emp => (
              <div key={emp.id} className="flex items-center gap-3 rounded-md bg-elevated/50 px-3 py-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted-foreground/20 text-[10px] font-bold text-muted-foreground">
                  {getInitials(`${emp.first_name} ${emp.last_name}`)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground">{emp.first_name} {emp.last_name}</div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getRoleBadgeClass(emp)}`}>
                  {getRole(emp)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-md bg-elevated/50 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">Last Used</div>
            <div className="text-sm font-medium text-foreground">{formatLastUsed(crewSet.last_used_at)}</div>
          </div>
          <div className="rounded-md bg-elevated/50 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">Default Set</div>
            <div className="text-sm font-medium text-foreground">{crewSet.is_default ? 'Yes' : 'No'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────

export function CrewSetsPage() {
  const { data: crewSets, loading, error } = useCrewSets()
  const { data: employees } = useEmployees()
  const [selectedSet, setSelectedSet] = useState<CrewSet | null>(null)
  const [editingSet, setEditingSet] = useState<CrewSet | null>(null)
  const [showCreateSheet, setShowCreateSheet] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<CrewSet | null>(null)

  const deleteMutation = useClientMutation("deleteCrewSet", {
    onSuccess: (result) => {
      if (result.success) {
        toast({ title: "Crew set deleted", description: "The crew set has been removed." })
        setSelectedSet(null)
        setConfirmDelete(null)
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      }
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  // Build foreman lookup
  const foremanMap = useMemo(() => {
    if (!employees) return new Map<string, Employee>()
    return new Map(employees.filter(e => e.is_foreman).map(e => [e.id, e]))
  }, [employees])

  const { data: allMembers } = useAllCrewSetMembers()

  // Count members per crew set from live data
  const memberCounts = useMemo(() => {
    const map = new Map<string, number>()
    allMembers?.forEach(m => map.set(m.crew_set_id, (map.get(m.crew_set_id) ?? 0) + 1))
    return map
  }, [allMembers])

  // Foreman filter
  const [foremanFilter, setForemanFilter] = useState<string>('all')
  const foremen = useMemo(() => {
    if (!crewSets || !employees) return []
    const ids = [...new Set(crewSets.map(cs => cs.foreman_id))]
    return ids.map(id => foremanMap.get(id)).filter((e): e is Employee => !!e)
  }, [crewSets, employees, foremanMap])

  const filteredSets = useMemo(() => {
    if (!crewSets) return []
    if (foremanFilter === 'all') return crewSets
    return crewSets.filter(cs => cs.foreman_id === foremanFilter)
  }, [crewSets, foremanFilter])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading crew sets...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load crew sets: {error}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Stats Strip */}
      <div className="flex items-center gap-6 rounded-lg border border-border bg-card px-4 py-2.5 text-xs">
        <div><span className="text-muted-foreground">Total Sets:</span> <span className="font-mono font-medium text-foreground">{crewSets?.length ?? 0}</span></div>
        <div className="h-3 w-px bg-border" />
        <div><span className="text-muted-foreground">Foremen:</span> <span className="font-mono font-medium text-primary">{foremen.length}</span></div>
        <div className="h-3 w-px bg-border" />
        <div><span className="text-muted-foreground">Default Sets:</span> <span className="font-mono font-medium text-warning">{crewSets?.filter(cs => cs.is_default).length ?? 0}</span></div>
      </div>

      {/* Filter + Add Row */}
      <div data-tour="crew-sets-filters" className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setForemanFilter('all')}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              foremanFilter === 'all' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-elevated hover:text-foreground'
            }`}
          >
            All Sets
          </button>
          {foremen.map(f => (
            <button
              key={f.id}
              onClick={() => setForemanFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                foremanFilter === f.id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-elevated hover:text-foreground'
              }`}
            >
              {f.first_name}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCreateSheet(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New Crew Set
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_400px] gap-5">
        {/* Cards Grid — hidden on mobile when detail panel is open */}
        <div data-tour="crew-sets-grid" className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${selectedSet ? 'hidden md:grid' : ''}`}>
          {filteredSets.length === 0 ? (
            <div className="col-span-2 flex items-center justify-center py-12 text-sm text-muted-foreground">
              No crew sets found
            </div>
          ) : (
            filteredSets.map(cs => {
              const foreman = foremanMap.get(cs.foreman_id)
              return (
                <CrewSetCard
                  key={cs.id}
                  crewSet={cs}
                  foremanName={foreman ? `${foreman.first_name} ${foreman.last_name}` : 'Unknown'}
                  memberCount={memberCounts.get(cs.id) ?? 0}
                  isSelected={selectedSet?.id === cs.id}
                  onSelect={() => setSelectedSet(cs)}
                />
              )
            })
          )}
        </div>

        {/* Detail Panel */}
        {selectedSet ? (
          <div>
            <CrewSetDetail
              crewSet={selectedSet}
              foreman={foremanMap.get(selectedSet.foreman_id)}
              onClose={() => setSelectedSet(null)}
              onEdit={() => {
                setEditingSet(selectedSet)
                setShowEditSheet(true)
              }}
              onDelete={() => setConfirmDelete(selectedSet)}
            />

            {/* Delete Confirmation */}
            {confirmDelete && (
              <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm text-destructive font-medium">Delete &ldquo;{confirmDelete.name}&rdquo;?</p>
                <p className="mt-1 text-xs text-muted-foreground">This will remove the crew set and all its member assignments. This cannot be undone.</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => deleteMutation.mutate({ id: confirmDelete.id })}
                    disabled={deleteMutation.isPending}
                    className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-card/50 text-sm text-muted-foreground">
            Select a crew set to view details
          </div>
        )}
      </div>

      <CreateCrewSetSheet
        open={showCreateSheet}
        onOpenChange={setShowCreateSheet}
        onCreated={() => setSelectedSet(null)}
      />

      <EditCrewSetSheet
        crewSet={editingSet}
        open={showEditSheet}
        onOpenChange={setShowEditSheet}
        onUpdated={() => setSelectedSet(null)}
      />
    </div>
  )
}
