/**
 * DB-shaped fixture data for demo mode.
 *
 * The forestry app reads from Supabase tables via `hooks/use-supabase.ts`
 * (the dominant read path) and `lib/queries/*` (the registered query path).
 * Both paths expect snake_case rows with FK fields. When IS_DEMO_MODE is
 * true, those paths look up fixtures here instead of hitting Supabase.
 *
 * Names and dollar figures match `lib/mock-data.ts` and the screenshots
 * already on bobilabs.dev/work/cascadia-forestry, so a prospect clicking
 * from the case study slider into the live demo sees the same world.
 *
 * Fixtures are typed loosely (Record-of-rows shape, `unknown` row type)
 * because matching every nullable field in the generated `Database` type
 * is more pain than value for demo display. Components that reach into
 * unset fields get `undefined`, which they already handle for the real
 * data path (Supabase often returns nulls).
 */

import { CASCADIA_ID, RAMOS_ID } from '@/lib/constants'

// Date helpers. Anchored "today" = May 12, 2026 so the demo feels current
// without needing to recompute relative dates on every fixture row.
const today = '2026-05-12'
function daysAhead(n: number): string {
  const d = new Date(today + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Fixed UUIDs for cross-referencing. Real IDs are UUIDv4 in prod; for the
// demo we use readable short IDs and pad them out to UUID length.
function id(slug: string): string {
  const padded = slug.padEnd(8, '0').slice(0, 8)
  return `${padded}-0000-4000-8000-000000000000`
}

const companies = [
  {
    id: CASCADIA_ID,
    name: 'cascadia',
    legal_name: 'Cascadia Forestry Inc',
    address: '1234 Timber Way, Portland, OR 97201',
    flc_number: 'OR-FLC-2024-001',
    flce_number: 'OR-FLCE-2024-001',
    ein: '88-1234567',
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
  {
    id: RAMOS_ID,
    name: 'ramos',
    legal_name: 'Ramos Reforestation Inc',
    address: '5678 Cedar Lane, Eugene, OR 97401',
    flc_number: 'OR-FLC-2024-002',
    flce_number: 'OR-FLCE-2024-002',
    ein: '88-7654321',
    created_at: '2024-02-01T00:00:00Z',
    updated_at: '2024-02-01T00:00:00Z',
  },
]

const employees = [
  {
    id: id('agustin'),
    user_id: null,
    last_name: 'Ramos',
    first_name: 'Agustin',
    rate: null,
    daily_rate: 340,
    rate_type: 'daily',
    min_county_rate: null,
    is_h2b: false,
    is_driver: false,
    is_foreman: true,
    is_office: false,
    company_auth: 'cascadia',
    status: 'active',
    phone: '503-555-0101',
    email: 'agustin@cascadia.example',
    company_id: CASCADIA_ID,
    hire_date: '2022-03-15',
    created_at: '2022-03-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
  {
    id: id('maya'),
    user_id: null,
    last_name: 'Torres',
    first_name: 'Maya',
    rate: null,
    daily_rate: 400,
    rate_type: 'daily',
    min_county_rate: null,
    is_h2b: false,
    is_driver: false,
    is_foreman: true,
    is_office: false,
    company_auth: 'cascadia',
    status: 'active',
    phone: '503-555-0102',
    email: 'maya@cascadia.example',
    company_id: CASCADIA_ID,
    hire_date: '2023-01-10',
    created_at: '2023-01-10T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
  {
    id: id('marco'),
    user_id: null,
    last_name: 'Perez',
    first_name: 'Marco',
    rate: 22.0,
    daily_rate: null,
    rate_type: 'hourly',
    min_county_rate: 18.5,
    is_h2b: true,
    is_driver: false,
    is_foreman: false,
    is_office: false,
    company_auth: 'cascadia',
    status: 'active',
    phone: '503-555-0103',
    email: null,
    company_id: CASCADIA_ID,
    hire_date: '2024-03-01',
    created_at: '2024-03-01T00:00:00Z',
    updated_at: '2024-03-01T00:00:00Z',
  },
  {
    id: id('luis'),
    user_id: null,
    last_name: 'Garcia',
    first_name: 'Luis',
    rate: 22.5,
    daily_rate: null,
    rate_type: 'hourly',
    min_county_rate: 18.5,
    is_h2b: true,
    is_driver: false,
    is_foreman: false,
    is_office: false,
    company_auth: 'cascadia',
    status: 'active',
    phone: '503-555-0104',
    email: null,
    company_id: CASCADIA_ID,
    hire_date: '2024-04-01',
    created_at: '2024-04-01T00:00:00Z',
    updated_at: '2024-04-01T00:00:00Z',
  },
  {
    id: id('elena'),
    user_id: null,
    last_name: 'Herrera',
    first_name: 'Elena',
    rate: 22.0,
    daily_rate: null,
    rate_type: 'hourly',
    min_county_rate: 18.5,
    is_h2b: true,
    is_driver: false,
    is_foreman: false,
    is_office: false,
    company_auth: 'cascadia',
    status: 'active',
    phone: '503-555-0105',
    email: null,
    company_id: CASCADIA_ID,
    hire_date: '2024-04-15',
    created_at: '2024-04-15T00:00:00Z',
    updated_at: '2024-04-15T00:00:00Z',
  },
  {
    id: id('diego'),
    user_id: null,
    last_name: 'Vargas',
    first_name: 'Diego',
    rate: 23.0,
    daily_rate: null,
    rate_type: 'hourly',
    min_county_rate: 19.0,
    is_h2b: true,
    is_driver: true,
    is_foreman: false,
    is_office: false,
    company_auth: 'cascadia',
    status: 'active',
    phone: '503-555-0106',
    email: null,
    company_id: CASCADIA_ID,
    hire_date: '2023-09-01',
    created_at: '2023-09-01T00:00:00Z',
    updated_at: '2023-09-01T00:00:00Z',
  },
  {
    id: id('carlos'),
    user_id: null,
    last_name: 'Ruiz',
    first_name: 'Carlos',
    rate: 23.0,
    daily_rate: null,
    rate_type: 'hourly',
    min_county_rate: 19.0,
    is_h2b: true,
    is_driver: true,
    is_foreman: false,
    is_office: false,
    company_auth: 'cascadia',
    status: 'active',
    phone: '503-555-0107',
    email: null,
    company_id: CASCADIA_ID,
    hire_date: '2023-10-15',
    created_at: '2023-10-15T00:00:00Z',
    updated_at: '2023-10-15T00:00:00Z',
  },
  {
    id: id('jose'),
    user_id: null,
    last_name: 'Ramirez',
    first_name: 'Jose',
    rate: 22.0,
    daily_rate: null,
    rate_type: 'hourly',
    min_county_rate: 18.5,
    is_h2b: true,
    is_driver: false,
    is_foreman: false,
    is_office: false,
    company_auth: 'ramos',
    status: 'active',
    phone: '541-555-0201',
    email: null,
    company_id: RAMOS_ID,
    hire_date: '2024-03-15',
    created_at: '2024-03-15T00:00:00Z',
    updated_at: '2024-03-15T00:00:00Z',
  },
  {
    id: id('miguel'),
    user_id: null,
    last_name: 'Castillo',
    first_name: 'Miguel',
    rate: null,
    daily_rate: 360,
    rate_type: 'daily',
    min_county_rate: null,
    is_h2b: false,
    is_driver: false,
    is_foreman: true,
    is_office: false,
    company_auth: 'ramos',
    status: 'active',
    phone: '541-555-0202',
    email: 'miguel@ramos.example',
    company_id: RAMOS_ID,
    hire_date: '2023-02-01',
    created_at: '2023-02-01T00:00:00Z',
    updated_at: '2023-02-01T00:00:00Z',
  },
  {
    id: id('rosa'),
    user_id: null,
    last_name: 'Mendoza',
    first_name: 'Rosa',
    rate: 22.5,
    daily_rate: null,
    rate_type: 'hourly',
    min_county_rate: 18.5,
    is_h2b: true,
    is_driver: false,
    is_foreman: false,
    is_office: false,
    company_auth: 'ramos',
    status: 'active',
    phone: '541-555-0203',
    email: null,
    company_id: RAMOS_ID,
    hire_date: '2024-04-01',
    created_at: '2024-04-01T00:00:00Z',
    updated_at: '2024-04-01T00:00:00Z',
  },
]

const contracts = [
  {
    id: id('vanessa'),
    contract_number: 'CASCADWTHI202',
    name: 'Vanessa',
    company_id: CASCADIA_ID,
    landowner: 'Weyerhaeuser',
    landowner_address: '220 Occidental Ave S, Seattle, WA 98104',
    work_types: ['planting'],
    location: 'Cowlitz CO, WA',
    unit_type: 'tree',
    total_units: 18,
    contract_price: 187000,
    bond_amount: 18700,
    bond_paid: true,
    fringe_rate: null,
    has_fringe: false,
    has_prevailing_wage: false,
    prevailing_wage_rate: null,
    prime_contractor: null,
    foreman_id: id('agustin'),
    status: 'active',
    viewed_by: null,
    start_date: '2025-10-15',
    end_date: daysAhead(21),
    task_order: null,
    amendment: null,
    notes: 'Planting season hot. 67% complete as of last week.',
    bags_per_tree_count: 120,
    archived_at: null,
    contract_type: 'weyerhaeuser',
    parent_contract_id: null,
    contact_name: 'Brian Sutter',
    contact_phone: '360-555-0301',
    contact_email: 'bsutter@weyerhaeuser.example',
    total_seedlings: 540000,
    total_acres: 312,
    payment_terms: 'Net 30',
    display_id: 'VAN-2025',
    drive_folder_everyone_id: null,
    drive_folder_admin_id: null,
    created_at: '2025-09-01T00:00:00Z',
    updated_at: '2025-10-15T00:00:00Z',
  },
  {
    id: id('kirk'),
    contract_number: 'CASCADWTHI203',
    name: 'Kirk',
    company_id: CASCADIA_ID,
    landowner: 'Weyerhaeuser',
    landowner_address: '220 Occidental Ave S, Seattle, WA 98104',
    work_types: ['planting'],
    location: 'Columbia CO, OR',
    unit_type: 'tree',
    total_units: 22,
    contract_price: 215000,
    bond_amount: 21500,
    bond_paid: true,
    fringe_rate: null,
    has_fringe: false,
    has_prevailing_wage: false,
    prevailing_wage_rate: null,
    prime_contractor: null,
    foreman_id: id('maya'),
    status: 'active',
    viewed_by: null,
    start_date: '2025-11-01',
    end_date: daysAhead(48),
    task_order: null,
    amendment: null,
    notes: '36% complete. Maya running a tight crew.',
    bags_per_tree_count: 130,
    archived_at: null,
    contract_type: 'weyerhaeuser',
    parent_contract_id: null,
    contact_name: 'Brian Sutter',
    contact_phone: '360-555-0301',
    contact_email: 'bsutter@weyerhaeuser.example',
    total_seedlings: 660000,
    total_acres: 380,
    payment_terms: 'Net 30',
    display_id: 'KIRK-2025',
    drive_folder_everyone_id: null,
    drive_folder_admin_id: null,
    created_at: '2025-10-01T00:00:00Z',
    updated_at: '2025-11-01T00:00:00Z',
  },
  {
    id: id('dnrlewis'),
    contract_number: 'DNRLEW2026',
    name: 'DNR Lewis',
    company_id: CASCADIA_ID,
    landowner: 'WA DNR',
    landowner_address: '1111 Washington St SE, Olympia, WA 98504',
    work_types: ['thinning'],
    location: 'Lewis CO, WA',
    unit_type: 'acre',
    total_units: 8,
    contract_price: 95000,
    bond_amount: 9500,
    bond_paid: false,
    fringe_rate: 5.2,
    has_fringe: true,
    has_prevailing_wage: true,
    prevailing_wage_rate: 28.5,
    prime_contractor: null,
    foreman_id: null,
    status: 'upcoming',
    viewed_by: null,
    start_date: '2026-06-15',
    end_date: '2026-09-30',
    task_order: 'TO-2026-08',
    amendment: null,
    notes: 'Prevailing wage. Bond not yet paid.',
    bags_per_tree_count: null,
    archived_at: null,
    contract_type: 'state',
    parent_contract_id: null,
    contact_name: 'Linda Cho',
    contact_phone: '360-555-0401',
    contact_email: 'lcho@dnr.wa.example',
    total_seedlings: null,
    total_acres: 240,
    payment_terms: 'Net 45',
    display_id: 'DNR-LEW-2026',
    drive_folder_everyone_id: null,
    drive_folder_admin_id: null,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
  },
  {
    id: id('papabear'),
    contract_number: 'VAAGPB2025',
    name: 'Papa Bear',
    company_id: CASCADIA_ID,
    landowner: 'Vaagen Bros',
    landowner_address: null,
    work_types: ['thinning'],
    location: 'Okanogan CO, WA',
    unit_type: 'acre',
    total_units: 6,
    contract_price: 120000,
    bond_amount: 12000,
    bond_paid: true,
    fringe_rate: null,
    has_fringe: false,
    has_prevailing_wage: false,
    prevailing_wage_rate: null,
    prime_contractor: null,
    foreman_id: null,
    status: 'seasonal',
    viewed_by: null,
    start_date: '2026-07-01',
    end_date: '2026-10-15',
    task_order: null,
    amendment: null,
    notes: 'Seasonal start in summer.',
    bags_per_tree_count: null,
    archived_at: null,
    contract_type: 'private',
    parent_contract_id: null,
    contact_name: 'Carl Vaagen',
    contact_phone: '509-555-0501',
    contact_email: null,
    total_seedlings: null,
    total_acres: 180,
    payment_terms: 'Net 30',
    display_id: 'PB-2026',
    drive_folder_everyone_id: null,
    drive_folder_admin_id: null,
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
  },
  {
    id: id('cedar'),
    contract_number: 'RAMOSCED2025',
    name: 'Cedar Ridge',
    company_id: RAMOS_ID,
    landowner: 'Hancock Forest Management',
    landowner_address: null,
    work_types: ['planting'],
    location: 'Lane CO, OR',
    unit_type: 'tree',
    total_units: 14,
    contract_price: 152000,
    bond_amount: 15200,
    bond_paid: true,
    fringe_rate: null,
    has_fringe: false,
    has_prevailing_wage: false,
    prevailing_wage_rate: null,
    prime_contractor: null,
    foreman_id: id('miguel'),
    status: 'active',
    viewed_by: null,
    start_date: '2025-11-15',
    end_date: daysAhead(33),
    task_order: null,
    amendment: null,
    notes: 'Ramos lead. 52% complete.',
    bags_per_tree_count: 110,
    archived_at: null,
    contract_type: 'private',
    parent_contract_id: null,
    contact_name: 'Tom Rasmussen',
    contact_phone: '541-555-0601',
    contact_email: 'trasmussen@hancock.example',
    total_seedlings: 420000,
    total_acres: 245,
    payment_terms: 'Net 30',
    display_id: 'CR-2025',
    drive_folder_everyone_id: null,
    drive_folder_admin_id: null,
    created_at: '2025-10-15T00:00:00Z',
    updated_at: '2025-11-15T00:00:00Z',
  },
  {
    id: id('summit'),
    contract_number: 'CASCSUM2024',
    name: 'Summit Ridge',
    company_id: CASCADIA_ID,
    landowner: 'Stimson Lumber',
    landowner_address: null,
    work_types: ['planting'],
    location: 'Tillamook CO, OR',
    unit_type: 'tree',
    total_units: 10,
    contract_price: 142000,
    bond_amount: 14200,
    bond_paid: true,
    fringe_rate: null,
    has_fringe: false,
    has_prevailing_wage: false,
    prevailing_wage_rate: null,
    prime_contractor: null,
    foreman_id: id('agustin'),
    status: 'closed',
    viewed_by: null,
    start_date: '2024-10-01',
    end_date: '2025-03-30',
    task_order: null,
    amendment: null,
    notes: 'Closed Q1 2025. Final draw paid.',
    bags_per_tree_count: 115,
    archived_at: null,
    contract_type: 'private',
    parent_contract_id: null,
    contact_name: 'Andy Hill',
    contact_phone: '503-555-0701',
    contact_email: null,
    total_seedlings: 320000,
    total_acres: 195,
    payment_terms: 'Net 30',
    display_id: 'SUM-2024',
    drive_folder_everyone_id: null,
    drive_folder_admin_id: null,
    created_at: '2024-09-01T00:00:00Z',
    updated_at: '2025-04-01T00:00:00Z',
  },
]

const workTypes = [
  { id: id('wt-plant'), name: 'planting', display_order: 1, is_active: true, created_at: '2024-01-01T00:00:00Z' },
  { id: id('wt-thin'), name: 'thinning', display_order: 2, is_active: true, created_at: '2024-01-01T00:00:00Z' },
  { id: id('wt-brush'), name: 'brushing', display_order: 3, is_active: true, created_at: '2024-01-01T00:00:00Z' },
  { id: id('wt-spray'), name: 'spraying', display_order: 4, is_active: true, created_at: '2024-01-01T00:00:00Z' },
  { id: id('wt-survey'), name: 'survey', display_order: 5, is_active: true, created_at: '2024-01-01T00:00:00Z' },
  { id: id('wt-piling'), name: 'piling', display_order: 6, is_active: true, created_at: '2024-01-01T00:00:00Z' },
]

function makeUnits() {
  const rows: Record<string, unknown>[] = []
  // Vanessa units
  const vanessaUnits = [
    { slug: 'midge-u1', name: 'midge u1', amount: 3200, completed: 2150, status: 'in_progress', terrain: 'moderate' },
    { slug: 'midge-u2', name: 'midge u2', amount: 3000, completed: 3000, status: 'completed', terrain: 'easy' },
    { slug: 'quaker-u1', name: 'quaker u1', amount: 4100, completed: 4100, status: 'completed', terrain: 'moderate' },
    { slug: 'quaker-u3', name: 'quaker u3', amount: 3800, completed: 2400, status: 'in_progress', terrain: 'hard' },
    { slug: 'fern-u2', name: 'fern u2', amount: 2900, completed: 0, status: 'not_started', terrain: 'moderate' },
    { slug: 'fern-u4', name: 'fern u4', amount: 3200, completed: 0, status: 'not_started', terrain: 'moderate' },
  ]
  for (const u of vanessaUnits) {
    rows.push({
      id: id(u.slug),
      contract_id: id('vanessa'),
      name: u.name,
      amount: u.amount,
      amount_type: 'tree',
      completed_amount: u.completed,
      status: u.status,
      terrain_difficulty: u.terrain,
      acres: 18,
      notes: null,
      created_at: '2025-10-15T00:00:00Z',
      updated_at: '2026-05-01T00:00:00Z',
    })
  }
  // Kirk units
  const kirkUnits = [
    { slug: 'silver-u1', name: 'silver u1', amount: 4400, completed: 4400, status: 'completed' },
    { slug: 'silver-u2', name: 'silver u2', amount: 4100, completed: 1800, status: 'in_progress' },
    { slug: 'kirk-u4', name: 'kirk u4', amount: 3900, completed: 3900, status: 'completed' },
    { slug: 'kirk-u7', name: 'kirk u7', amount: 4200, completed: 0, status: 'not_started' },
  ]
  for (const u of kirkUnits) {
    rows.push({
      id: id(u.slug),
      contract_id: id('kirk'),
      name: u.name,
      amount: u.amount,
      amount_type: 'tree',
      completed_amount: u.completed,
      status: u.status,
      terrain_difficulty: 'moderate',
      acres: 21,
      notes: null,
      created_at: '2025-11-01T00:00:00Z',
      updated_at: '2026-05-01T00:00:00Z',
    })
  }
  // Cedar units
  const cedarUnits = [
    { slug: 'cedar-a1', name: 'cedar A1', amount: 3500, completed: 3500, status: 'completed' },
    { slug: 'cedar-a2', name: 'cedar A2', amount: 3200, completed: 1900, status: 'in_progress' },
    { slug: 'cedar-b1', name: 'cedar B1', amount: 3000, completed: 0, status: 'not_started' },
  ]
  for (const u of cedarUnits) {
    rows.push({
      id: id(u.slug),
      contract_id: id('cedar'),
      name: u.name,
      amount: u.amount,
      amount_type: 'tree',
      completed_amount: u.completed,
      status: u.status,
      terrain_difficulty: 'moderate',
      acres: 22,
      notes: null,
      created_at: '2025-11-15T00:00:00Z',
      updated_at: '2026-05-01T00:00:00Z',
    })
  }
  return rows
}

const units = makeUnits()

const unitDraws = [
  { id: id('drw-mu1-1'), unit_id: id('midge-u1'), draw_number: 1, amount: 2150, draw_date: '2026-04-25', status: 'approved', notes: null, created_at: '2026-04-25T00:00:00Z' },
  { id: id('drw-q3-1'), unit_id: id('quaker-u3'), draw_number: 1, amount: 1200, draw_date: '2026-04-18', status: 'paid', notes: null, created_at: '2026-04-18T00:00:00Z' },
  { id: id('drw-q3-2'), unit_id: id('quaker-u3'), draw_number: 2, amount: 1200, draw_date: '2026-05-02', status: 'submitted', notes: null, created_at: '2026-05-02T00:00:00Z' },
  { id: id('drw-sv2-1'), unit_id: id('silver-u2'), draw_number: 1, amount: 1800, draw_date: '2026-04-30', status: 'inspected', notes: null, created_at: '2026-04-30T00:00:00Z' },
  { id: id('drw-ca2-1'), unit_id: id('cedar-a2'), draw_number: 1, amount: 1900, draw_date: '2026-05-05', status: 'submitted', notes: null, created_at: '2026-05-05T00:00:00Z' },
]

const crewSets = [
  {
    id: id('cs-agustin'),
    name: "Agustin's Crew",
    foreman_id: id('agustin'),
    company_id: CASCADIA_ID,
    is_active: true,
    notes: null,
    created_at: '2025-10-15T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
  },
  {
    id: id('cs-maya'),
    name: "Maya's Crew",
    foreman_id: id('maya'),
    company_id: CASCADIA_ID,
    is_active: true,
    notes: null,
    created_at: '2025-11-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
  },
  {
    id: id('cs-miguel'),
    name: "Miguel's Crew",
    foreman_id: id('miguel'),
    company_id: RAMOS_ID,
    is_active: true,
    notes: null,
    created_at: '2025-11-15T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
  },
]

const crewSetMembers = [
  { id: id('csm-1'), crew_set_id: id('cs-agustin'), employee_id: id('marco'), created_at: '2025-10-15T00:00:00Z' },
  { id: id('csm-2'), crew_set_id: id('cs-agustin'), employee_id: id('luis'), created_at: '2025-10-15T00:00:00Z' },
  { id: id('csm-3'), crew_set_id: id('cs-agustin'), employee_id: id('elena'), created_at: '2025-10-15T00:00:00Z' },
  { id: id('csm-4'), crew_set_id: id('cs-agustin'), employee_id: id('diego'), created_at: '2025-10-15T00:00:00Z' },
  { id: id('csm-5'), crew_set_id: id('cs-maya'), employee_id: id('carlos'), created_at: '2025-11-01T00:00:00Z' },
  { id: id('csm-6'), crew_set_id: id('cs-maya'), employee_id: id('luis'), created_at: '2025-11-01T00:00:00Z' },
  { id: id('csm-7'), crew_set_id: id('cs-miguel'), employee_id: id('jose'), created_at: '2025-11-15T00:00:00Z' },
  { id: id('csm-8'), crew_set_id: id('cs-miguel'), employee_id: id('rosa'), created_at: '2025-11-15T00:00:00Z' },
]

const complianceItems = [
  { id: id('cmp-osha'), category: 'osha', title: 'OSHA 300A Annual Posting', due_date: daysAhead(8), status: 'due_soon', entity_id: null, entity_type: 'company', notes: 'Post by Feb 1 annually', created_at: '2026-01-01T00:00:00Z' },
  { id: id('cmp-herb'), category: 'training', title: 'Marco Perez. Herbicide License', due_date: daysAhead(7), status: 'due_soon', entity_id: id('marco'), entity_type: 'employee', notes: 'Renewal required', created_at: '2026-01-01T00:00:00Z' },
  { id: id('cmp-flc'), category: 'flc', title: 'FLC / FLCE License Renewal', due_date: daysAhead(50), status: 'upcoming', entity_id: null, entity_type: 'company', notes: 'Both companies', created_at: '2026-01-01T00:00:00Z' },
  { id: id('cmp-dl-diego'), category: 'training', title: "Diego Vargas. Driver's License Renewal", due_date: daysAhead(22), status: 'due_soon', entity_id: id('diego'), entity_type: 'employee', notes: null, created_at: '2026-01-01T00:00:00Z' },
  { id: id('cmp-h2b'), category: 'h2b', title: 'H2B Reimbursement Processing', due_date: daysAhead(14), status: 'upcoming', entity_id: null, entity_type: 'company', notes: 'Travel reimbursements', created_at: '2026-01-01T00:00:00Z' },
]

const timesheets = [
  { id: id('ts-1'), date: daysAhead(-1), foreman_id: id('agustin'), contract_id: id('vanessa'), status: 'submitted', total_hours: 96, crew_count: 11, notes: null, created_at: daysAhead(-1) + 'T17:00:00Z', updated_at: daysAhead(-1) + 'T17:00:00Z' },
  { id: id('ts-2'), date: daysAhead(-2), foreman_id: id('agustin'), contract_id: id('vanessa'), status: 'approved', total_hours: 96, crew_count: 12, notes: null, created_at: daysAhead(-2) + 'T17:00:00Z', updated_at: daysAhead(-2) + 'T17:00:00Z' },
  { id: id('ts-3'), date: daysAhead(-2), foreman_id: id('maya'), contract_id: id('kirk'), status: 'approved', total_hours: 112, crew_count: 14, notes: null, created_at: daysAhead(-2) + 'T17:30:00Z', updated_at: daysAhead(-2) + 'T17:30:00Z' },
  { id: id('ts-4'), date: daysAhead(-3), foreman_id: id('agustin'), contract_id: id('vanessa'), status: 'approved', total_hours: 94.5, crew_count: 12, notes: null, created_at: daysAhead(-3) + 'T17:00:00Z', updated_at: daysAhead(-3) + 'T17:00:00Z' },
  { id: id('ts-5'), date: daysAhead(-3), foreman_id: id('maya'), contract_id: id('kirk'), status: 'approved', total_hours: 108, crew_count: 14, notes: null, created_at: daysAhead(-3) + 'T17:00:00Z', updated_at: daysAhead(-3) + 'T17:00:00Z' },
  { id: id('ts-6'), date: daysAhead(-4), foreman_id: id('agustin'), contract_id: id('vanessa'), status: 'approved', total_hours: 97, crew_count: 12, notes: null, created_at: daysAhead(-4) + 'T17:00:00Z', updated_at: daysAhead(-4) + 'T17:00:00Z' },
  { id: id('ts-7'), date: daysAhead(-1), foreman_id: id('miguel'), contract_id: id('cedar'), status: 'submitted', total_hours: 88, crew_count: 11, notes: null, created_at: daysAhead(-1) + 'T17:00:00Z', updated_at: daysAhead(-1) + 'T17:00:00Z' },
]

const timesheetEntries: Record<string, unknown>[] = []
for (const ts of timesheets) {
  timesheetEntries.push({
    id: id('tse-' + (ts.id as string).slice(0, 5)),
    timesheet_id: ts.id,
    employee_id: id('marco'),
    hours: 8,
    ot_hours: 0,
    drive_hours: 0,
    notes: null,
    created_at: ts.created_at,
  })
}

const timesheetUnitHours = timesheets.flatMap(ts => [
  {
    id: id('tsu-' + (ts.id as string).slice(0, 5)),
    timesheet_id: ts.id,
    unit_id: ts.contract_id === id('vanessa') ? id('midge-u1') : ts.contract_id === id('kirk') ? id('silver-u2') : id('cedar-a2'),
    hours: ts.total_hours,
    production: Math.round((ts.total_hours as number) * 60),
    production_type: 'tree',
    daily_status: 'in_progress',
    created_at: ts.created_at,
  },
])

const productionLogs = timesheets.flatMap(ts => [
  {
    id: id('pl-' + (ts.id as string).slice(0, 5)),
    date: ts.date,
    contract_id: ts.contract_id,
    unit_id: ts.contract_id === id('vanessa') ? id('midge-u1') : ts.contract_id === id('kirk') ? id('silver-u2') : id('cedar-a2'),
    crew_set_id: ts.foreman_id === id('agustin') ? id('cs-agustin') : ts.foreman_id === id('maya') ? id('cs-maya') : id('cs-miguel'),
    production: Math.round((ts.total_hours as number) * 60),
    production_type: 'tree',
    notes: null,
    created_at: ts.created_at,
  },
])

const contractContacts = [
  { id: id('cc-van-1'), contract_id: id('vanessa'), name: 'Brian Sutter', role: 'Landowner Rep', phone: '360-555-0301', email: 'bsutter@weyerhaeuser.example', notes: 'Primary contact', created_at: '2025-09-01T00:00:00Z' },
  { id: id('cc-kirk-1'), contract_id: id('kirk'), name: 'Brian Sutter', role: 'Landowner Rep', phone: '360-555-0301', email: 'bsutter@weyerhaeuser.example', notes: null, created_at: '2025-10-01T00:00:00Z' },
  { id: id('cc-cedar-1'), contract_id: id('cedar'), name: 'Tom Rasmussen', role: 'Landowner Rep', phone: '541-555-0601', email: 'trasmussen@hancock.example', notes: null, created_at: '2025-10-15T00:00:00Z' },
]

export const demoFixtures: Record<string, Record<string, unknown>[]> = {
  companies,
  employees,
  contracts,
  work_types: workTypes,
  units,
  unit_draws: unitDraws,
  crew_sets: crewSets,
  crew_set_members: crewSetMembers,
  compliance_items: complianceItems,
  timesheets,
  timesheet_entries: timesheetEntries,
  timesheet_unit_hours: timesheetUnitHours,
  timesheet_photos: [],
  production_logs: productionLogs,
  contract_contacts: contractContacts,
  notifications: [],
  foreman_favorites: [],
  vehicles: [],
  expenses: [],
}

export function filterByColumn(
  rows: Record<string, unknown>[],
  column: string,
  value: unknown,
): Record<string, unknown>[] {
  return rows.filter(r => r[column] === value)
}

export function sortByColumn(
  rows: Record<string, unknown>[],
  column: string,
  ascending: boolean,
): Record<string, unknown>[] {
  const sorted = [...rows].sort((a, b) => {
    const av = a[column]
    const bv = b[column]
    if (av === bv) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'number' && typeof bv === 'number') return av - bv
    return String(av).localeCompare(String(bv))
  })
  return ascending ? sorted : sorted.reverse()
}

/**
 * Resolve a table name to its demo rows, optionally filtered and sorted.
 * Returns an empty array for any table not in the fixture map (rather
 * than throwing) so unknown tables degrade silently to empty UI states.
 */
export function getDemoRows(
  table: string,
  options?: {
    filter?: { column: string; value: unknown }
    orderBy?: string
    ascending?: boolean
  },
): Record<string, unknown>[] {
  const rows = demoFixtures[table] ?? []
  let result = rows
  if (options?.filter) {
    result = filterByColumn(result, options.filter.column, options.filter.value)
  }
  if (options?.orderBy) {
    result = sortByColumn(result, options.orderBy, options.ascending ?? true)
  }
  return result
}
