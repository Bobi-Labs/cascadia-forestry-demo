"use client"

import Image from 'next/image'
import {
  LayoutDashboard, Clock, DollarSign, FolderOpen, BarChart3, CloudSun,
  Users, UsersRound, Truck, Wrench, ShieldCheck, CalendarDays, CreditCard, TrendingUp,
  Eye, Leaf, Settings, TreePine, Lock, ChevronDown, Phone, HelpCircle,
  FileText, User, LogOut, ClipboardEdit, ClipboardList, Gavel, Contact, HardDrive, Receipt,
  MessageCircle, Layers, ScrollText, Database,
} from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { useAuth } from '@/lib/auth-context'
import { useProfilePhoto } from '@/hooks/use-profile-photo'
import { useCommsUnreadCount } from '@/hooks/use-comms-unread'
import type { Role } from '@/lib/mock-data'
import { OfficeTourButton } from '@/components/office-tour'
import { ForemanTourButton } from '@/components/foreman-tour'
// router removed — signOut handles navigation directly

interface NavItem {
  key: string
  icon: React.ElementType
  badge?: string
  badgeColor?: string
  locked?: boolean
  tooltip?: string
  comingSoon?: boolean
  disabled?: boolean
  disabledTooltip?: string
}

interface NavGroup {
  section: string
  items: NavItem[]
}

