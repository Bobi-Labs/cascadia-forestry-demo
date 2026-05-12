"use client"

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { Role, Company, Language } from './mock-data'
import { translations } from './mock-data'
import { useAuth, type UserProfile } from './auth-context'

const CASCADIA_ID = '00000000-0000-0000-0000-000000000001'
const RAMOS_ID = '00000000-0000-0000-0000-000000000002'

// Hub pages (Projects, Expenses, etc.) register their tab strip here
// so the topbar can render it inline with the breadcrumb instead of
// stacking another row of UI under the topbar. Each hub clears it on
// unmount.
export interface PageTab {
  key: string
  label: string
  icon?: React.ReactNode
}
export interface PageTabsConfig {
  tabs: PageTab[]
  activeKey: string
  onSelect: (key: string) => void
}

interface AppContextType {
  role: Role
  setRole: (role: Role) => void
  company: Company
  setCompany: (company: Company) => void
  language: Language
  setLanguage: (language: Language) => void
  activePage: string
  setActivePage: (page: string) => void
  pageHint: string | null
  setPageHint: (hint: string | null) => void
  selectedContractId: string | null
  setSelectedContractId: (id: string | null) => void
  pageTabs: PageTabsConfig | null
  setPageTabs: (config: PageTabsConfig | null) => void
  t: (key: string) => string
}

const AppContext = createContext<AppContextType | null>(null)

/** Map DB role + permissions to UI display role */
function mapDbRoleToUiRole(profile: UserProfile): Role {
  if (profile.role === 'admin') {
    // Dad gets "owner" UI if ui_mode is set
    if (profile.permissions?.ui_mode === 'owner') return 'owner'
    return 'admin'
  }
  if (profile.role === 'crew') return 'employee'
  // foreman → foreman, office → office
  return profile.role as Role
}

/** Map company_id UUID to Company toggle value */
function mapCompanyId(companyId: string | null): Company {
  if (companyId === CASCADIA_ID) return 'cascadia'
  if (companyId === RAMOS_ID) return 'ramos'
  return 'all' // null = sees both companies
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()

  const [role, setRole] = useState<Role>('admin')
  const [company, setCompany] = useState<Company>('all')
  const [language, setLanguage] = useState<Language>('en')
  const [activePage, setActivePage] = useState('overview')
  const [pageHint, setPageHint] = useState<string | null>(null)
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null)
  const [pageTabs, setPageTabs] = useState<PageTabsConfig | null>(null)

  // Hydrate from profile when it loads
  useEffect(() => {
    if (!profile) return
    setRole(mapDbRoleToUiRole(profile))
    setCompany(mapCompanyId(profile.company_id))
    setLanguage(profile.language_pref)
  }, [profile])

  const t = useCallback((key: string) => {
    return translations[language]?.[key] || key
  }, [language])

  return (
    <AppContext.Provider value={{
      role, setRole,
      company, setCompany,
      language, setLanguage,
      activePage, setActivePage,
      pageHint, setPageHint,
      selectedContractId, setSelectedContractId,
      pageTabs, setPageTabs,
      t,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
