"use client"

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Search, Phone, Mail, Building, Loader2, Users, ChevronRight, FolderOpen, UserPlus, X, Pencil, Trash2 } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { useContracts } from '@/hooks/use-supabase'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'

const CONTACT_TITLE_OPTIONS = [
  'Contracting Officer', 'COR', 'Inspector', 'Field Technician',
  'CEO', 'Project Manager', 'Landowner Rep', 'Forester', 'Other',
]

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

type ContactWithContract = {
  id: string
  name: string
  title: string
  email: string
  phone: string
  contract_id: string
  contract_name: string
  landowner: string
}

export function ContactsPage() {
  const { t, role } = useApp()
  const isOwner = role === 'owner'
  const { data: dbContracts } = useContracts()
  const [allContacts, setAllContacts] = useState<ContactWithContract[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [landownerFilter, setLandownerFilter] = useState<string>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  // Add/Edit Contact form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formLandowner, setFormLandowner] = useState('')
  const [formContractId, setFormContractId] = useState('')
  const [saving, setSaving] = useState(false)

  const NON_PROJECT_CATEGORIES = ['Office', 'Admin', 'Misc']

  const supabase = useMemo(() => createClient(), [])

  const resetAddForm = useCallback(() => {
    setShowAddForm(false); setEditingId(null); setFormName(''); setFormTitle(''); setFormEmail(''); setFormPhone(''); setFormLandowner(''); setFormContractId('')
  }, [])

  const startEdit = useCallback((contact: ContactWithContract) => {
    setEditingId(contact.id)
    setFormName(contact.name)
    setFormTitle(contact.title || '')
    setFormEmail(contact.email || '')
    setFormPhone(contact.phone || '')
    // Set landowner/project from the contact's data
    if (contact.contract_id) {
      const contract = dbContracts?.find(c => c.id === contact.contract_id)
      setFormLandowner(contract?.landowner || 'Other')
      setFormContractId(contact.contract_id)
    } else {
      setFormLandowner(`_${contact.landowner}`)
      setFormContractId('')
    }
    setShowAddForm(true)
  }, [dbContracts])

  const fetchContacts = useCallback(async () => {
    const { data, error } = await supabase
      .from('contract_contacts')
      .select('id, name, title, email, phone, contract_id, category, deleted_at')
      .is('deleted_at', null)
      .order('name')
    if (error) {
      // Fallback if new columns don't exist yet
      const fallback = await supabase.from('contract_contacts').select('id, name, title, email, phone, contract_id').order('name')
      if (fallback.data && dbContracts) {
        const contractMap = new Map(dbContracts.map(c => [c.id, { name: c.name, landowner: c.landowner || 'Other' }]))
        setAllContacts(fallback.data.map(c => {
          if (!c.contract_id) return { ...c, contract_name: '', landowner: 'Misc' }
          const info = contractMap.get(c.contract_id) || { name: '', landowner: 'Other' }
          return { ...c, contract_name: info.name, landowner: info.landowner }
        }))
      }
      return
    }
    if (data && dbContracts) {
      const contractMap = new Map(dbContracts.map(c => [c.id, { name: c.name, landowner: c.landowner || 'Other' }]))
      setAllContacts(data.map((c: Record<string, unknown>) => {
        if (!c.contract_id) {
          return { ...c, contract_name: '', landowner: (c.category as string) || 'Misc' }
        }
        const info = contractMap.get(c.contract_id as string) || { name: '', landowner: 'Other' }
        return { ...c, contract_name: info.name, landowner: info.landowner }
      }) as ContactWithContract[])
    }
  }, [dbContracts, supabase])

  const handleAddContact = useCallback(async () => {
    if (!formName.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' }); return
    }
    const isMisc = formLandowner.startsWith('_')
    if (!isMisc && !formContractId) {
      toast({ title: 'Please select a landowner and project', variant: 'destructive' }); return
    }
    if (!isMisc && !formLandowner) {
      toast({ title: 'Please select a landowner', variant: 'destructive' }); return
    }
    const cleanTitle = formTitle === '_other' ? '' : formTitle.trim()
    const category = isMisc ? formLandowner.slice(1) : null // 'Office', 'Admin', 'Misc'
    setSaving(true)
    const insertData: Record<string, unknown> = {
      name: formName.trim(),
      title: cleanTitle,
      email: formEmail.trim(),
      phone: formPhone.trim(),
    }
    if (formContractId) insertData.contract_id = formContractId
    if (category) insertData.category = category
    let error: { message: string } | null = null
    if (editingId) {
      const res = await supabase.from('contract_contacts').update(insertData as never).eq('id', editingId)
      error = res.error
    } else {
      const res = await supabase.from('contract_contacts').insert(insertData as never)
      error = res.error
    }
    if (error) { toast({ title: editingId ? 'Failed to update contact' : 'Failed to add contact', description: error.message, variant: 'destructive' }); setSaving(false); return }
    toast({ title: editingId ? 'Contact updated' : 'Contact added' })
    resetAddForm()
    setSaving(false)
    fetchContacts()
  }, [formName, formTitle, formEmail, formPhone, formContractId, formLandowner, editingId, supabase, resetAddForm, fetchContacts])

  // Contracts grouped by landowner for the add form dropdown
  const contractsByLandowner = useMemo(() => {
    if (!dbContracts) return []
    const map = new Map<string, typeof dbContracts>()
    for (const c of dbContracts) {
      const lo = c.landowner || 'Other'
      if (!map.has(lo)) map.set(lo, [])
      map.get(lo)!.push(c)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [dbContracts])

  // Initial fetch
  useEffect(() => {
    if (dbContracts) { fetchContacts().then(() => setLoading(false)) }
  }, [dbContracts, fetchContacts])

  // Build landowner groups
  const landownerGroups = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of allContacts) {
      map.set(c.landowner, (map.get(c.landowner) || 0) + 1)
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [allContacts])

  // Build project groups within selected landowner
  const projectGroups = useMemo(() => {
    if (landownerFilter === 'all') return []
    const filtered = allContacts.filter(c => c.landowner === landownerFilter)
    const map = new Map<string, { id: string; name: string; count: number }>()
    for (const c of filtered) {
      const existing = map.get(c.contract_id)
      if (existing) existing.count++
      else map.set(c.contract_id, { id: c.contract_id, name: c.contract_name, count: 1 })
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [allContacts, landownerFilter])

  // Apply search + landowner/project filter
  const filteredContacts = useMemo(() => {
    let result = allContacts
    if (landownerFilter !== 'all') result = result.filter(c => c.landowner === landownerFilter)
    if (projectFilter !== 'all') result = result.filter(c => c.contract_id === projectFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.contract_name.toLowerCase().includes(q) ||
        c.landowner.toLowerCase().includes(q)
      )
    }
    return result
  }, [allContacts, landownerFilter, projectFilter, search])

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className={`font-bold text-foreground ${isOwner ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'}`}>
            {isOwner ? (
              <>Contactos <span className="ml-3 text-lg font-normal text-muted-foreground">(Contacts)</span></>
            ) : (
              t('contacts')
            )}
          </h1>
          <p className={`mt-1 text-muted-foreground ${isOwner ? 'text-sm' : 'text-xs'}`}>
            {isOwner ? (
              <>Todos los contactos de sus proyectos <span className="ml-1 text-xs">(All contacts from your projects)</span></>
            ) : (
              <>All contacts across your projects</>
            )}
          </p>
        </div>
        {(role === 'admin' || role === 'office') && !showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add Contact
          </button>
        )}
      </div>

      {/* Add Contact Form */}
      {showAddForm && (
        <div className="rounded-xl border border-primary/30 bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">{editingId ? 'Edit Contact' : 'New Contact'}</span>
            <button onClick={resetAddForm} className="rounded p-1 hover:bg-muted transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Name *</label>
              <input
                type="text" value={formName} onChange={e => setFormName(e.target.value)}
                placeholder="Jane Smith"
                className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Title / Role</label>
              {(() => {
                const knownRoles = CONTACT_TITLE_OPTIONS.filter(t => t !== 'Other')
                const showCustomInput = formTitle === '_other' || (formTitle !== '' && !knownRoles.includes(formTitle))
                const selectValue = showCustomInput ? 'Other' : formTitle
                return (
                  <>
                    <select
                      value={selectValue}
                      onChange={e => setFormTitle(e.target.value === 'Other' ? '_other' : e.target.value)}
                      className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select role...</option>
                      {CONTACT_TITLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {showCustomInput && (
                      <input type="text" value={formTitle === '_other' ? '' : formTitle} onChange={e => setFormTitle(e.target.value || '_other')}
                        placeholder="Enter custom role (e.g., COR, COTR, CO)" autoFocus
                        className="mt-1 h-8 rounded-md border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                    )}
                  </>
                )
              })()}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Email</label>
              <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)}
                placeholder="jane@example.com"
                className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Phone</label>
              <input type="tel" value={formPhone} onChange={e => setFormPhone(formatPhoneInput(e.target.value))}
                placeholder="(360) 555-0123" maxLength={14}
                className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Landowner *</label>
              <select
                value={formLandowner}
                onChange={e => { setFormLandowner(e.target.value); setFormContractId('') }}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select landowner...</option>
                {contractsByLandowner.map(([landowner]) => (
                  <option key={landowner} value={landowner}>{landowner}</option>
                ))}
                <option disabled>───────────</option>
                {NON_PROJECT_CATEGORIES.map(c => (
                  <option key={c} value={`_${c}`}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Project {formLandowner.startsWith('_') ? '(not needed)' : '*'}</label>
              <select
                value={formContractId}
                onChange={e => setFormContractId(e.target.value)}
                disabled={!formLandowner || formLandowner.startsWith('_')}
                className={`h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary ${
                  !formLandowner || formLandowner.startsWith('_') ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                <option value="">{formLandowner.startsWith('_') ? 'N/A' : 'Select project...'}</option>
                {formLandowner && !formLandowner.startsWith('_') && contractsByLandowner
                  .find(([lo]) => lo === formLandowner)?.[1]
                  .map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                }
              </select>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={resetAddForm} className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button onClick={handleAddContact} disabled={saving}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Contact'}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={isOwner ? 'Buscar contacto... (Search contact...)' : 'Search by name, title, email, phone, or project...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Two-tier filter: Landowner → Project */}
      {landownerGroups.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* Tier 1: Landowner */}
          <div className="rounded-xl border border-border bg-card/50 p-3">
            <div className="mb-2.5 flex items-center gap-2 px-1">
              <Building className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                {isOwner ? 'Propietario' : 'Landowner'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => { setLandownerFilter('all'); setProjectFilter('all') }}
                className={`flex items-center justify-between rounded-lg border py-2 px-3 text-xs font-medium transition-colors ${
                  landownerFilter === 'all'
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span>{isOwner ? 'Todos' : 'All'}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                  landownerFilter === 'all' ? 'bg-primary/20 text-primary' : 'bg-background/60 text-muted-foreground'
                }`}>{allContacts.length}</span>
              </button>
              {landownerGroups.map(g => (
                <button
                  key={g.name}
                  onClick={() => { setLandownerFilter(landownerFilter === g.name ? 'all' : g.name); setProjectFilter('all') }}
                  className={`flex items-center justify-between rounded-lg border py-2 px-3 text-xs font-medium transition-colors ${
                    landownerFilter === g.name
                      ? 'border-primary/40 bg-primary/15 text-primary'
                      : 'border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span className="truncate">{g.name}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                      landownerFilter === g.name ? 'bg-primary/20 text-primary' : 'bg-background/60 text-muted-foreground'
                    }`}>{g.count}</span>
                    {landownerFilter === g.name && <ChevronRight className="h-3 w-3 text-primary" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tier 2: Projects within landowner */}
          <div className="rounded-xl border border-border bg-card/50 p-3">
            <div className="mb-2.5 flex items-center gap-2 px-1">
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                {isOwner ? 'Proyectos' : 'Projects'}
              </span>
            </div>
            {landownerFilter === 'all' ? (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground/50">
                {isOwner ? 'Seleccione un propietario' : 'Select a landowner to see projects'}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setProjectFilter('all')}
                  className={`flex items-center justify-between rounded-lg border py-2 px-3 text-xs font-medium transition-colors ${
                    projectFilter === 'all'
                      ? 'border-primary/40 bg-primary/15 text-primary'
                      : 'border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span>{isOwner ? 'Todos los proyectos' : 'All Projects'}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                    projectFilter === 'all' ? 'bg-primary/20 text-primary' : 'bg-background/60 text-muted-foreground'
                  }`}>{allContacts.filter(c => c.landowner === landownerFilter).length}</span>
                </button>
                {projectGroups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setProjectFilter(projectFilter === g.id ? 'all' : g.id)}
                    className={`flex items-center justify-between rounded-lg border py-2 px-3 text-xs font-medium transition-colors ${
                      projectFilter === g.id
                        ? 'border-primary/40 bg-primary/15 text-primary'
                        : 'border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <span className="truncate">{g.name}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                      projectFilter === g.id ? 'bg-primary/20 text-primary' : 'bg-background/60 text-muted-foreground'
                    }`}>{g.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-3 text-lg text-muted-foreground">
            {isOwner ? 'Cargando contactos...' : 'Loading contacts...'}
          </span>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 py-12 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-lg text-muted-foreground">
            {search.trim()
              ? (isOwner ? 'No se encontraron contactos' : 'No contacts found')
              : (isOwner ? 'No hay contactos todavia' : 'No contacts yet')}
          </p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            {isOwner
              ? 'Los contactos se agregan desde la pagina de Proyectos'
              : 'Contacts are added via the Projects page'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 md:gap-4">
          {filteredContacts.map(contact => (
            <div
              key={contact.id}
              className="flex items-start gap-4 rounded-2xl border border-border bg-card p-4 md:p-5 transition-colors hover:border-primary/30"
            >
              {/* Avatar */}
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                {contact.name
                  .split(' ')
                  .filter(Boolean)
                  .map(w => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </div>

              {/* Info */}
              <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                <span className={`font-medium text-foreground truncate ${isOwner ? 'text-lg' : 'text-base'}`}>
                  {contact.name}
                </span>
                {contact.title && (
                  <span className="text-sm text-muted-foreground truncate">{contact.title}</span>
                )}
                <div className="mt-1 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{contact.landowner}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-primary/70">
                    <FolderOpen className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{contact.contract_name}</span>
                  </div>
                </div>

                <div className="mt-2 flex flex-col gap-1">
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                      style={{ minHeight: '44px' }}
                    >
                      <Phone className="h-4 w-4 flex-shrink-0" />
                      {contact.phone}
                    </a>
                  )}
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:underline truncate"
                    >
                      <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{contact.email}</span>
                    </a>
                  )}
                </div>
                {(role === 'admin' || role === 'office') && (
                  <div className="mt-2 flex items-center gap-1.5 pt-2 border-t border-border/50">
                    <button
                      onClick={() => startEdit(contact)}
                      className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm('Remove this contact? It can be recovered if needed.')) return
                        await supabase.from('contract_contacts').update({ deleted_at: new Date().toISOString() } as never).eq('id', contact.id)
                        toast({ title: 'Contact removed' })
                        fetchContacts()
                      }}
                      className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