function getNavGroups(role: Role, t: (k: string) => string): NavGroup[] {
  if (role === 'admin') {
    return [
      {
        section: t('operations'),
        items: [
          { key: 'overview', icon: LayoutDashboard },
          // Projects sidebar entry hosts both Projects + Units as
          // sub-tabs — single sidebar item, less clutter.
          { key: 'contracts', icon: FolderOpen },
          { key: 'contacts', icon: Contact },
          { key: 'calendar', icon: CalendarDays },
          { key: 'workTracker', icon: ClipboardList },
          { key: 'communications', icon: MessageCircle },
        ],
      },
      {
        section: t('field'),
        items: [
          { key: 'crew', icon: Users },
          { key: 'crewSets', icon: UsersRound },
        ],
      },
      {
        section: t('office'),
        items: [
          { key: 'timeSheets', icon: Clock },
          { key: 'officeTimesheet', icon: ClipboardEdit },
        ],
      },
      {
        section: t('admin'),
        items: [
          // Expenses entry = pure analytics view of LANDED expense data.
          // The Pending Expenses queue + import controls live under
          // Imports below.
          { key: 'expenses', icon: CreditCard },
          // Imports = unified dashboard for every ingest pipeline.
          // Tabs: Expenses queue / Units queue + audit / Other Data.
          // Replaces the separate Pending Units + Ingest Audit nav items.
          { key: 'imports', icon: Database },
          { key: 'files', icon: HardDrive },
          { key: 'analytics', icon: TrendingUp },
        ],
      },
      {
        section: t('system'),
        items: [
          { key: 'settings', icon: Settings },
        ],
      },
      {
        section: t('future'),
        items: [
          { key: 'vehicles', icon: Truck, comingSoon: true },
          { key: 'weather', icon: CloudSun, comingSoon: true },
          { key: 'production', icon: BarChart3, comingSoon: true },
          { key: 'payroll', icon: DollarSign, comingSoon: true },
          { key: 'equipment', icon: Wrench, comingSoon: true },
          { key: 'safetyCerts', icon: ShieldCheck, comingSoon: true },
          { key: 'competitorData', icon: Eye, comingSoon: true },
          { key: 'bids', icon: Gavel, comingSoon: true },
          { key: 'nurseryOps', icon: Leaf, locked: true, tooltip: 'Phase 4', comingSoon: true },
        ],
      },
    ]
  }
  if (role === 'owner') {
    return [
      {
        section: t('operations'),
        items: [
          { key: 'overview', icon: LayoutDashboard },
          { key: 'contracts', icon: FolderOpen },
          { key: 'contacts', icon: Users },
          { key: 'workTracker', icon: ClipboardList },
          { key: 'communications', icon: MessageCircle },
        ],
      },
      {
        section: t('finance'),
        items: [
          // Per Jaime (April 2026): Jose (owner) should be able to see the
          // Expenses dashboard read-only. Same page as admin — no edits,
          // same role gating on contract tabs elsewhere.
          { key: 'expenses', icon: CreditCard },
          // Analytics dashboard — read-only for Jose. All 6 tabs visible
          // (Expenses live, Equipment/Bids/Payroll/Production/Competitor
          // as preview).
          { key: 'analytics', icon: TrendingUp },
        ],
      },
      {
        section: t('future'),
        items: [
          { key: 'messages', icon: Phone, comingSoon: true },
        ],
      },
    ]
  }
  if (role === 'foreman') {
    return [
      {
        section: '',
        items: [
          { key: 'overview', icon: LayoutDashboard },
          { key: 'myContracts', icon: FolderOpen },
          // Cross-project unit search — landed May 13 per the May 8
          // demo call: foremen need to find units fast across every
          // project, not just within one contract at a time.
          { key: 'adminUnits', icon: Layers },
          { key: 'timeSheets', icon: ClipboardList },
          { key: 'submitTimesheet', icon: Clock },
          { key: 'communications', icon: MessageCircle },
          { key: 'files', icon: HardDrive },
          { key: 'myCrew', icon: Users },
          { key: 'crewSets', icon: UsersRound },
        ],
      },
      {
        section: t('future'),
        items: [
          { key: 'expenses', icon: Receipt, comingSoon: true },
          { key: 'myHours', icon: DollarSign, comingSoon: true },
        ],
      },
    ]
  }
  if (role === 'office') {
    return [
      {
        section: t('operations'),
        items: [
          { key: 'overview', icon: LayoutDashboard },
          // Projects sidebar entry hosts both Projects + Units as
          // sub-tabs — same as admin role above.
          { key: 'contracts', icon: FolderOpen },
          { key: 'contacts', icon: Contact },
          { key: 'calendar', icon: CalendarDays },
          { key: 'workTracker', icon: ClipboardList },
          { key: 'communications', icon: MessageCircle },
        ],
      },
      {
        section: t('office'),
        items: [
          { key: 'timeSheets', icon: Clock },
          { key: 'officeTimesheet', icon: ClipboardEdit },
          { key: 'files', icon: HardDrive },
        ],
      },
      {
        // Was 'Finance' but now hosts Imports (which covers expense
        // assignments AND unit pending-review). Renamed to better
        // match what's inside.
        section: t('imports_section'),
        items: [
          // Single Imports entry covers Pending Expenses + Pending
          // Units (filtered to queues only, no run controls/audit
          // — those are admin-only inside the hub).
          { key: 'imports', icon: Database },
        ],
      },
      {
        section: t('field'),
        items: [
          { key: 'crew', icon: Users },
          { key: 'crewSets', icon: UsersRound },
        ],
      },
    ]
  }
  if (role === 'employee') {
    return [{
      section: '',
      items: [
        { key: 'myHours', icon: Clock, comingSoon: true },
        { key: 'myProfile', icon: User, comingSoon: true },
        { key: 'myDocuments', icon: FileText, comingSoon: true },
      ],
    }]
  }
  // client
  return [{
    section: '',
    items: [
      { key: 'overview', icon: LayoutDashboard },
    ],
  }]
}

const roleLabels: Record<Role, string> = {
  admin: 'Admin',
  owner: 'Jose',
  foreman: 'Foreman',
  office: 'Office',
  employee: 'Employee',
  client: 'Client',
}

