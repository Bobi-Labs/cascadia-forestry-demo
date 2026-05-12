"use client"

import { useState, useEffect, useCallback } from 'react'
import { Folder, FolderOpen, File, FileText, ExternalLink, Home, Upload, Loader2, ChevronRight, HardDrive, Lock, Users, Shield, Building, Receipt, Wrench, DollarSign, FileCheck, Files, ArrowLeft } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { useContracts } from '@/hooks/use-supabase'
import { toast } from '@/hooks/use-toast'

// ─── Shared Types & Helpers ──────────────────────────────────────────────────

const FOLDER_MIME = 'application/vnd.google-apps.folder'

const EVERYONE_ROOT = process.env.NEXT_PUBLIC_DRIVE_EVERYONE_FOLDER_ID ?? ''
const ADMIN_ROOT = process.env.NEXT_PUBLIC_DRIVE_ADMIN_FOLDER_ID ?? ''

type DriveFile = {
  id: string
  name: string
  mimeType: string
  size: number
  createdTime: string
  webViewLink: string
}

function formatSize(bytes: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === FOLDER_MIME) return <Folder className="h-5 w-5 flex-shrink-0 text-yellow-400" />
  if (mimeType.includes('pdf')) return <FileText className="h-5 w-5 flex-shrink-0 text-red-400" />
  if (mimeType.includes('image')) return <File className="h-5 w-5 flex-shrink-0 text-blue-400" />
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <File className="h-5 w-5 flex-shrink-0 text-green-400" />
  return <FileText className="h-5 w-5 flex-shrink-0 text-primary/70" />
}

// ─── Reusable Drive Folder Browser ──────────────────────────────────────────

