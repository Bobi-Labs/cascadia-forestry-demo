// ============================================================
// ⚠️ LEGACY DB TYPES — DO NOT ADD NEW INTERFACES HERE.
//
// This file is a hand-written shim that predates Supabase type
// generation. It is KEPT ALIVE ONLY because ~22 call sites still
// import `Employee`, `Contract`, `Unit`, `CASCADIA_ID`, `RAMOS_ID`
// from it, and some of those imports have tighter field types
// (e.g. `company_id: string` instead of `string | null`) that would
// ripple through dozens of components if swapped naively.
//
// Single source of truth going forward:
//   - DB row types + enums  → `@/lib/supabase/database.types` (./ops.sh gen-types)
//   - Company ID constants  → `@/lib/constants`
//
// Full per-file migration is deferred to a dedicated pass (typecheck-
// driven, one caller at a time) — tracked in Known Issues in CLAUDE.md.
// When adding new code, prefer the generated types directly.
//
// Last manual update of the hand-written interfaces below: March 8, 2026.
// ============================================================

// Re-export company ID constants from the canonical location, so callers
// that still import { CASCADIA_ID, RAMOS_ID } from '@/lib/database.types'
// keep working while new code moves to '@/lib/constants'.
export { CASCADIA_ID, RAMOS_ID } from './constants'


// -- Enums --

export type UserRole = 'admin' | 'office' | 'foreman' | 'crew'
export type LanguagePref = 'en' | 'es'
export type EmployeeStatus = 'active' | 'inactive' | 'seasonal'
export type RateType = 'hourly' | 'daily'
export type CompanyAuthType = 'cascadia' | 'ramos' | 'both'

export type ContractType = 'private' | 'dnr_gna' | 'federal' | 'weyerhaeuser' | 'state' | 'other'
export type ContractStatus = 'open' | 'active' | 'upcoming' | 'seasonal' | 'closed' | 'archived' | 'pending_approval'
export type UnitAmountType = 'tree' | 'acre' | 'hour'
export type TerrainDifficulty = 'easy' | 'moderate' | 'hard'
export type UnitStatus = 'not_started' | 'in_progress' | 'completed' | 'pending'
export type UnitNoteType = 'text' | 'voice_transcript' | 'photo' | 'incident'
export type UnitDrawStatus = 'draft' | 'submitted' | 'inspected' | 'approved' | 'paid' | 'rejected'

export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected'
export type DailyUnitStatus = 'did_not_work' | 'in_progress' | 'completed'
export type ProductionType = 'tree' | 'acre' | 'hour'

export type BidStatus = 'draft' | 'submitted' | 'won' | 'lost' | 'withdrawn'

export type PayPeriodStatus = 'open' | 'processing' | 'exported' | 'closed'

export type ExpenseCategory = 'fuel' | 'hotel' | 'equipment' | 'food' | 'vehicle_repair' | 'chainsaw' | 'safety_gear' | 'other'
export type ExpenseSource = 'manual' | 'credit_card_import'

export type VehicleType = 'van' | 'pickup' | 'box_truck' | 'bus'
export type VehicleStatus = 'active' | 'in_repair' | 'out_of_service'
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical'
export type IssueStatus = 'reported' | 'in_progress' | 'resolved'

export type ComplianceCategory = 'osha' | 'flc' | 'h2b' | 'training' | 'insurance' | 'mileage' | 'audit'
export type ComplianceStatus = 'upcoming' | 'due_soon' | 'overdue' | 'completed'
export type IncidentType = 'injury' | 'near_miss' | 'property_damage' | 'vehicle'
export type IncidentSeverity = 'minor' | 'moderate' | 'severe'

export type ContractDocType = 'original_contract' | 'amendment' | 'task_order' | 'supplement' | 'exhibit' | 'unit_map' | 'vicinity_map' | 'driving_map' | 'cost_proposal' | 'bid_form' | 'spec_sheet' | 'insurance_cert' | 'correspondence' | 'other'
export type EmployeeDocType = 'passport' | 'visa' | 'drivers_license' | 'drive_authorization' | 'cpr_cert' | 'herbicide_license' | 'fingerprints' | 'i9' | 'w4' | 'onboarding_form' | 'photo_id' | 'other'

// -- Known company IDs: re-exported from '@/lib/constants' at the top of this file.
//    Declarations intentionally removed here to avoid duplicate exports.

// -- Table types --

export interface Company {
  id: string
  name: string
  legal_name: string | null
  address: string | null
  flc_number: string | null
  flce_number: string | null
  ein: string | null
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  company_id: string | null
  name: string
  email: string
  role: UserRole
  permissions: Record<string, any>
  language_pref: LanguagePref
  created_at: string
  updated_at: string
}

