"use client"

import { useState, useMemo, useRef } from 'react'
import { Search, AlertTriangle, X, Loader2, Pencil, UserPlus } from 'lucide-react'
import { useEmployees, useCompanies } from '@/hooks/use-supabase'
import { useApp } from '@/lib/app-context'
import { CASCADIA_ID, RAMOS_ID } from '@/lib/database.types'
import { nowForDemo } from '@/lib/demo-mode'
import type { Employee } from '@/lib/database.types'
import { EditEmployeeSheet } from './edit-employee-sheet'
import { AddEmployeeSheet } from './add-employee-sheet'

const roleColors: Record<string, string> = {
  foreman: 'bg-primary text-primary-foreground',
  office: 'bg-amber-600 text-white',
  driver: 'bg-info text-foreground',
  crew: 'bg-muted text-muted-foreground',
}

const avatarColors: Record<string, string> = {
  foreman: 'bg-primary text-primary-foreground',
  office: 'bg-amber-600/20 text-amber-500',
  driver: 'bg-info text-foreground',
  crew: 'bg-muted-foreground/20 text-muted-foreground',
}

// ─── Filter Types ───────────────────────────────────────

type CrewFilter = 'all' | 'foreman' | 'office' | 'driver' | 'h2b'

const FILTER_OPTIONS: { key: CrewFilter; label: string }[] = [
  { key: 'all', label: 'All Crew' },
  { key: 'foreman', label: 'Foremen' },
  { key: 'office', label: 'Office' },
  { key: 'driver', label: 'Drivers' },
  { key: 'h2b', label: 'H2B' },
]

function getRole(emp: Employee): 'foreman' | 'office' | 'driver' | 'crew' {
  if (emp.is_foreman) return 'foreman'
  if (emp.is_office) return 'office'
  if (emp.is_driver) return 'driver'
  return 'crew'
}

function getInitials(emp: Employee): string {
  return `${emp.first_name.charAt(0)}${emp.last_name.charAt(0)}`.toUpperCase()
}

function getFullName(emp: Employee): string {
  return `${emp.first_name} ${emp.last_name}`
}

function companyAuthLabel(auth: string): string {
  if (auth === 'cascadia') return 'Cascadia'
  if (auth === 'ramos') return 'Ramos'
  return 'Both'
}

function getRate(emp: Employee): { value: number; type: string } {
  if (emp.rate_type === 'daily' && emp.daily_rate) return { value: emp.daily_rate, type: 'day' }
  return { value: emp.rate || 0, type: 'hr' }
}

// ─── Crew Card ──────────────────────────────────────────

