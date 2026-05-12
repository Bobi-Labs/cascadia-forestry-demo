"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useApp } from '@/lib/app-context'
import { useAuth } from '@/lib/auth-context'
import { employees } from '@/lib/mock-data'
import { BarChart3, Phone, HelpCircle, FolderOpen, Clock, Users, CalendarDays, CloudSun, Truck, DollarSign, Bell, User, FileText, CheckCircle2, TreePine, ArrowUp, AlertTriangle, Snowflake, Wind, Loader2, CheckCircle, Globe, CalendarIcon, MapPin, Building, X, Camera, ClipboardList, UsersRound, ChevronLeft, Folder, File, ExternalLink, Home, StickyNote, Star, Receipt } from 'lucide-react'
import { ForemanTimesheetPage } from '@/components/pages/foreman-timesheet'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { useContracts, useUnits, useCrewSets, useEmployees, useComplianceItems, useAllCrewSetMembers, useTimesheetsWithDetails } from '@/hooks/use-supabase'
import { CrewSetsPage } from '@/components/pages/crew-sets'
import { WorkTrackerPage } from '@/components/pages/work-tracker'
import { CommunicationsPage } from '@/components/pages/communications'
import { ContractsPage } from '@/components/pages/contracts'
import { AdminUnitsPage } from '@/components/pages/admin-units'
import { ContactsPage } from '@/components/pages/contacts-page'
import { FilesPage } from '@/components/pages/files-page'
import { TimeSheetsPage } from '@/components/pages/timesheets'
import { ExpensesPage, AnalyticsPage } from '@/components/pages/admin-pages'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { CASCADIA_ID, RAMOS_ID } from '@/lib/database.types'
import { createClient } from '@/lib/supabase/client'
import { useProfilePhoto } from '@/hooks/use-profile-photo'