export function AppSidebar({ onNavClick }: { onNavClick?: () => void } = {}) {
  const { role, setRole, activePage, setActivePage, t } = useApp()
  const { profile, signOut } = useAuth()
  const navGroups = getNavGroups(role, t)
  const isOwnerView = role === 'owner'
  const isAdmin = role === 'admin'
  // Unread count for the Communications nav badge — counts ops channels
  // with messages newer than the user's last-seen marker (localStorage).
  const commsUnread = useCommsUnreadCount(role)

  const handleSignOut = async () => {
    await signOut()
    // signOut() already does window.location.href = '/auth/login'
  }

  // Get initials from profile name
  const initials = profile?.name
    ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??'
  const displayName = profile?.name ?? 'Loading...'
  const { photoUrl } = useProfilePhoto(profile?.id ?? null)
  const companyLabel = profile?.company_id === null ? 'Cascadia + Ramos'
    : profile?.company_id === '00000000-0000-0000-0000-000000000001' ? 'Cascadia'
    : profile?.company_id === '00000000-0000-0000-0000-000000000002' ? 'Ramos'
    : ''

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-30 flex w-[280px] max-w-[85vw] flex-col border-r border-border bg-surface md:w-[260px] md:max-w-none">
      {/* Role Switcher — admin only */}
      {isAdmin && (
        <div className="border-b border-border px-4 py-3">
          <div className="relative">
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
              View as
            </label>
            <div className="relative">
              <select
                value={role}
                onChange={(e) => {
                  const newRole = e.target.value as Role
                  setRole(newRole)
                  // Reset to default page for role
                  if (newRole === 'owner') setActivePage('overview')
                  else if (newRole === 'foreman') setActivePage('overview')
                  else if (newRole === 'employee') setActivePage('myHours')
                  else setActivePage('overview')
                }}
                className="w-full appearance-none rounded-md border border-border bg-elevated px-3 py-2 pr-8 text-sm font-medium text-foreground focus:border-[#2a3f5f] focus:outline-none"
              >
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value} disabled={value === 'client'}>
                    {label}{value === 'client' ? ' (Coming Soon)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>
      )}

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
          <TreePine className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="text-sm font-bold text-foreground">Cascadia Ops</div>
          <div className="text-[11px] text-muted-foreground">Operations Platform</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {navGroups.map((group, gi) => (
          <div key={gi} className="mb-4">
            {group.section && (
              <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-primary/60">
                {group.section}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon
              const isActive = activePage === item.key
              const label = t(item.key)
              const isDisabled = (item.locked && item.tooltip === 'Phase 4') || item.disabled

              const comingSoonStyle = item.comingSoon && !isActive && !isDisabled

              return (
                <button
                  key={item.key}
                  data-tour={`nav-${item.key}`}
                  title={item.disabled ? item.disabledTooltip : undefined}
                  onClick={() => { if (!isDisabled) { setActivePage(item.key); onNavClick?.() } }}
                  className={`group mb-0.5 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'border-l-[3px] border-l-primary bg-[rgba(34,197,94,0.12)] text-primary'
                      : isDisabled
                        ? 'cursor-not-allowed text-muted-foreground/50'
                        : comingSoonStyle
                          ? 'border-l-[3px] border-l-transparent text-amber-600/50 hover:bg-elevated hover:text-amber-500/70'
                          : 'border-l-[3px] border-l-transparent text-muted-foreground hover:bg-elevated hover:text-foreground'
                  } ${isOwnerView ? 'py-3 text-base' : ''}`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isOwnerView ? 'h-5 w-5' : ''} ${comingSoonStyle ? 'text-amber-600/50 group-hover:text-amber-500/70' : ''}`} />
                  <span className="flex-1 truncate text-left">{label}</span>
                  {/* Communications unread badge — red pill with count of
                      channels with new messages since the user last viewed
                      them. Hidden when 0 (no badge clutter at rest). */}
                  {item.key === 'communications' && commsUnread > 0 && (
                    <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                      {commsUnread}
                    </span>
                  )}
                  {item.badge === '' && item.badgeColor?.includes('destructive') && (
                    <span className="h-2 w-2 rounded-full bg-destructive" />
                  )}
                  {item.badge && item.badge !== '' && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${item.badgeColor || 'bg-muted text-muted-foreground'}`}>
                      {item.badge}
                    </span>
                  )}
                  {item.locked && !item.tooltip && (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  )}
                  {item.tooltip && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                      {item.tooltip}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Tour button — office + foreman */}
      {role === 'office' && (
        <div className="px-4 pb-2">
          <OfficeTourButton />
        </div>
      )}
      {role === 'foreman' && (
        <div className="px-4 pb-2">
          <ForemanTourButton />
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 rounded-lg bg-card p-3">
          {photoUrl ? (
            <Image src={photoUrl} alt={displayName} width={36} height={36} className="h-9 w-9 rounded-full object-cover" unoptimized />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground truncate">{displayName}</div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {roleLabels[role]}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">{companyLabel}</span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