function CrewCard({ emp, onSelect, hideFinancials }: { emp: Employee; onSelect: () => void; hideFinancials?: boolean }) {
  const role = getRole(emp)
  const rate = getRate(emp)

  return (
    <button onClick={onSelect} className="hover-card-lift w-full rounded-lg border border-border bg-card p-4 text-left transition-all">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${avatarColors[role]}`}>
          {getInitials(emp)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground">{getFullName(emp)}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${roleColors[role]}`}>{role}</span>
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">{companyAuthLabel(emp.company_auth)}</span>
            {emp.is_h2b && <span className="rounded-full bg-purple/20 px-2 py-0.5 text-[10px] font-medium text-purple">H2B</span>}
          </div>
          {!hideFinancials && rate.value > 0 && (
            <div className="mt-2 font-mono text-xs text-warning">${rate.value.toFixed(2)}/{rate.type}</div>
          )}
          <div className="mt-1 text-[10px] text-muted-foreground capitalize">{emp.status}</div>
        </div>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${emp.status === 'active' ? 'bg-primary pulse-dot' : 'bg-muted-foreground/30'}`} />
      </div>
    </button>
  )
}

// ─── Detail Panel ───────────────────────────────────────

function CrewDetail({ emp, onClose, onEdit, hideFinancials }: { emp: Employee; onClose: () => void; onEdit: () => void; hideFinancials?: boolean }) {
  const role = getRole(emp)
  const rate = getRate(emp)

  // Build compliance-like data from expiration fields
  const expirations = [
    { item: 'Passport', expiration: emp.passport_exp },
    { item: 'Visa', expiration: emp.visa_exp },
    { item: "Driver's License", expiration: emp.dl_exp },
    { item: 'Drive Authorization', expiration: emp.drive_auth_exp },
    { item: 'CPR Cert', expiration: emp.cpr_exp },
    { item: 'Herbicide License', expiration: emp.herbicide_license_exp },
    { item: 'Fingerprints', expiration: emp.fingerprints_exp },
  ].filter(e => e.expiration)

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${avatarColors[role]}`}>
            {getInitials(emp)}
          </div>
          <div>
            <div className="font-medium text-foreground">{getFullName(emp)}</div>
            <div className="flex items-center gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${roleColors[role]}`}>{role}</span>
              <span className="text-[10px] text-muted-foreground">{companyAuthLabel(emp.company_auth)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="flex h-7 items-center gap-1 rounded-md border border-border bg-elevated px-2 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-card transition-colors">
            <Pencil className="h-3 w-3" /> Edit
          </button>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-elevated hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="p-4">
        {/* Contact Info */}
        {(emp.phone || emp.email) && (
          <>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</h4>
            <div className="mb-4 flex flex-col gap-1 text-xs">
              {emp.phone && <div><span className="text-muted-foreground">Phone:</span> <span className="text-foreground">{emp.phone}</span></div>}
              {emp.email && <div><span className="text-muted-foreground">Email:</span> <span className="text-foreground">{emp.email}</span></div>}
            </div>
          </>
        )}

        {/* Expirations */}
        {expirations.length > 0 && (
          <>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documents & Expirations</h4>
            <div className="flex flex-col gap-2">
              {expirations.map((e, i) => {
                const expDate = new Date(e.expiration!)
                const now = nowForDemo()
                const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                const isExpiring = daysLeft <= 30
                const isExpired = daysLeft <= 0

                return (
                  <div key={i} className="flex items-center justify-between rounded-md bg-elevated/50 px-3 py-2">
                    <span className="text-xs text-foreground">{e.item}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{e.expiration}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        isExpired ? 'bg-destructive/20 text-destructive' :
                        isExpiring ? 'bg-warning/20 text-warning' :
                        'bg-primary/20 text-primary'
                      }`}>
                        {isExpired ? 'Expired' : `${daysLeft}d`}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {!hideFinancials && (
          <>
            <h4 className="mb-3 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payroll Summary</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-elevated/50 px-3 py-2">
                <div className="text-[10px] text-muted-foreground">Rate</div>
                <div className="font-mono text-sm font-semibold text-foreground">
                  {rate.value > 0 ? `$${rate.value.toFixed(2)}/${rate.type}` : 'N/A'}
                </div>
              </div>
              <div className="rounded-md bg-elevated/50 px-3 py-2">
                <div className="text-[10px] text-muted-foreground">Status</div>
                <div className="text-sm font-semibold text-foreground capitalize">{emp.status}</div>
              </div>
            </div>
          </>
        )}
        {hideFinancials && (
          <div className="grid grid-cols-1 gap-3 mt-5">
            <div className="rounded-md bg-elevated/50 px-3 py-2">
              <div className="text-[10px] text-muted-foreground">Status</div>
              <div className="text-sm font-semibold text-foreground capitalize">{emp.status}</div>
            </div>
          </div>
        )}

        {emp.notes && (
          <>
            <h4 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</h4>
            <div className="text-xs text-muted-foreground">{emp.notes}</div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────

export function CrewPage() {
  const { company, role } = useApp()
  const hideFinancials = role === 'office' || role === 'foreman'
  const { data: employees, loading, error } = useEmployees()
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [filter, setFilter] = useState<CrewFilter>('all')
  const alertsRef = useRef<HTMLDivElement>(null)

  // Filter by company toggle
  const companyFiltered = useMemo(() => {
    if (!employees) return []
    if (company === 'cascadia') return employees.filter(e => e.company_auth === 'cascadia' || e.company_auth === 'both')
    if (company === 'ramos') return employees.filter(e => e.company_auth === 'ramos' || e.company_auth === 'both')
    return employees
  }, [employees, company])

  // Compute stats
  const activeEmployees = companyFiltered.filter(e => e.status === 'active')
  const totalCount = companyFiltered.length
  const activeCount = activeEmployees.length
  const h2bCount = companyFiltered.filter(e => e.is_h2b).length
  const driverCount = companyFiltered.filter(e => e.is_driver).length
  const foremanCount = companyFiltered.filter(e => e.is_foreman).length
  const officeCount = companyFiltered.filter(e => e.is_office).length

  // Apply role filter
  const filteredEmployees = useMemo(() => {
    switch (filter) {
      case 'foreman': return companyFiltered.filter(e => e.is_foreman)
      case 'office': return companyFiltered.filter(e => e.is_office)
      case 'driver': return companyFiltered.filter(e => e.is_driver)
      case 'h2b': return companyFiltered.filter(e => e.is_h2b)
      default: return companyFiltered
    }
  }, [companyFiltered, filter])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading crew...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load crew: {error}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Stats Strip */}
      <div className="flex items-center gap-6 rounded-lg border border-border bg-card px-4 py-2.5 text-xs">
        <div><span className="text-muted-foreground">Total:</span> <span className="font-mono font-medium text-foreground">{totalCount}</span></div>
        <div className="h-3 w-px bg-border" />
        <div><span className="text-muted-foreground">Active:</span> <span className="font-mono font-medium text-primary">{activeCount}</span></div>
        <div className="h-3 w-px bg-border" />
        <div><span className="text-muted-foreground">H2B:</span> <span className="font-mono font-medium text-purple">{h2bCount}</span></div>
        <div className="h-3 w-px bg-border" />
        <div><span className="text-muted-foreground">Drivers:</span> <span className="font-mono font-medium text-info">{driverCount}</span></div>
        <div className="h-3 w-px bg-border" />
        <div><span className="text-muted-foreground">Foremen:</span> <span className="font-mono font-medium text-foreground">{foremanCount}</span></div>
        <div className="h-3 w-px bg-border" />
        <div><span className="text-muted-foreground">Office:</span> <span className="font-mono font-medium text-amber-500">{officeCount}</span></div>
      </div>

      {/* Filter Row */}
      <div data-tour="crew-filters" className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === opt.key
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:bg-elevated hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search + Add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#2a3f5f] focus:outline-none" placeholder="Search crew..." />
        </div>
        <button
          onClick={() => setShowAddSheet(true)}
          className="flex h-9 items-center gap-1.5 rounded-md bg-green-600 px-3 text-sm font-medium text-white hover:bg-green-700 transition-colors shrink-0"
        >
          <UserPlus className="h-4 w-4" />
          Add Employee
        </button>
      </div>

      <div className="grid grid-cols-[1fr_400px] gap-5">
        {/* Cards Grid */}
        <div data-tour="crew-grid" className="grid grid-cols-2 gap-3">
          {filteredEmployees.length === 0 ? (
            <div className="col-span-2 flex items-center justify-center py-12 text-sm text-muted-foreground">
              No crew members found
            </div>
          ) : (
            filteredEmployees.map(emp => (
              <CrewCard key={emp.id} emp={emp} onSelect={() => setSelectedEmp(emp)} hideFinancials={hideFinancials} />
            ))
          )}
        </div>

        {/* Detail Panel */}
        {selectedEmp ? (
          <CrewDetail
            emp={selectedEmp}
            onClose={() => setSelectedEmp(null)}
            onEdit={() => {
              setEditingEmp(selectedEmp)
              setShowEditSheet(true)
            }}
            hideFinancials={hideFinancials}
          />
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-card/50 text-sm text-muted-foreground">
            Select a crew member to view details
          </div>
        )}
      </div>

      <EditEmployeeSheet
        employee={editingEmp}
        open={showEditSheet}
        onOpenChange={setShowEditSheet}
        onUpdated={() => setSelectedEmp(null)}
      />

      <AddEmployeeSheet
        open={showAddSheet}
        onOpenChange={setShowAddSheet}
        onCreated={() => setSelectedEmp(null)}
      />
    </div>
  )
}