// --- Owner / Jose View (Spanish-first, simplified, large text) ---

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos dias'
  if (hour < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

function trafficLightColor(status: string): { dot: string; bg: string; label: string } {
  switch (status) {
    case 'active':
    case 'completed':
      return { dot: 'bg-green-500', bg: 'bg-green-500/20', label: 'Activo (Active)' }
    case 'upcoming':
    case 'seasonal':
      return { dot: 'bg-blue-500', bg: 'bg-blue-500/20', label: 'Proximo (Upcoming)' }
    case 'pending_approval':
    case 'open':
      return { dot: 'bg-yellow-500', bg: 'bg-yellow-500/20', label: 'Pendiente (Pending)' }
    case 'closed':
    case 'archived':
      return { dot: 'bg-red-500', bg: 'bg-red-500/20', label: 'Cerrado (Closed)' }
    default:
      return { dot: 'bg-yellow-500', bg: 'bg-yellow-500/20', label: 'En Progreso' }
  }
}

// Completion-based traffic light for progress bars within contract detail
function trafficLightFromCompletion(pct: number): { dot: string; bg: string; label: string } {
  if (pct >= 75) return { dot: 'bg-green-500', bg: 'bg-green-500/20', label: 'Bien' }
  if (pct >= 25) return { dot: 'bg-yellow-500', bg: 'bg-yellow-500/20', label: 'En Progreso' }
  return { dot: 'bg-red-500', bg: 'bg-red-500/20', label: 'Urgente' }
}

// ─── Owner Contract Detail Sheet ──────────────────────────
// Simplified contract detail for Jose — NO financial data, large text, bilingual

interface OwnerContractContact {
  id: string
  name: string
  title: string
  email: string
  phone: string
}

function ownerUnitStatusBadge(status: string): { color: string; labelEs: string; labelEn: string } {
  switch (status) {
    case 'completed': return { color: 'bg-green-500/20 text-green-500', labelEs: 'Completado', labelEn: 'Completed' }
    case 'in_progress': return { color: 'bg-blue-500/20 text-blue-500', labelEs: 'En Progreso', labelEn: 'In Progress' }
    case 'not_started': return { color: 'bg-muted text-muted-foreground', labelEs: 'No Iniciado', labelEn: 'Not Started' }
    case 'pending': return { color: 'bg-amber-500/20 text-amber-400', labelEs: 'Pendiente', labelEn: 'Pending' }
    default: return { color: 'bg-muted text-muted-foreground', labelEs: status, labelEn: status }
  }
}

interface OwnerContractSummary {
  id: string
  name: string
  status: string
  company_id: string
  location: string | null
  landowner: string | null
  start_date: string | null
  end_date: string | null
  work_types: string[]
  avgCompletion: number
  completedUnits: number
  totalUnits: number
}

function OwnerContractDetailSheet({
  contract,
  contractUnits,
  open,
  onOpenChange,
}: {
  contract: OwnerContractSummary | null
  contractUnits: Array<{ id: string; name: string; status: string }>
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [contacts, setContacts] = useState<OwnerContractContact[]>([])

  // Load contacts from Supabase when sheet opens
  useEffect(() => {
    if (open && contract) {
      const supabase = createClient()
      supabase
        .from('contract_contacts')
        .select('id, name, title, email, phone')
        .eq('contract_id', contract.id)
        .order('name')
        .then(({ data }) => {
          if (data) setContacts(data)
        })
    }
  }, [open, contract])

  if (!contract) return null

  const tl = trafficLightColor(contract.status)
  const progressTl = trafficLightFromCompletion(contract.avgCompletion)
  const companyName = contract.company_id === CASCADIA_ID ? 'Cascadia' : contract.company_id === RAMOS_ID ? 'Ramos' : 'Otro'

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-MX', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pb-2">
          <div className="flex items-center gap-3">
            <span className={`h-4 w-4 shrink-0 rounded-full ${tl.dot}`} />
            <SheetTitle className="text-xl font-bold md:text-2xl">{contract.name}</SheetTitle>
          </div>
          <SheetDescription className="sr-only">Detalles del contrato</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-1 pb-8">
          {/* Status + Company badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${tl.bg} ${
              tl.dot === 'bg-green-500' ? 'text-green-500' :
              tl.dot === 'bg-blue-500' ? 'text-blue-500' :
              tl.dot === 'bg-yellow-500' ? 'text-yellow-500' : 'text-red-500'
            }`}>
              {tl.label}
            </span>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${
              contract.company_id === CASCADIA_ID
                ? 'bg-primary/20 text-primary'
                : 'bg-purple-500/20 text-purple-400'
            }`}>
              {companyName}
            </span>
          </div>

          {/* Progress */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-base font-semibold text-foreground md:text-lg">
                Progreso <span className="text-sm font-normal text-muted-foreground">(Progress)</span>
              </span>
              <span className="font-mono text-lg font-bold text-foreground">{contract.avgCompletion}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${progressTl.dot}`}
                style={{ width: `${Math.max(contract.avgCompletion, 2)}%` }}
              />
            </div>
            <div className="mt-2 text-base text-muted-foreground">
              {contract.completedUnits} de {contract.totalUnits} unidades completadas
              <span className="ml-2 text-sm">({contract.completedUnits} of {contract.totalUnits} units completed)</span>
            </div>
          </div>

          {/* Key Dates */}
          {(contract.start_date || contract.end_date) && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-base font-semibold text-foreground md:text-lg">
                <CalendarIcon className="mb-0.5 mr-2 inline h-5 w-5 text-primary" />
                Fechas <span className="text-sm font-normal text-muted-foreground">(Dates)</span>
              </h3>
              <div className="flex flex-col gap-2 text-base">
                {contract.start_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Inicio (Start):</span>
                    <span className="font-medium text-foreground">{formatDate(contract.start_date)}</span>
                  </div>
                )}
                {contract.end_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Fin (End):</span>
                    <span className="font-medium text-foreground">{formatDate(contract.end_date)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Location / Landowner */}
          {(contract.location || contract.landowner) && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-base font-semibold text-foreground md:text-lg">
                <MapPin className="mb-0.5 mr-2 inline h-5 w-5 text-primary" />
                Ubicacion <span className="text-sm font-normal text-muted-foreground">(Location)</span>
              </h3>
              <div className="flex flex-col gap-2 text-base">
                {contract.location && (
                  <div className="text-foreground">{contract.location}</div>
                )}
                {contract.landowner && (
                  <div className="text-muted-foreground">
                    Propietario: <span className="text-foreground">{contract.landowner}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Work Types */}
          {contract.work_types && contract.work_types.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-base font-semibold text-foreground md:text-lg">
                <TreePine className="mb-0.5 mr-2 inline h-5 w-5 text-primary" />
                Tipo de Trabajo <span className="text-sm font-normal text-muted-foreground">(Work Types)</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {contract.work_types.map(wt => (
                  <span key={wt} className="rounded-full bg-primary/20 px-3 py-1 text-sm font-medium text-primary">
                    {wt}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Contacts */}
          {contacts.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-base font-semibold text-foreground md:text-lg">
                <Phone className="mb-0.5 mr-2 inline h-5 w-5 text-primary" />
                Contactos <span className="text-sm font-normal text-muted-foreground">(Contacts)</span>
              </h3>
              <div className="flex flex-col gap-3">
                {contacts.map(c => (
                  <div key={c.id} className="rounded-lg bg-elevated p-3">
                    <div className="text-base font-medium text-foreground">{c.name}</div>
                    {c.title && <div className="text-sm text-muted-foreground">{c.title}</div>}
                    <div className="mt-1 flex flex-col gap-0.5 text-sm text-muted-foreground">
                      {c.phone && <span>{c.phone}</span>}
                      {c.email && <span>{c.email}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unit List */}
          {contractUnits.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-base font-semibold text-foreground md:text-lg">
                <FolderOpen className="mb-0.5 mr-2 inline h-5 w-5 text-primary" />
                Unidades <span className="text-sm font-normal text-muted-foreground">({contractUnits.length} Units)</span>
              </h3>
              <div className="flex flex-col gap-2">
                {contractUnits.map(u => {
                  const badge = ownerUnitStatusBadge(u.status)
                  return (
                    <div key={u.id} className="flex items-center justify-between rounded-lg bg-elevated px-3 py-2.5" style={{ minHeight: '48px' }}>
                      <span className="text-base text-foreground">{u.name}</span>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.color}`}>
                        {badge.labelEs}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function OwnerOverview() {
  const { setActivePage } = useApp()
  const { data: dbContracts, loading: loadingContracts } = useContracts()
  const { data: units } = useUnits()
  const { data: crewSets, loading: loadingCrews } = useCrewSets()
  const { data: dbEmployees, loading: loadingEmployees } = useEmployees()
  const { data: allCrewMembers } = useAllCrewSetMembers()
  const { data: complianceItems, loading: loadingCompliance } = useComplianceItems()
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null)

  // All contracts with unit-based completion stats
  const allContracts = useMemo(() => {
    if (!dbContracts) return []
    // Show non-archived contracts, sorted: active first, then by name
    return dbContracts
      .filter(c => c.status !== 'archived')
      .map(c => {
        const contractUnits = units?.filter(u => u.contract_id === c.id) || []
        const completedUnits = contractUnits.filter(u => u.status === 'completed').length
        const totalUnits = contractUnits.length
        const avgCompletion = totalUnits > 0
          ? Math.round((completedUnits / totalUnits) * 100)
          : 0
        return { ...c, completedUnits, totalUnits, avgCompletion }
      })
      .sort((a, b) => {
        // Active contracts first, then by name
        const statusOrder: Record<string, number> = { active: 0, open: 1, upcoming: 2, seasonal: 3, pending_approval: 4, closed: 5 }
        const aOrder = statusOrder[a.status] ?? 99
        const bOrder = statusOrder[b.status] ?? 99
        if (aOrder !== bOrder) return aOrder - bOrder
        return a.name.localeCompare(b.name)
      })
  }, [dbContracts, units])

  const activeContractCount = useMemo(() => {
    return allContracts.filter(c => c.status === 'active').length
  }, [allContracts])

  // Group crew sets by foreman — show real employee names
  const foremanCrews = useMemo(() => {
    if (!crewSets || !dbEmployees || !allCrewMembers) return []
    const foremen = dbEmployees.filter(e => e.is_foreman)
    const employeeMap = new Map(dbEmployees.map(e => [e.id, e]))
    return foremen.map(foreman => {
      const sets = crewSets.filter(cs => cs.foreman_id === foreman.id)
      // Get all unique employee IDs across all crew sets for this foreman
      const memberIds = new Set<string>()
      for (const cs of sets) {
        const members = allCrewMembers.filter(m => m.crew_set_id === cs.id)
        for (const m of members) memberIds.add(m.employee_id)
      }
      // Resolve employee names
      const crewMembers = Array.from(memberIds)
        .map(id => employeeMap.get(id))
        .filter(Boolean)
        .map(e => ({ id: e!.id, name: `${e!.first_name} ${e!.last_name}` }))
        .sort((a, b) => a.name.localeCompare(b.name))
      // Find which contract this foreman is assigned to
      const assignedContract = dbContracts?.find(c => c.foreman_id === foreman.id && c.status === 'active')
      // Fallback to most recent crew set name
      const latestSet = [...sets].sort((a, b) =>
        (b.last_used_at || '').localeCompare(a.last_used_at || '')
      )[0]
      return {
        foremanId: foreman.id,
        foremanName: `${foreman.first_name} ${foreman.last_name}`,
        companyAuth: foreman.company_auth,
        crewSetCount: sets.length,
        crewMembers,
        assignedContractName: assignedContract?.name || null,
        latestSetName: latestSet?.name || null,
      }
    }).filter(fc => fc.crewSetCount > 0 || fc.crewMembers.length > 0)
  }, [crewSets, dbEmployees, allCrewMembers, dbContracts])

  const loading = loadingContracts || loadingCrews || loadingEmployees

  // Compliance alerts — show due_soon and overdue items
  const criticalAlerts = useMemo(() => {
    if (!complianceItems) return []
    return complianceItems
      .filter(item => item.status === 'due_soon' || item.status === 'overdue')
      .map(item => {
        const dueDate = new Date(item.due_date + 'T00:00:00')
        const now = new Date()
        const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return {
          id: item.id,
          type: item.status === 'overdue' ? 'critical' as const : 'warning' as const,
          title: item.title,
          countdown: daysUntil <= 0
            ? `${Math.abs(daysUntil)} dia${Math.abs(daysUntil) !== 1 ? 's' : ''} vencido`
            : `${daysUntil} dia${daysUntil !== 1 ? 's' : ''}`,
        }
      })
      .sort((a, b) => (a.type === 'critical' ? -1 : 1) - (b.type === 'critical' ? -1 : 1))
  }, [complianceItems])

  return (
    <div className="flex flex-col gap-6 pb-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">
          {getGreeting()}, Jose
        </h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">
          Aqui esta el estado de sus operaciones hoy.
        </p>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
        {/* Active Contracts */}
        <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <div className="flex items-center gap-3">
            <span className="h-4 w-4 rounded-full bg-green-500" />
            <span className="text-base text-muted-foreground md:text-lg">Proyectos Activos</span>
          </div>
          <div className="mt-3 font-mono text-4xl font-bold text-foreground md:text-5xl">
            {loading ? '...' : activeContractCount}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            {!loading && allContracts.length !== activeContractCount && (
              <span>{allContracts.length} total &middot; </span>
            )}
            (Active Projects)
          </div>
        </div>

        {/* Crews Working */}
        <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <span className="text-base text-muted-foreground md:text-lg">Cuadrillas</span>
          </div>
          <div className="mt-3 font-mono text-4xl font-bold text-foreground md:text-5xl">
            {loading ? '...' : foremanCrews.length}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            (Crews Working)
          </div>
        </div>

        {/* Overall Status — clickable to scroll to alerts */}
        <button
          type="button"
          onClick={() => {
            if (criticalAlerts.length > 0) {
              document.getElementById('owner-alerts')?.scrollIntoView({ behavior: 'smooth' })
            }
          }}
          className={`rounded-2xl border p-5 text-left transition-colors md:p-6 ${
            criticalAlerts.length > 0
              ? 'border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10'
              : 'border-green-500/30 bg-green-500/5'
          }`}
        >
          <div className="flex items-center gap-3">
            {criticalAlerts.length > 0 ? (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
            <span className="text-base text-muted-foreground md:text-lg">Estado General</span>
          </div>
          <div className={`mt-3 text-2xl font-bold md:text-3xl ${
            criticalAlerts.length > 0 ? 'text-yellow-500' : 'text-green-500'
          }`}>
            {criticalAlerts.length > 0 ? 'Atencion' : 'Todo Bien'}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            {criticalAlerts.length > 0
              ? `${criticalAlerts.length} alerta${criticalAlerts.length > 1 ? 's' : ''} (${criticalAlerts.length} alert${criticalAlerts.length > 1 ? 's' : ''})`
              : '(All Good)'}
          </div>
        </button>
      </div>

      {/* Crews by Foreman */}
      <div>
        <h2 className="mb-3 text-xl font-semibold text-foreground md:text-2xl">
          Cuadrillas por Capataz
          <span className="ml-3 text-base font-normal text-muted-foreground">(Crews by Foreman)</span>
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-3 text-lg text-muted-foreground">Cargando...</span>
          </div>
        ) : foremanCrews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 py-12 text-center text-xl text-muted-foreground">
            No hay cuadrillas configuradas
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
            {foremanCrews.map(fc => (
              <div key={fc.foremanId} className="rounded-2xl border border-border bg-card p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-base font-bold text-primary">
                      {fc.foremanName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-foreground md:text-xl">
                        {fc.foremanName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Capataz (Foreman)
                        {fc.companyAuth === 'cascadia' ? ' — Cascadia' :
                         fc.companyAuth === 'ramos' ? ' — Ramos' : ' — Ambos'}
                      </div>
                    </div>
                  </div>
                  <span className="h-3.5 w-3.5 rounded-full bg-green-500" />
                </div>
                {/* Assigned contract */}
                {fc.assignedContractName && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-primary">
                    <TreePine className="h-4 w-4" />
                    <span>{fc.assignedContractName}</span>
                  </div>
                )}
                {/* Crew set info */}
                <div className="mt-2 flex items-center gap-5 text-sm text-muted-foreground md:text-base">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{fc.crewMembers.length} trabajador{fc.crewMembers.length !== 1 ? 'es' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    <span>{fc.crewSetCount} cuadrilla{fc.crewSetCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                {/* Employee names */}
                {fc.crewMembers.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {fc.crewMembers.slice(0, 8).map(m => (
                      <span key={m.id} className="rounded-full bg-elevated px-2.5 py-1 text-xs text-muted-foreground">
                        {m.name}
                      </span>
                    ))}
                    {fc.crewMembers.length > 8 && (
                      <span className="rounded-full bg-elevated px-2.5 py-1 text-xs text-muted-foreground">
                        +{fc.crewMembers.length - 8} mas
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contracts */}
      <div>
        <h2 className="mb-3 text-xl font-semibold text-foreground md:text-2xl">
          Proyectos
          <span className="ml-3 text-base font-normal text-muted-foreground">(Projects)</span>
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-3 text-lg text-muted-foreground">Cargando proyectos...</span>
          </div>
        ) : allContracts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 py-12 text-center text-xl text-muted-foreground">
            No hay contratos
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
            {allContracts.map(c => {
              const tl = trafficLightColor(c.status)
              const progressTl = trafficLightFromCompletion(c.avgCompletion)
              const companyLabel = c.company_id === CASCADIA_ID ? 'Cascadia' : c.company_id === RAMOS_ID ? 'Ramos' : ''
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedContractId(c.id)}
                  className="rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30 hover:bg-card/80 md:p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className={`h-3.5 w-3.5 shrink-0 rounded-full ${tl.dot}`} />
                      <div>
                        <div className="text-lg font-semibold text-foreground">{c.name}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{c.location || c.landowner || 'Sin ubicacion'}</span>
                          {companyLabel && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              c.company_id === CASCADIA_ID
                                ? 'bg-primary/20 text-primary'
                                : 'bg-purple-500/20 text-purple-400'
                            }`}>{companyLabel}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-sm font-medium ${tl.bg} ${
                      tl.dot === 'bg-green-500' ? 'text-green-500' :
                      tl.dot === 'bg-blue-500' ? 'text-blue-500' :
                      tl.dot === 'bg-yellow-500' ? 'text-yellow-500' : 'text-red-500'
                    }`}>
                      {tl.label}
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-base font-mono font-semibold text-foreground">
                        {c.avgCompletion}%
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {c.completedUnits}/{c.totalUnits} unidades
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${progressTl.dot}`}
                        style={{ width: `${Math.max(c.avgCompletion, 2)}%` }}
                      />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Alerts — compliance items due_soon/overdue */}
      {criticalAlerts.length > 0 && (
        <div id="owner-alerts">
          <h2 className="mb-2 text-lg font-semibold text-foreground md:text-xl">
            Alertas
            <span className="ml-2 text-sm font-normal text-muted-foreground">(Alerts)</span>
          </h2>
          <div className="flex flex-col gap-2">
            {criticalAlerts.map(a => (
              <div key={a.id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                a.type === 'critical'
                  ? 'border-red-500/30 bg-red-500/5'
                  : 'border-yellow-500/30 bg-yellow-500/5'
              }`}>
                <span className={`h-3 w-3 shrink-0 rounded-full ${
                  a.type === 'critical' ? 'bg-red-500' : 'bg-yellow-500'
                }`} />
                <span className="flex-1 text-sm text-foreground md:text-base">{a.title}</span>
                {a.countdown && (
                  <span className="text-xs font-medium text-muted-foreground md:text-sm">{a.countdown}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contract Detail Sheet */}
      <OwnerContractDetailSheet
        contract={selectedContractId ? allContracts.find(c => c.id === selectedContractId) ?? null : null}
        contractUnits={
          selectedContractId
            ? (units?.filter(u => u.contract_id === selectedContractId) || []).map(u => ({
                id: u.id,
                name: u.name,
                status: u.status,
              }))
            : []
        }
        open={!!selectedContractId}
        onOpenChange={(open) => { if (!open) setSelectedContractId(null) }}
      />
    </div>
  )
}

function OwnerMessages() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8">
      <h2 className="mb-6 text-2xl font-semibold text-foreground md:text-3xl">
        Mensajes
        <span className="ml-3 text-lg font-normal text-muted-foreground">(Messages)</span>
      </h2>
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Phone className="mb-4 h-14 w-14 text-muted-foreground/40" />
        <div className="text-xl text-muted-foreground">No hay mensajes nuevos</div>
        <div className="mt-2 text-base text-muted-foreground">
          Los mensajes de los capataces apareceran aqui
        </div>
      </div>
    </div>
  )
}

function OwnerContactsPage() {
  const { data: dbContracts } = useContracts()
  const [allContacts, setAllContacts] = useState<{ id: string; name: string; title: string; email: string; phone: string; contract_id: string; contract_name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data } = await supabase
        .from('contract_contacts')
        .select('id, name, title, email, phone, contract_id')
        .order('name')
      if (data && dbContracts) {
        const contractMap = new Map(dbContracts.map(c => [c.id, c.name]))
        setAllContacts(data.map(c => ({ ...c, contract_name: contractMap.get(c.contract_id) || '' })))
      }
      setLoading(false)
    })()
  }, [dbContracts])

  const contractGroups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>()
    for (const c of allContacts) {
      const existing = map.get(c.contract_id)
      if (existing) existing.count++
      else map.set(c.contract_id, { id: c.contract_id, name: c.contract_name, count: 1 })
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [allContacts])

  const filteredContacts = filter === 'all' ? allContacts : allContacts.filter(c => c.contract_id === filter)

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">
          Contactos
          <span className="ml-3 text-lg font-normal text-muted-foreground">(Contacts)</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todos los contactos de sus proyectos
          <span className="ml-1 text-xs">(All contacts from your projects)</span>
        </p>
      </div>
      {contractGroups.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setFilter('all')} className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${filter === 'all' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
            Todos <span className="font-mono text-xs ml-0.5">{allContacts.length}</span>
          </button>
          {contractGroups.map(g => (
            <button key={g.id} onClick={() => setFilter(filter === g.id ? 'all' : g.id)} className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${filter === g.id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              {g.name} <span className="font-mono text-xs ml-0.5">{g.count}</span>
            </button>
          ))}
        </div>
      )}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-3 text-lg text-muted-foreground">Cargando contactos...</span>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 py-12 text-center text-lg text-muted-foreground">
          No hay contactos todavia
          <span className="block text-sm mt-1">(Contacts are added via the Projects page)</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
          {filteredContacts.map(contact => (
            <div key={contact.id} className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-base font-semibold text-primary">
                {contact.name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                <span className="text-lg font-medium text-foreground truncate">{contact.name}</span>
                {contact.title && <span className="text-sm text-muted-foreground">{contact.title}</span>}
                <span className="text-xs text-primary/70 mt-0.5">{contact.contract_name}</span>
                <div className="mt-2 flex flex-col gap-1">
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-base text-primary hover:underline" style={{ minHeight: '44px' }}>
                      <Phone className="h-4 w-4 flex-shrink-0" /> {contact.phone}
                    </a>
                  )}
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:underline truncate">
                      {contact.email}
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function OwnerHelp() {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border bg-card p-8">
        <h2 className="mb-6 text-2xl font-semibold text-foreground md:text-3xl">
          Ayuda
          <span className="ml-3 text-lg font-normal text-muted-foreground">(Help)</span>
        </h2>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 rounded-xl bg-elevated p-5">
            <Globe className="h-6 w-6 text-primary" />
            <div>
              <div className="text-xl font-medium text-foreground">Idioma (Language)</div>
              <div className="mt-1 text-lg text-muted-foreground">Espanol / English</div>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl bg-elevated p-5">
            <Phone className="h-6 w-6 text-primary" />
            <div>
              <div className="text-xl font-medium text-foreground">Contacto (Contact)</div>
              <div className="mt-1 text-lg text-muted-foreground">Jaime — Administrador</div>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl bg-elevated p-5">
            <HelpCircle className="h-6 w-6 text-primary" />
            <div>
              <div className="text-xl font-medium text-foreground">Soporte (Support)</div>
              <div className="mt-1 text-lg text-muted-foreground">support@cascadiaops.com</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Foreman View ---
const UNIT_STATUS_SORT: Record<string, number> = { not_started: 0, pending: 0, in_progress: 1, completed: 2 }

// ─── Favorites (localStorage) ────────────────────────────────────────────────
function useFavoriteContracts(employeeId?: string | null) {
  const [favorites, setFavorites] = useState<string[]>([])
  const supabaseFav = useMemo(() => createClient(), [])

  // Load from DB if we have an employee ID, otherwise localStorage fallback
  useEffect(() => {
    if (employeeId) {
      supabaseFav.from('foreman_favorites').select('contract_id').eq('employee_id', employeeId)
        .then(({ data }: { data: unknown }) => {
          if (data) setFavorites((data as Array<{ contract_id: string }>).map(r => r.contract_id))
        })
    } else {
      // Fallback to localStorage for non-authenticated or admin testing
      try { setFavorites(JSON.parse(localStorage.getItem('foreman_favorite_contracts') || '[]')) } catch { /* empty */ }
    }
  }, [employeeId, supabaseFav])

  const toggle = useCallback((contractId: string) => {
    setFavorites(prev => {
      const isFav = prev.includes(contractId)
      const next = isFav ? prev.filter(f => f !== contractId) : [...prev, contractId]
      if (employeeId) {
        if (isFav) {
          supabaseFav.from('foreman_favorites').delete().eq('employee_id', employeeId).eq('contract_id', contractId).then(() => {})
        } else {
          supabaseFav.from('foreman_favorites').insert({ employee_id: employeeId, contract_id: contractId, added_by: 'self' } as never).then(() => {})
        }
      } else {
        localStorage.setItem('foreman_favorite_contracts', JSON.stringify(next))
      }
      return next
    })
  }, [employeeId, supabaseFav])

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites])
  return { favorites, toggle, isFavorite }
}

// ─── Foreman Overview (Landing Page) ──────────────────────────
// 4 action cards: Recent Timesheets, Submit Timesheet, My Crew, Crew Sets
function ForemanOverview() {
  const { setActivePage } = useApp()
  const { data: dbContracts } = useContracts()
  const { data: units } = useUnits()
  const { data: timesheets } = useTimesheetsWithDetails()
  const { data: crewSets } = useCrewSets()
  const { data: dbEmployees } = useEmployees()

  const activeContracts = useMemo(() =>
    dbContracts?.filter(c => c.status === 'active' || c.status === 'open') || [],
    [dbContracts]
  )

  const inProgressUnits = useMemo(() =>
    units?.filter(u => u.status === 'in_progress').length || 0,
    [units]
  )

  const recentTimesheets = useMemo(() =>
    (timesheets || []).slice(0, 3),
    [timesheets]
  )

  const crewCount = dbEmployees?.filter(e => !e.is_foreman && e.status === 'active').length || 0

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">Overview</h2>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="font-mono text-2xl font-bold text-primary">{activeContracts.length}</div>
          <div className="text-[11px] text-muted-foreground">Active Projects</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="font-mono text-2xl font-bold text-blue-400">{inProgressUnits}</div>
          <div className="text-[11px] text-muted-foreground">Units In Progress</div>
        </div>
      </div>

      {/* 4 Action Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Recent Timesheets */}
        <button
          onClick={() => setActivePage('myContracts')}
          className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-colors hover:border-primary/40 hover:bg-primary/5 active:bg-primary/10"
          style={{ minHeight: '100px' }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">Timesheets</span>
          <span className="text-[10px] text-muted-foreground">
            {recentTimesheets.length > 0 ? `${recentTimesheets.length} recent` : 'View all'}
          </span>
        </button>

        {/* Submit Timesheet */}
        <button
          onClick={() => setActivePage('submitTimesheet')}
          className="flex flex-col items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4 text-center transition-colors hover:border-primary/60 hover:bg-primary/10 active:bg-primary/15"
          style={{ minHeight: '100px' }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-primary">Submit Timesheet</span>
          <span className="text-[10px] text-muted-foreground">New entry</span>
        </button>

        {/* My Crew */}
        <button
          onClick={() => setActivePage('myCrew')}
          className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-colors hover:border-primary/40 hover:bg-primary/5 active:bg-primary/10"
          style={{ minHeight: '100px' }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/15">
            <Users className="h-5 w-5 text-blue-400" />
          </div>
          <span className="text-sm font-semibold text-foreground">My Crew</span>
          <span className="text-[10px] text-muted-foreground">{crewCount} active</span>
        </button>

        {/* Maps */}
        <button
          onClick={() => setActivePage('files')}
          className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-colors hover:border-primary/40 hover:bg-primary/5 active:bg-primary/10"
          style={{ minHeight: '100px' }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15">
            <MapPin className="h-5 w-5 text-amber-400" />
          </div>
          <span className="text-sm font-semibold text-foreground">Maps & Files</span>
          <span className="text-[10px] text-muted-foreground">Project docs</span>
        </button>
      </div>

      {/* My Favorites */}
      <ForemanFavorites />
    </div>
  )
}

// ─── Foreman Favorites Widget (Overview) ──────────────────────────────────

function ForemanFavorites() {
  const { setActivePage } = useApp()
  const { profile } = useAuth()
  const { data: dbContracts } = useContracts()
  const { data: units } = useUnits()
  const { favorites } = useFavoriteContracts(profile?.id)

  const favoriteContracts = useMemo(() =>
    (dbContracts || []).filter(c => favorites.includes(c.id)),
    [dbContracts, favorites]
  )

  if (favoriteContracts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/50 p-4 text-center">
        <Star className="mx-auto mb-2 h-6 w-6 text-amber-400/40" />
        <p className="text-sm text-muted-foreground">No favorite projects yet</p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Go to <button onClick={() => setActivePage('myContracts')} className="text-primary hover:underline">My Projects</button> and tap the star to add favorites
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">My Favorites</span>
        </div>
        <button
          onClick={() => setActivePage('myContracts')}
          className="text-[10px] font-medium text-primary hover:underline"
        >
          View all
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {favoriteContracts.map(c => {
          const contractUnits = units?.filter(u => u.contract_id === c.id) || []
          const completed = contractUnits.filter(u => u.status === 'completed').length
          const total = contractUnits.length
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0
          return (
            <button
              key={c.id}
              onClick={() => setActivePage('myContracts')}
              className="flex items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-elevated/50"
            >
              <Star className="h-3.5 w-3.5 flex-shrink-0 text-amber-400 fill-amber-400" />
              <span className="flex-1 truncate text-sm text-foreground">{c.name}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{completed}/{total}</span>
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Foreman Contract Detail ───────────────────────────────────────────────

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

type DriveFileItem = { id: string; name: string; mimeType: string; size: number; createdTime: string; webViewLink: string }

function ForemanDriveView({ rootFolderId }: { rootFolderId: string }) {
  type Crumb = { id: string; name: string }
  const [breadcrumbs, setBreadcrumbs] = useState<Crumb[]>([{ id: rootFolderId, name: 'Files' }])
  const [files, setFiles] = useState<DriveFileItem[]>([])
  const [loading, setLoading] = useState(true)

  const currentId = breadcrumbs[breadcrumbs.length - 1].id

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/drive/list?folderId=${currentId}`)
      .then(r => r.json())
      .then(j => { if (!cancelled) setFiles(j.files ?? []) })
      .catch(() => { if (!cancelled) setFiles([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [currentId])

  const folders = files.filter(f => f.mimeType === FOLDER_MIME_TYPE)
  const docs = files.filter(f => f.mimeType !== FOLDER_MIME_TYPE)

  return (
    <div className="flex flex-col gap-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 flex-wrap">
        {breadcrumbs.map((crumb, i) => (
          <div key={crumb.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            <button
              onClick={() => setBreadcrumbs(prev => prev.slice(0, i + 1))}
              className={`text-xs rounded px-1.5 py-0.5 transition-colors ${i === breadcrumbs.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            >
              {i === 0 ? <span className="flex items-center gap-1"><Home className="h-3 w-3" />{crumb.name}</span> : crumb.name}
            </button>
          </div>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
          <FolderOpen className="h-8 w-8 text-muted-foreground/40" />
          <div className="text-sm text-muted-foreground">No files here yet</div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {[...folders, ...docs].map(f => (
            <div key={f.id} className="flex items-center gap-3 rounded-lg border border-border bg-elevated/50 px-4 py-2.5">
              {f.mimeType === FOLDER_MIME_TYPE
                ? <Folder className="h-5 w-5 flex-shrink-0 text-yellow-400" />
                : <FileText className="h-5 w-5 flex-shrink-0 text-primary/70" />}
              <span className="flex-1 text-sm text-foreground truncate">{f.name}</span>
              {f.mimeType === FOLDER_MIME_TYPE ? (
                <button
                  onClick={() => setBreadcrumbs(prev => [...prev, { id: f.id, name: f.name }])}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  Open <ChevronRight className="h-3 w-3" />
                </button>
              ) : (
                <a
                  href={f.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-primary hover:bg-primary/10 transition-colors"
                >
                  Open <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ForemanContractDetail({ contract, units, onBack, onSubmitTimesheet }: {
  contract: { id: string; name: string; landowner: string | null; location: string | null; start_date: string | null; end_date: string | null; work_types: string[]; notes: string | null; drive_folder_everyone_id: string | null; status: string }
  units: { id: string; name: string; status: string; work_type: string | null }[]
  onBack: () => void
  onSubmitTimesheet: () => void
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'units' | 'files' | 'notes'>('overview')
  const hasUnits = units.length > 0
  const completed = units.filter(u => u.status === 'completed').length
  const inProgress = units.filter(u => u.status === 'in_progress').length
  const notStarted = units.filter(u => u.status === 'not_started').length

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'units', label: `Units (${units.length})` },
    { key: 'files', label: 'Files' },
    { key: 'notes', label: 'Notes' },
  ] as const

  return (
    <div className="flex flex-col gap-0">
      {/* Back header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" /> My Projects
        </button>
      </div>

      {/* Contract name + actions */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <TreePine className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{contract.name}</h2>
          </div>
          {(contract.landowner || contract.location) && (
            <p className="mt-0.5 text-xs text-muted-foreground ml-7">{[contract.landowner, contract.location].filter(Boolean).join(' · ')}</p>
          )}
        </div>
        <button
          onClick={onSubmitTimesheet}
          disabled={!hasUnits}
          className={`flex-shrink-0 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${hasUnits ? 'border-primary/40 text-primary hover:bg-primary/10' : 'border-border text-muted-foreground cursor-not-allowed opacity-50'}`}
          style={{ minHeight: '36px' }}
        >
          Submit Timesheet <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border mb-4">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${activeTab === t.key ? 'border-primary text-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            {contract.start_date && (
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Start Date</div>
                <div className="text-sm font-medium text-foreground">{new Date(contract.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
            )}
            {contract.end_date && (
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">End Date</div>
                <div className="text-sm font-medium text-foreground">{new Date(contract.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
            )}
          </div>
          {contract.work_types?.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Work Types</div>
              <div className="flex flex-wrap gap-1.5">
                {contract.work_types.map(wt => (
                  <span key={wt} className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary">{wt}</span>
                ))}
              </div>
            </div>
          )}
          {hasUnits && (
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Unit Progress</div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((completed / units.length) * 100)}%` }} />
              </div>
              <div className="mt-1.5 flex gap-3 text-xs text-muted-foreground">
                <span className="text-primary">{completed} completed</span>
                {inProgress > 0 && <span className="text-blue-400">{inProgress} in progress</span>}
                {notStarted > 0 && <span>{notStarted} not started</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'units' && (
        <div className="flex flex-col gap-1.5">
          {units.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No units configured</div>
          ) : units.map(u => {
            const statusColor = u.status === 'completed' ? 'bg-primary' : u.status === 'in_progress' ? 'bg-info' : 'bg-muted-foreground/50'
            const statusLabel = u.status === 'completed' ? 'Done' : u.status === 'in_progress' ? 'In Progress' : 'Not Started'
            return (
              <div key={u.id} className="flex items-center gap-2 rounded-lg border border-border bg-elevated/50 px-3 py-2.5 text-xs">
                <div className={`h-2 w-2 flex-shrink-0 rounded-full ${statusColor}`} />
                <span className="flex-1 font-medium text-foreground truncate">{u.name}</span>
                {u.work_type && <span className="text-muted-foreground">{u.work_type}</span>}
                <span className={`${u.status === 'completed' ? 'text-primary' : u.status === 'in_progress' ? 'text-info' : 'text-muted-foreground'}`}>{statusLabel}</span>
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'files' && (
        <div>
          {contract.drive_folder_everyone_id ? (
            <ForemanDriveView rootFolderId={contract.drive_folder_everyone_id} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <FolderOpen className="h-8 w-8 text-muted-foreground/40" />
              <div className="text-sm text-muted-foreground">Files not yet set up for this project</div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'notes' && (
        <div>
          {contract.notes ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <StickyNote className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-400">Project Notes</span>
              </div>
              <p className="text-sm text-foreground/90 whitespace-pre-line">{contract.notes}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <StickyNote className="h-8 w-8 text-muted-foreground/40" />
              <div className="text-sm text-muted-foreground">No notes for this project</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ForemanMyContracts() {
  const { setActivePage, selectedContractId: contextContractId, setSelectedContractId: setContextContractId } = useApp()
  const [launchContractId, setLaunchContractId] = useState<string | null>(null)
  const [expandedContractId, setExpandedContractId] = useState<string | null>(null)
  const [selectedContractId, setSelectedContractId] = useState<string | null>(contextContractId || null)
  const { profile } = useAuth()
  const { data: dbContracts, loading } = useContracts()
  const { data: units } = useUnits()
  const { toggle: toggleFavorite, isFavorite } = useFavoriteContracts(profile?.id)

  // Consume context contract ID on mount (e.g. clicked from Units page)
  useEffect(() => {
    if (contextContractId) {
      setSelectedContractId(contextContractId)
      setContextContractId(null) // clear so returning later doesn't re-select
    }
  }, [contextContractId, setContextContractId])

  const contractsWithProgress = useMemo(() => {
    if (!dbContracts) return []
    // Show all field-related contracts (hide office/shop/sick/non-field items)
    const NON_FIELD_NAMES = ['shop', 'sick', 'office', 'pto', 'vacation', 'holiday']
    return dbContracts
      .filter(c => !NON_FIELD_NAMES.some(term => c.name.toLowerCase().includes(term)))
      .map(c => {
        const contractUnits = (units?.filter(u => u.contract_id === c.id) || [])
          .sort((a, b) => (UNIT_STATUS_SORT[a.status] ?? 1) - (UNIT_STATUS_SORT[b.status] ?? 1))
        const completedUnits = contractUnits.filter(u => u.status === 'completed').length
        const totalUnits = contractUnits.length
        const inProgressUnits = contractUnits.filter(u => u.status === 'in_progress').length
        const avgCompletion = totalUnits > 0
          ? Math.round((completedUnits / totalUnits) * 100)
          : 0
        return { ...c, contractUnits, completedUnits, totalUnits, inProgressUnits, avgCompletion }
      })
      // Sort: active/open first, then in-progress units, then completion % ascending
      .sort((a, b) => {
        const aActive = a.status === 'active' || a.status === 'open' ? 0 : 1
        const bActive = b.status === 'active' || b.status === 'open' ? 0 : 1
        if (aActive !== bActive) return aActive - bActive
        if (a.inProgressUnits > 0 && b.inProgressUnits === 0) return -1
        if (a.inProgressUnits === 0 && b.inProgressUnits > 0) return 1
        return a.avgCompletion - b.avgCompletion
      })
  }, [dbContracts, units])

  // If a contract detail is open, render it
  if (selectedContractId) {
    const contract = contractsWithProgress.find(c => c.id === selectedContractId)
    const contractUnits = contract?.contractUnits || []
    if (contract) {
      return (
        <ForemanContractDetail
          contract={contract}
          units={contractUnits}
          onBack={() => setSelectedContractId(null)}
          onSubmitTimesheet={() => {
            setSelectedContractId(null)
            setLaunchContractId(selectedContractId)
          }}
        />
      )
    }
  }

  // If a contract was selected, render the timesheet page directly with the contract pre-selected
  if (launchContractId) {
    return (
      <ForemanTimesheetPage
        onNavigate={(page) => {
          setLaunchContractId(null)
          setActivePage(page)
        }}
        initialContractId={launchContractId}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading projects...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold text-foreground">My Projects</h2>
      {contractsWithProgress.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card/50 px-4 py-12 text-center text-sm text-muted-foreground">
          No projects found
        </div>
      )}
      {contractsWithProgress.map(c => {
        const hasUnits = c.totalUnits > 0
        const isExpanded = expandedContractId === c.id
        const notStarted = c.contractUnits.filter(u => u.status === 'not_started').length
        const inProg = c.contractUnits.filter(u => u.status === 'in_progress').length
        return (
          <div key={c.id} className="hover-card-lift rounded-lg border border-border bg-card p-4">
            {/* Row 1: Favorite star + Name + units count */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(c.id) }}
                  className="flex-shrink-0 rounded p-0.5 transition-colors hover:bg-muted"
                  title={isFavorite(c.id) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star className={`h-4 w-4 ${isFavorite(c.id) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/40'}`} />
                </button>
                <span className="font-semibold text-foreground truncate text-sm">{c.name}</span>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="font-mono text-sm text-foreground whitespace-nowrap">{c.completedUnits}/{c.totalUnits} <span className="text-xs text-muted-foreground">units</span></div>
              </div>
            </div>
            {/* Row 2: Work types + location + end date */}
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {c.work_types?.map(wt => (
                <span key={wt} className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">{wt}</span>
              ))}
              <span className="truncate">{c.landowner || c.contract_type || ''}{c.location ? ` · ${c.location}` : ''}</span>
              {c.end_date && (
                <span className="whitespace-nowrap">· Ends {new Date(c.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              )}
            </div>
            {/* In-progress badge */}
            {inProg > 0 && (
              <div className="mt-1.5 flex items-center gap-1">
                <span className="inline-flex items-center gap-1 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  {inProg} in progress
                </span>
                {notStarted > 0 && (
                  <span className="text-[10px] text-muted-foreground">{notStarted} not started</span>
                )}
              </div>
            )}
            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary shimmer-bar" style={{ width: `${c.avgCompletion}%` }} />
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{c.avgCompletion}% complete</span>
                {!hasUnits && <span className="text-warning">No units configured</span>}
              </div>
            </div>

            {/* Notes (if any) */}
            {c.notes && (
              <div className="mt-3 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase text-amber-400 mb-0.5">Project Notes</div>
                <p className="text-xs text-foreground/80 whitespace-pre-line line-clamp-3">{c.notes}</p>
              </div>
            )}

            {/* Expandable units */}
            {hasUnits && (
              <div className="mt-3 border-t border-border pt-3">
                <button
                  onClick={() => setExpandedContractId(isExpanded ? null : c.id)}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  View Units
                  <span className="font-mono text-[10px]">
                    ({notStarted > 0 ? `${notStarted} not started` : ''}{notStarted > 0 && inProg > 0 ? ', ' : ''}{inProg > 0 ? `${inProg} in progress` : ''}{notStarted === 0 && inProg === 0 ? 'all completed' : ''})
                  </span>
                </button>
                {isExpanded && (
                  <div className="mt-2 max-h-[300px] overflow-y-auto flex flex-col gap-1.5">
                    {c.contractUnits.map(u => {
                      const statusColor = u.status === 'completed' ? 'bg-primary' : u.status === 'in_progress' ? 'bg-info' : 'bg-muted-foreground/50'
                      const statusLabel = u.status === 'completed' ? 'Done' : u.status === 'in_progress' ? 'In Progress' : 'Not Started'
                      return (
                        <div key={u.id} className="flex items-center gap-2 rounded-md bg-elevated/50 px-3 py-2 text-xs">
                          <div className={`h-2 w-2 rounded-full ${statusColor}`} />
                          <span className="font-medium text-foreground flex-1 truncate">{u.name}</span>
                          {u.work_type && <span className="text-[10px] text-muted-foreground">{u.work_type}</span>}
                          <span className={`text-[10px] ${u.status === 'completed' ? 'text-primary' : u.status === 'in_progress' ? 'text-info' : 'text-muted-foreground'}`}>
                            {statusLabel}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div className={`mt-3 flex items-center justify-between gap-2 ${!hasUnits ? 'border-t border-border pt-3' : ''}`}>
              <button
                type="button"
                onClick={() => setSelectedContractId(c.id)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
                style={{ minHeight: "36px" }}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                View Details
              </button>
              <button
                type="button"
                onClick={() => hasUnits && setLaunchContractId(c.id)}
                disabled={!hasUnits}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                  hasUnits
                    ? 'border-primary/40 text-primary hover:bg-primary/10'
                    : 'border-border text-muted-foreground cursor-not-allowed opacity-50'
                }`}
                style={{ minHeight: "36px" }}
                title={!hasUnits ? 'No units available for this project' : undefined}
              >
                Submit Timesheet
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ForemanSubmitTimesheetWrapper() {
  const { setActivePage } = useApp()
  return (
    <div className="relative">
      <div className="sticky top-0 z-10 mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center">
        <div className="text-sm font-semibold text-amber-300">Preview Only — Training in Progress</div>
        <div className="mt-0.5 text-xs text-amber-300/70">This is what timesheet submission will look like. Functionality will be enabled after training.</div>
      </div>
      <div className="pointer-events-none opacity-60">
        <ForemanTimesheetPage onNavigate={(page) => setActivePage(page)} />
      </div>
    </div>
  )
}

// ─── Foreman Timesheets (read-only view) ──────────────────────────────────
function ForemanTimesheets() {
  return <TimeSheetsPage />
}

// ─── Foreman Expenses Placeholder ─────────────────────────────────────────
function ForemanExpensesPlaceholder() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Expenses</h2>
        <p className="mt-1 text-xs text-muted-foreground">Expense tracking and accountability — coming soon.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
              <Receipt className="h-4.5 w-4.5 text-amber-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">My Expenses</div>
              <div className="text-[11px] text-muted-foreground">Credit card charges tied to your projects</div>
            </div>
          </div>
          <div className="rounded-lg border border-dashed border-border bg-muted/20 py-6 text-center text-xs text-muted-foreground">
            No expenses recorded yet
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
              <DollarSign className="h-4.5 w-4.5 text-blue-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Fuel & Mileage</div>
              <div className="text-[11px] text-muted-foreground">Gas receipts and drive-time reconciliation</div>
            </div>
          </div>
          <div className="rounded-lg border border-dashed border-border bg-muted/20 py-6 text-center text-xs text-muted-foreground">
            Tracking starts when expenses go live
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Building className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Hotels & Lodging</div>
              <div className="text-[11px] text-muted-foreground">Accommodation costs per project</div>
            </div>
          </div>
          <div className="rounded-lg border border-dashed border-border bg-muted/20 py-6 text-center text-xs text-muted-foreground">
            Coming soon
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10">
              <AlertTriangle className="h-4.5 w-4.5 text-red-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Equipment Purchases</div>
              <div className="text-[11px] text-muted-foreground">Tools, supplies, and gear receipts</div>
            </div>
          </div>
          <div className="rounded-lg border border-dashed border-border bg-muted/20 py-6 text-center text-xs text-muted-foreground">
            Coming soon
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300">
        Expense tracking is being built. Once live, all charges will be tracked and tied to your projects. Start keeping receipts organized now.
      </div>
    </div>
  )
}

function ForemanMyCrew() {
  const crew = employees.filter(e => e.role !== 'foreman')
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold text-foreground">My Crew</h2>
      <div className="grid grid-cols-2 gap-4">
        {crew.map(e => (
          <div key={e.id} className="hover-card-lift rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">{e.initials}</div>
              <div>
                <div className="font-medium text-foreground">{e.name}</div>
                <div className="text-xs text-muted-foreground">{e.role} - {e.company}</div>
              </div>
            </div>
            <div className="mt-3 flex gap-4 text-xs">
              <div><span className="text-muted-foreground">Hours:</span> <span className="font-mono text-foreground">{e.hoursThisWeek}h</span></div>
              <div><span className="text-muted-foreground">Rate:</span> <span className="font-mono text-foreground">${e.rate}/{e.rateType === 'hourly' ? 'hr' : 'day'}</span></div>
              {e.h2b && <span className="rounded-full bg-info/20 px-1.5 py-0.5 text-[10px] text-info">H-2B</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ForemanWeather() {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold text-foreground">Weather</h2>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
          <Snowflake className="h-4 w-4 text-warning" />
          <span className="text-foreground">Frost Warning -- Cowlitz CO tomorrow AM, low 28 F</span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
          <Wind className="h-4 w-4 text-warning" />
          <span className="text-foreground">Wind Advisory -- Columbia CO Thu-Fri, gusts 25mph</span>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">5-day forecast coming soon. Check NOAA for current conditions.</div>
        </div>
      </div>
    </div>
  )
}

// --- Employee View ---
function EmployeeMyHours() {
  const weekData = [
    { day: 'Mon', hours: 8.0, drive: 1.5 },
    { day: 'Tue', hours: 7.5, drive: 1.5 },
    { day: 'Wed', hours: 8.0, drive: 1.5 },
    { day: 'Thu', hours: 7.8, drive: 1.5 },
    { day: 'Fri', hours: 0, drive: 0 },
    { day: 'Sat', hours: 0, drive: 0 },
  ]
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold text-foreground">My Hours</h2>
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">This Week</div>
          <div className="mt-1 font-mono text-2xl font-bold text-foreground">31.3h</div>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Drive Hours</div>
          <div className="mt-1 font-mono text-2xl font-bold text-foreground">6.0h</div>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">OT This Week</div>
          <div className="mt-1 font-mono text-2xl font-bold text-primary">0h</div>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">Day</th>
              <th className="px-4 py-2 text-right font-medium">Work Hours</th>
              <th className="px-4 py-2 text-right font-medium">Drive Hours</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {weekData.map(d => (
              <tr key={d.day} className="border-b border-border">
                <td className="px-4 py-2.5 text-foreground">{d.day}</td>
                <td className="px-4 py-2.5 text-right font-mono text-foreground">{d.hours > 0 ? `${d.hours}h` : '--'}</td>
                <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{d.drive > 0 ? `${d.drive}h` : '--'}</td>
                <td className="px-4 py-2.5 text-right font-mono text-foreground">{d.hours > 0 ? `${(d.hours + d.drive).toFixed(1)}h` : '--'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EmployeeProfile() {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold text-foreground">My Profile</h2>
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">MP</div>
          <div>
            <div className="text-lg font-semibold text-foreground">Marco Perez</div>
            <div className="text-sm text-muted-foreground">Crew Member - Cascadia Forestry Inc.</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-full bg-info/20 px-2 py-0.5 text-xs text-info">H-2B</span>
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary">Active</span>
            </div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-muted-foreground">Rate:</span> <span className="font-mono text-foreground">$22.00/hr</span></div>
          <div><span className="text-muted-foreground">Company:</span> <span className="text-foreground">Cascadia</span></div>
          <div><span className="text-muted-foreground">Start Date:</span> <span className="text-foreground">Oct 15, 2025</span></div>
          <div><span className="text-muted-foreground">Assigned Project:</span> <span className="text-foreground">Vanessa</span></div>
        </div>
      </div>
    </div>
  )
}

function EmployeeDocuments() {
  const docs = [
    { name: 'Herbicide License', exp: 'Feb 28, 2026', status: 'EXPIRING', days: 7 },
    { name: "Driver's License", exp: 'Apr 15, 2026', status: 'Current', days: 53 },
    { name: 'CPR Certification', exp: 'Jun 1, 2026', status: 'Current', days: 100 },
  ]
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold text-foreground">My Documents & Certifications</h2>
      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">Document</th>
              <th className="px-4 py-2 text-left font-medium">Expiration</th>
              <th className="px-4 py-2 text-center font-medium">Days Left</th>
              <th className="px-4 py-2 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {docs.map(d => (
              <tr key={d.name} className="border-b border-border">
                <td className="px-4 py-3 text-foreground">{d.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.exp}</td>
                <td className="px-4 py-3 text-center font-mono text-foreground">{d.days}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    d.status === 'EXPIRING' ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary'
                  }`}>{d.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EmployeeNotifications() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
      <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <span className="text-sm text-foreground">Your Herbicide License expires in 7 days. Please renew immediately.</span>
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-info/30 bg-info/5 p-4">
        <Bell className="h-4 w-4 text-info" />
        <span className="text-sm text-foreground">Frost warning tomorrow morning - dress warmly.</span>
      </div>
    </div>
  )
}

// --- Profile / Settings (shared by Foreman + Owner roles) ---
function ProfileSettings() {
  const { language, setLanguage, role } = useApp()
  const { profile } = useAuth()
  const { data: dbEmployees, loading } = useEmployees()

  // Try to find matching employee record for richer profile data
  const employeeRecord = useMemo(() => {
    if (!dbEmployees || !profile) return null
    // Match by auth profile email or name
    return dbEmployees.find(e => {
      if (profile.email && e.email && e.email.toLowerCase() === profile.email.toLowerCase()) return true
      if (profile.name) {
        const fullName = `${e.first_name} ${e.last_name}`.toLowerCase()
        if (fullName === profile.name.toLowerCase()) return true
      }
      return false
    }) || null
  }, [dbEmployees, profile])

  // For foreman role, fall back to finding any foreman record if no auth match
  const foremanFallback = useMemo(() => {
    if (employeeRecord || role !== 'foreman' || !dbEmployees) return null
    return dbEmployees.find(e => e.is_foreman) || null
  }, [dbEmployees, employeeRecord, role])

  const matchedEmployee = employeeRecord || foremanFallback

  // Profile photo upload
  const { photoUrl, uploading, error: photoError, fileInputRef, openFilePicker, onFileChange } =
    useProfilePhoto(matchedEmployee?.id || profile?.id || null)

  // Derive display values from auth profile first, then employee record
  const displayName = profile?.name || (matchedEmployee ? `${matchedEmployee.first_name} ${matchedEmployee.last_name}` : (role === 'owner' ? 'Owner' : 'User'))
  const displayEmail = profile?.email || matchedEmployee?.email || ''
  const displayRole = role === 'owner' ? 'Owner' : role === 'foreman' ? 'Foreman' : (profile?.role || role)
  const displayRoleEs = role === 'owner' ? 'Propietario' : role === 'foreman' ? 'Capataz' : displayRole

  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??'

  const companyName = (profile?.company_id || matchedEmployee?.company_id) === '00000000-0000-0000-0000-000000000001' ? 'Cascadia'
    : (profile?.company_id || matchedEmployee?.company_id) === '00000000-0000-0000-0000-000000000002' ? 'Ramos'
    : 'N/A'

  const isSpanishFirst = role === 'owner'

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold text-foreground">
        {isSpanishFirst ? 'Mi Perfil' : 'My Profile'}
        {isSpanishFirst && <span className="ml-2 text-sm font-normal text-muted-foreground">(My Profile)</span>}
      </h2>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">
            {isSpanishFirst ? 'Cargando perfil...' : 'Loading profile...'}
          </span>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-6">
          {/* Hidden file input for photo upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onFileChange}
          />
          <div className="flex items-center gap-4">
            {/* Circular avatar with click-to-change */}
            <button
              type="button"
              onClick={openFilePicker}
              disabled={uploading}
              className="group relative h-16 w-16 shrink-0 cursor-pointer rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
              title={isSpanishFirst ? 'Cambiar foto' : 'Change photo'}
              style={{ minHeight: '48px', minWidth: '48px' }}
            >
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={displayName}
                  className="h-16 w-16 rounded-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden') }}
                />
              ) : null}
              <div className={`flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground ${photoUrl ? 'hidden' : ''}`}>
                {initials !== '??' ? initials : <User className="h-7 w-7" />}
              </div>
              {/* Hover overlay with camera icon */}
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </div>
              {/* Loading overlay (always visible when uploading) */}
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                </div>
              )}
            </button>
            <div>
              <div className="text-lg font-semibold text-foreground">{displayName}</div>
              <div className="text-sm text-muted-foreground">
                {isSpanishFirst ? `${displayRoleEs} (${displayRole})` : displayRole}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary">
                  {isSpanishFirst ? 'Activo' : 'Active'}
                </span>
                {matchedEmployee?.is_h2b && (
                  <span className="rounded-full bg-info/20 px-2 py-0.5 text-xs text-info">H-2B</span>
                )}
              </div>
              {photoError && (
                <div className="mt-1 text-xs text-destructive">{photoError}</div>
              )}
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
            {matchedEmployee?.phone && (
              <div>
                <span className="text-muted-foreground">{isSpanishFirst ? 'Telefono:' : 'Phone:'}</span>{' '}
                <span className="text-foreground">{matchedEmployee.phone}</span>
              </div>
            )}
            {displayEmail && (
              <div>
                <span className="text-muted-foreground">{isSpanishFirst ? 'Correo:' : 'Email:'}</span>{' '}
                <span className="text-foreground">{displayEmail}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">{isSpanishFirst ? 'Empresa:' : 'Company:'}</span>{' '}
              <span className="text-foreground">{companyName}</span>
            </div>
            {matchedEmployee?.hire_date && (
              <div>
                <span className="text-muted-foreground">{isSpanishFirst ? 'Fecha de Inicio:' : 'Start Date:'}</span>{' '}
                <span className="text-foreground">
                  {new Date(matchedEmployee.hire_date + 'T00:00:00').toLocaleDateString(
                    isSpanishFirst ? 'es-MX' : 'en-US',
                    { month: 'short', day: 'numeric', year: 'numeric' }
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Language Preference */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          {isSpanishFirst ? 'Idioma / Language' : 'Language / Idioma'}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLanguage('en')}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              language === 'en'
                ? 'bg-primary text-primary-foreground'
                : 'border border-border text-muted-foreground hover:bg-elevated hover:text-foreground'
            }`}
            style={{ minHeight: '44px' }}
          >
            English
          </button>
          <button
            onClick={() => setLanguage('es')}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              language === 'es'
                ? 'bg-primary text-primary-foreground'
                : 'border border-border text-muted-foreground hover:bg-elevated hover:text-foreground'
            }`}
            style={{ minHeight: '44px' }}
          >
            Espanol
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Simple Placeholder for Office (same as Admin but read-only feel) ---
function GenericPlaceholder({ title, icon: Icon }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16 text-center">
      <Icon className="mb-3 h-10 w-10 text-muted-foreground/30" />
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">This view shares data with the admin module.</div>
    </div>
  )
}

// --- Dispatcher ---
export function RolePageRouter({ page }: { page: string }) {
  const { role } = useApp()

  // Owner views
  if (role === 'owner') {
    switch (page) {
      case 'overview': return <OwnerOverview />
      case 'contracts': return <ContractsPage />
      case 'contacts': return <ContactsPage />
      case 'expenses': return <ExpensesPage />
      case 'analytics': return <AnalyticsPage />
      case 'workTracker': return <WorkTrackerPage />
      case 'communications': return <CommunicationsPage />
      case 'messages': return <OwnerMessages />
      case 'settings': return <ProfileSettings />
      default: return <OwnerOverview />
    }
  }

  // Foreman views
  if (role === 'foreman') {
    switch (page) {
      case 'overview': return <ForemanOverview />
      case 'myContracts': return <ForemanMyContracts />
      // Cross-project units browser — same component as admin/office
      // (read-only via RLS), gives foremen fast search across every
      // project they're assigned to. Clicking a row sends them to
      // ForemanMyContracts with the contract pre-selected.
      case 'adminUnits': return <AdminUnitsPage />
      case 'timeSheets': return <ForemanTimesheets />
      case 'submitTimesheet': return <ForemanSubmitTimesheetWrapper />
      case 'files': return <FilesPage />
      case 'communications': return <CommunicationsPage />
      case 'expenses': return <ForemanExpensesPlaceholder />
      case 'myCrew': return <ForemanMyCrew />
      case 'crewSets': return <CrewSetsPage />
      case 'calendar': return <GenericPlaceholder title="Calendar" icon={CalendarDays} />
      case 'weather': return <ForemanWeather />
      case 'vehicleStatus': return <GenericPlaceholder title="Vehicle Status" icon={Truck} />
      case 'myHours': return <EmployeeMyHours />
      case 'settings': return <ProfileSettings />
      default: return <ForemanOverview />
    }
  }

  // Employee views
  if (role === 'employee') {
    switch (page) {
      case 'myHours': return <EmployeeMyHours />
      case 'myProfile': return <EmployeeProfile />
      case 'myDocuments': return <EmployeeDocuments />
      default: return <EmployeeMyHours />
    }
  }

  // Fallback: return null and let admin router handle
  return null
}