export interface WorkType {
  id: string
  name: string
  display_order: number
  is_active: boolean
  created_at: string
}

export interface Employee {
  id: string
  user_id: string | null
  last_name: string
  first_name: string
  rate: number | null
  daily_rate: number | null
  rate_type: RateType
  min_county_rate: number | null
  is_h2b: boolean
  is_driver: boolean
  is_foreman: boolean
  is_office: boolean
  company_auth: CompanyAuthType
  status: EmployeeStatus
  phone: string | null
  email: string | null
  address_us: string | null
  address_home: string | null
  passport_exp: string | null
  visa_exp: string | null
  dl_exp: string | null
  drive_auth_exp: string | null
  cpr_exp: string | null
  herbicide_license_exp: string | null
  fingerprints_exp: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CrewSet {
  id: string
  foreman_id: string
  name: string
  is_default: boolean
  last_used_at: string | null
  created_at: string
  updated_at: string
}

export interface CrewSetMember {
  id: string
  crew_set_id: string
  employee_id: string
  is_default: boolean
  created_at: string
}

export interface Contract {
  id: string
  contract_number: string | null
  name: string
  company_id: string
  landowner: string | null
  landowner_address: string | null
  work_types: string[]
  location: string | null
  unit_type: UnitAmountType | null
  total_units: number | null
  contract_price: number | null
  bond_amount: number | null
  bond_paid: boolean
  fringe_rate: number | null
  has_fringe: boolean
  has_prevailing_wage: boolean
  prevailing_wage_rate: number | null
  prime_contractor: string | null
  foreman_id: string | null
  status: ContractStatus
  viewed_by: string | null
  start_date: string | null
  end_date: string | null
  task_order: string | null
  amendment: string | null
  notes: string | null
  bags_per_tree_count: number | null
  archived_at: string | null
  contract_type: ContractType | null
  parent_contract_id: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  total_seedlings: number | null
  total_acres: number | null
  payment_terms: string | null
  insurance_cgl_min: number | null
  elevation_min: number | null
  elevation_max: number | null
  naics_code: string | null
  vendor_number: string | null
  services_checklist: Record<string, boolean> | null
  display_id: string | null
  master_contract: string | null
  drive_folder_everyone_id: string | null
  drive_folder_admin_id: string | null
  admin_notes: string | null
  created_at: string
  updated_at: string
}

export interface Unit {
  id: string
  contract_id: string
  name: string
  work_type: string | null
  county: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
  township_range: string | null
  amount: number | null
  amount_type: UnitAmountType | null
  price_per_unit: number | null
  elevation_avg: number | null
  terrain_difficulty: TerrainDifficulty | null
  status: UnitStatus
  completion_pct: number
  total_hours_logged: number
  started_at: string | null
  completed_at: string | null
  completed_time: string | null
  drive_folder_id: string | null
  avenza_map_url: string | null
  pdf_map_path: string | null
  notes: string | null
  elevation_min: number | null
  elevation_max: number | null
  avg_slope_pct: number | null
  species: string[] | null
  target_spacing: string | null
  seedlings_per_acre: number | null
  total_seedlings: number | null
  stock_type: string | null
  tpa_target: number | null
  prescription: string | null
  fire_shutdown_zone: number | null
  created_at: string
  updated_at: string
}

export interface UnitDraw {
  id: string
  unit_id: string
  draw_number: number
  description: string | null
  acres_submitted: number | null
  amount_invoiced: number | null
  amount_paid: number | null
  inspection_requested_at: string | null
  inspection_completed_at: string | null
  payment_received_at: string | null
  status: UnitDrawStatus
  inspector_name: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface UnitNote {
  id: string
  unit_id: string
  author_id: string | null
  note_type: UnitNoteType
  content: string | null
  media_url: string | null
  created_at: string
}

export interface Timesheet {
  id: string
  foreman_id: string
  contract_id: string
  crew_set_id: string | null
  date: string
  status: TimesheetStatus
  crew_count: number | null
  shift_start: string | null
  shift_end: string | null
  lunch_out: string | null
  lunch_in: string | null
  drive_morning_start: string | null
  drive_morning_end: string | null
  drive_evening_start: string | null
  drive_evening_end: string | null
  notes: string | null
  photos: string[]
  submitted_at: string | null
  approved_at: string | null
  approved_by: string | null
  created_at: string
  updated_at: string
}

export interface TimesheetEntry {
  id: string
  timesheet_id: string
  employee_id: string
  is_present: boolean
  work_type: string | null
  hours_worked: number | null
  drive_hours: number | null
  bags_count: number
  ot_hours: number | null
  rate_applied: number | null
  drive_rate: number | null
  min_county_rate: number | null
  gross_pay: number | null
  employee_note: string | null
  created_at: string
}

export interface TimesheetUnitHours {
  id: string
  timesheet_id: string
  unit_id: string
  hours_on_unit: number
  status_at_submit: DailyUnitStatus
  completed_at_time: string | null
  unit_note: string | null
  created_at: string
}

export interface ProductionLog {
  id: string
  timesheet_id: string
  unit_id: string
  quantity: number | null
  quantity_type: ProductionType | null
  is_estimate: boolean
  gps_boundary: Record<string, any> | null
  notes: string | null
  created_at: string
}

export interface Bid {
  id: string
  company_id: string
  name: string
  landowner: string | null
  work_types: string[]
  location: string | null
  bid_amount: number | null
  estimated_units: number | null
  unit_type: UnitAmountType | null
  status: BidStatus
  submitted_at: string | null
  decision_date: string | null
  viewed_by: string | null
  viewed_at: string | null
  site_notes: string | null
  past_performance_notes: string | null
  bid_document_url: string | null
  converted_contract_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PayPeriod {
  id: string
  company_id: string
  start_date: string
  end_date: string
  status: PayPeriodStatus
  total_gross: number | null
  exported_at: string | null
  exported_by: string | null
  created_at: string
  updated_at: string
}

export interface PayrollSummary {
  id: string
  pay_period_id: string
  employee_id: string
  total_reg_hours: number | null
  total_ot_hours: number | null
  total_drive_hours: number | null
  total_gross: number | null
  fringe_total: number | null
  rate_used: number | null
  created_at: string
}

export interface Expense {
  id: string
  contract_id: string | null
  employee_id: string | null
  company_id: string
  category: ExpenseCategory
  amount: number
  vendor: string | null
  description: string | null
  date: string
  receipt_url: string | null
  source: ExpenseSource
  created_at: string
  updated_at: string
}

export interface Vehicle {
  id: string
  company_id: string
  type: VehicleType
  make_model: string | null
  year: number | null
  license_plate: string | null
  vin: string | null
  status: VehicleStatus
  inspection_date: string | null
  inspection_due: string | null
  insurance_exp: string | null
  assigned_foreman: string | null
  notes: string | null
  mileage: number | null
  created_at: string
  updated_at: string
}

export interface VehicleIssue {
  id: string
  vehicle_id: string
  reported_by: string | null
  description: string
  photos: string[]
  priority: IssuePriority
  status: IssueStatus
  mechanic_eta: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface ComplianceItem {
  id: string
  company_id: string
  title: string
  description: string | null
  due_date: string
  category: ComplianceCategory
  status: ComplianceStatus
  assigned_to: string | null
  completed_at: string | null
  recurrence: string | null
  created_at: string
  updated_at: string
}

export interface SafetyMeeting {
  id: string
  contract_id: string | null
  date: string
  topic: string
  attendees: string[]
  notes: string | null
  document_url: string | null
  created_at: string
}

export interface Incident {
  id: string
  employee_id: string | null
  contract_id: string | null
  unit_id: string | null
  date: string
  type: IncidentType
  severity: IncidentSeverity
  description: string
  photos: string[]
  reported_by: string | null
  follow_up: string | null
  osha_reportable: boolean
  created_at: string
  updated_at: string
}

export interface WeatherCache {
  id: string
  unit_id: string | null
  date: string
  temp_high: number | null
  temp_low: number | null
  precipitation: number | null
  wind_speed: number | null
  humidity: number | null
  frost_risk: boolean
  snow_risk: boolean
  fire_risk_level: number | null
  conditions: string | null
  fetched_at: string
}

export interface Notification {
  id: string
  user_id: string | null
  title: string
  body: string | null
  type: string | null
  is_read: boolean
  link: string | null
  created_at: string
}

export interface ContractDocument {
  id: string
  contract_id: string
  doc_type: ContractDocType
  name: string
  storage_path: string
  file_size_bytes: number | null
  notes: string | null
  uploaded_by: string | null
  created_at: string
}

export interface EmployeeDocument {
  id: string
  employee_id: string
  doc_type: EmployeeDocType
  name: string
  storage_path: string
  expiration_date: string | null
  notes: string | null
  uploaded_by: string | null
  created_at: string
}

export interface CountyWageRate {
  id: string
  state: string
  county: string
  rate: number
  effective_date: string
  source: string | null
  created_at: string
}