function DriveBrowser({
  rootFolderId,
  rootLabel,
  canUpload,
}: {
  rootFolderId: string
  rootLabel: string
  canUpload: boolean
}) {
  type Crumb = { id: string; name: string }
  const [breadcrumbs, setBreadcrumbs] = useState<Crumb[]>([{ id: rootFolderId, name: rootLabel }])
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const currentId = breadcrumbs[breadcrumbs.length - 1].id

  const fetchFiles = useCallback(async (folderId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/drive/list?folderId=${folderId}`)
      const json = await res.json()
      setFiles(json.files ?? [])
    } catch {
      setFiles([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    setBreadcrumbs([{ id: rootFolderId, name: rootLabel }])
  }, [rootFolderId, rootLabel])

  useEffect(() => { fetchFiles(currentId) }, [currentId, fetchFiles])

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.name.startsWith('.')) {
      toast({ title: 'Upload blocked', description: 'Dotfiles cannot be uploaded.', variant: 'destructive' })
      return
    }
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folderId', currentId)
    try {
      const res = await fetch('/api/drive/upload', { method: 'POST', body: fd })
      const body = await res.json().catch(() => ({} as { error?: string }))
      if (res.ok) {
        toast({ title: 'File uploaded' })
        fetchFiles(currentId)
      } else {
        toast({
          title: 'Upload failed',
          description: body?.error || `Server returned ${res.status}. Try again, or check the file.`,
          variant: 'destructive',
        })
      }
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Network error — check your connection and retry.',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }, [currentId, fetchFiles])

  const folders = files.filter(f => f.mimeType === FOLDER_MIME)
  const docs = files.filter(f => f.mimeType !== FOLDER_MIME)

  return (
    <div data-tour="files-browser" className="flex flex-col gap-3">
      {/* Breadcrumb nav */}
      <div className="flex items-center gap-1 flex-wrap text-xs">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            <button
              onClick={() => setBreadcrumbs(prev => prev.slice(0, i + 1))}
              className={`rounded px-1.5 py-0.5 transition-colors ${
                i === breadcrumbs.length - 1
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {i === 0
                ? <span className="flex items-center gap-1"><Home className="h-3 w-3" />{crumb.name}</span>
                : crumb.name
              }
            </button>
          </span>
        ))}
      </div>

      {/* Upload button + Open in Drive */}
      <div className="flex items-center gap-2 self-start">
        {canUpload && (
          <label className={`flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? 'Uploading...' : 'Upload File'}
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        )}
        <a
          href={`https://drive.google.com/drive/folders/${currentId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
          title="Open this folder in Google Drive"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
            <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
            <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
            <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 13.25z" fill="#ea4335"/>
            <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
            <path d="m59.8 53h-27.5l-13.75 23.8c1.35-.8 2.9 1.2 4.5 1.2h45.5c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
            <path d="m73.4 26.5-10.1-17.5c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.5h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
          </svg>
          Open in Drive
        </a>
      </div>

      {/* File listing */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-12 text-center">
          <FolderOpen className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">This folder is empty</p>
          {canUpload && <p className="text-xs text-muted-foreground">Upload files using the button above</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {folders.length > 0 && (
            <div className="rounded-xl border border-border bg-card/30 p-3">
              <div className="mb-2 flex items-center gap-2 px-1">
                <Folder className="h-3.5 w-3.5 text-yellow-400" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Folders</span>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{folders.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {folders.map(file => (
                  <div key={file.id} className="flex items-center gap-3 rounded-lg border border-border bg-elevated/50 px-3 py-2.5 min-w-0">
                    <FileIcon mimeType={file.mimeType} />
                    <div className="flex flex-1 flex-col min-w-0">
                      <span className="text-sm font-medium text-foreground truncate" title={file.name}>{file.name}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setBreadcrumbs(prev => [...prev, { id: file.id, name: file.name }])}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors whitespace-nowrap"
                      >
                        Open <ChevronRight className="h-3 w-3" />
                      </button>
                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open in Google Drive"
                          className="flex items-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-primary transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {docs.length > 0 && (
            <div className="rounded-xl border border-border bg-card/30 p-3">
              <div className="mb-2 flex items-center gap-2 px-1">
                <FileText className="h-3.5 w-3.5 text-primary/70" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Files</span>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{docs.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {docs.map(file => (
                  <div key={file.id} className="flex items-center gap-3 rounded-lg border border-border bg-elevated/50 px-3 py-2.5 min-w-0">
                    <FileIcon mimeType={file.mimeType} />
                    <div className="flex flex-1 flex-col min-w-0">
                      <span className="text-sm font-medium text-foreground truncate" title={file.name}>{file.name}</span>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {file.size > 0 && <span>{formatSize(file.size)}</span>}
                        <span>{new Date(file.createdTime).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-primary hover:bg-primary/10 transition-colors whitespace-nowrap flex-shrink-0"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Category Configuration ─────────────────────────────────────────────────

type CategoryConfig = {
  name: string
  driveFolderName: string // matched against Drive folder names
  icon: React.ElementType
  description: string
  root: 'everyone' | 'admin'
}

const OPERATIONS_CATEGORIES: CategoryConfig[] = [
  { name: 'Contracts', driveFolderName: 'Contracts', icon: FileText, description: 'Contract documents, maps & specs', root: 'everyone' },
  { name: 'Crew & HR', driveFolderName: 'Crew', icon: Users, description: 'Employee documents, passports, visas', root: 'everyone' },
  { name: 'Safety', driveFolderName: 'Safety', icon: Shield, description: 'Safety docs, training, incident reports', root: 'everyone' },
  { name: 'Company — Cascadia', driveFolderName: 'Company — Cascadia', icon: Building, description: 'Licenses, certifications, insurance', root: 'everyone' },
  { name: 'Company — Ramos', driveFolderName: 'Company — Ramos', icon: Building, description: 'Licenses, certifications, insurance', root: 'everyone' },
  { name: 'Templates', driveFolderName: 'Templates', icon: Files, description: 'Blank forms, standard documents', root: 'everyone' },
]

const ADMIN_CATEGORIES: CategoryConfig[] = [
  { name: 'Financial', driveFolderName: 'Financial', icon: DollarSign, description: 'Payroll records, insurance originals', root: 'admin' },
  { name: 'Equipment', driveFolderName: 'Equipment', icon: Wrench, description: 'Purchase records, warranties, maintenance', root: 'admin' },
  { name: 'Expenses', driveFolderName: 'Expenses', icon: Receipt, description: 'Statements, expense reports', root: 'admin' },
  { name: 'Invoicing', driveFolderName: 'Invoicing', icon: FileCheck, description: 'Sent invoices, payment confirmations', root: 'admin' },
]

// ─── Folder ID resolution hook ──────────────────────────────────────────────

function useCategoryFolderIds() {
  const [folderMap, setFolderMap] = useState<Record<string, { id: string; count: number }>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const map: Record<string, { id: string; count: number }> = {}
      try {
        const [evRes, adRes] = await Promise.all([
          EVERYONE_ROOT ? fetch(`/api/drive/list?folderId=${EVERYONE_ROOT}`).then(r => r.json()) : { files: [] },
          ADMIN_ROOT ? fetch(`/api/drive/list?folderId=${ADMIN_ROOT}`).then(r => r.json()) : { files: [] },
        ])
        for (const f of (evRes.files ?? [])) {
          if (f.mimeType === FOLDER_MIME) map[`everyone:${f.name}`] = { id: f.id, count: 0 }
        }
        for (const f of (adRes.files ?? [])) {
          if (f.mimeType === FOLDER_MIME) map[`admin:${f.name}`] = { id: f.id, count: 0 }
        }
        // Fetch item counts per category in parallel
        const countPromises = Object.entries(map).map(async ([key, val]) => {
          try {
            const res = await fetch(`/api/drive/list?folderId=${val.id}`)
            const json = await res.json()
            map[key] = { ...val, count: (json.files ?? []).length }
          } catch { /* leave count 0 */ }
        })
        await Promise.all(countPromises)
      } catch { /* leave empty map */ }
      if (!cancelled) {
        setFolderMap(map)
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const resolve = (cat: CategoryConfig) => {
    const key = `${cat.root}:${cat.driveFolderName}`
    return folderMap[key]
  }

  return { resolve, loading }
}

// ─── Category Card ──────────────────────────────────────────────────────────

function CategoryCard({
  category,
  folderId,
  itemCount,
  isAdmin,
  onClick,
}: {
  category: CategoryConfig
  folderId: string | undefined
  itemCount: number
  isAdmin: boolean
  onClick: () => void
}) {
  const Icon = category.icon
  const disabled = !folderId

  return (
    <div className="relative">
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all ${
        disabled
          ? 'opacity-40 cursor-not-allowed border-border/50'
          : isAdmin
            ? 'border-border bg-card hover:border-amber-500/30 hover:bg-amber-500/5'
            : 'border-border bg-card hover:border-primary/30 hover:bg-primary/5'
      }`}
    >
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
        isAdmin ? 'bg-amber-500/10 text-amber-400' : 'bg-primary/10 text-primary'
      }`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground truncate">{category.name}</span>
          {isAdmin && <Lock className="h-3 w-3 flex-shrink-0 text-amber-400/60" />}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{category.description}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {itemCount > 0 && (
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
            isAdmin ? 'bg-amber-500/10 text-amber-400' : 'bg-primary/10 text-primary'
          }`}>{itemCount}</span>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
      </div>
    </button>
      {folderId && (
        <a
          href={`https://drive.google.com/drive/folders/${folderId}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2 right-2 rounded p-1 text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors z-10"
          title="Open in Google Drive"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
            <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
            <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
            <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 13.25z" fill="#ea4335"/>
            <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
            <path d="m59.8 53h-27.5l-13.75 23.8c1.35-.8 2.9 1.2 4.5 1.2h45.5c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
            <path d="m73.4 26.5-10.1-17.5c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.5h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
          </svg>
        </a>
      )}
    </div>
  )
}

// ─── Category Dashboard (shared between Admin + Office) ─────────────────────

function CategoryDashboard({ showAdmin }: { showAdmin: boolean }) {
  const { resolve, loading } = useCategoryFolderIds()
  const [activeFolder, setActiveFolder] = useState<{ id: string; name: string } | null>(null)

  if (activeFolder) {
    return (
      <div className="flex flex-col gap-4">
        <button
          onClick={() => setActiveFolder(null)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors self-start"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Files
        </button>
        <DriveBrowser
          key={activeFolder.id}
          rootFolderId={activeFolder.id}
          rootLabel={activeFolder.name}
          canUpload
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <HardDrive className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Company Files</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Browse and manage company documents organized by category.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground">Loading file categories...</span>
        </div>
      ) : (
        <>
          {/* Operations section */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">Operations</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {OPERATIONS_CATEGORIES.map(cat => {
                const resolved = resolve(cat)
                return (
                  <CategoryCard
                    key={cat.driveFolderName}
                    category={cat}
                    folderId={resolved?.id}
                    itemCount={resolved?.count ?? 0}
                    isAdmin={false}
                    onClick={() => resolved && setActiveFolder({ id: resolved.id, name: cat.name })}
                  />
                )
              })}
            </div>
          </div>

          {/* Admin section */}
          {showAdmin && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <Lock className="h-3 w-3 text-amber-400/60" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-amber-400/60">Admin Only</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2">
                {ADMIN_CATEGORIES.map(cat => {
                  const resolved = resolve(cat)
                  return (
                    <CategoryCard
                      key={cat.driveFolderName}
                      category={cat}
                      folderId={resolved?.id}
                      itemCount={resolved?.count ?? 0}
                      isAdmin
                      onClick={() => resolved && setActiveFolder({ id: resolved.id, name: cat.name })}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Admin Files Page ───────────────────────────────────────────────────────

function AdminFilesPage() {
  return <CategoryDashboard showAdmin />
}

// ─── Office Files Page ──────────────────────────────────────────────────────

function OfficeFilesPage() {
  return <CategoryDashboard showAdmin={false} />
}

// ─── Foreman Files Page (Maps & Specs per contract) ──────────────────────────

function ForemanFilesPage() {
  const { data: contracts } = useContracts()
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null)

  const activeContracts = contracts?.filter(c => c.status === 'active' || c.status === 'open') ?? []

  if (selectedFolder) {
    return (
      <div className="flex flex-col gap-5">
        <button
          onClick={() => setSelectedFolder(null)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors self-start"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> Back to Contracts
        </button>
        <div className="flex items-center gap-2">
          <Folder className="h-5 w-5 text-yellow-400" />
          <h2 className="text-base font-semibold text-foreground">{selectedFolder.name} — Maps & Specs</h2>
        </div>
        <DriveBrowser
          key={selectedFolder.id}
          rootFolderId={selectedFolder.id}
          rootLabel="Maps & Specs"
          canUpload={false}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <HardDrive className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Project Files</h2>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">Maps, specs, and documents for your active projects.</p>

      {activeContracts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
          No active projects
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {activeContracts.map(c => {
            const hasFolderId = !!c.drive_folder_everyone_id
            return (
              <button
                key={c.id}
                onClick={() => hasFolderId && setSelectedFolder({ id: c.drive_folder_everyone_id!, name: c.name })}
                disabled={!hasFolderId}
                className={`flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors ${
                  hasFolderId ? 'hover:bg-elevated/50 hover:border-primary/30' : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <Folder className={`h-5 w-5 flex-shrink-0 ${hasFolderId ? 'text-yellow-400' : 'text-muted-foreground/40'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{c.name}</div>
                  {c.location && <div className="text-xs text-muted-foreground truncate">{c.location}</div>}
                </div>
                {hasFolderId ? (
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                ) : (
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">No folder</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main Export — role-dispatched ───────────────────────────────────────────

export function FilesPage() {
  const { role } = useApp()

  if (role === 'admin') return <AdminFilesPage />
  if (role === 'office') return <OfficeFilesPage />
  if (role === 'foreman') return <ForemanFilesPage />

  // Owner / others — not exposed
  return null
}
