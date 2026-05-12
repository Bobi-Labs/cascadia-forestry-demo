/**
 * Expense CSV parser — transforms Jaime's Credit Card Master Sheet CSV
 * into structured expense records ready for DB insertion.
 *
 * This file is intentionally pure — no DB calls, no network calls.
 * It takes a CSV string in, gives structured data out. Makes it trivial
 * to unit test.
 *
 * Handles the real-world messiness of the sheet:
 * - 23 unique cardholder name variants for ~10 people (case variants)
 * - Amex hierarchical categories ("Transportation-Fuel" → category "fuel", subcategory "transportation")
 * - "Business Card" as a shared cardholder with no specific employee
 * - Negative amounts (refunds/credits)
 * - Multi-line descriptions inside quoted CSV fields
 * - Company already specified per row (Cascadia Forestry Inc / Ramos Reforestation Inc)
 * - Dates already in ISO format (2026-03-27)
 */

import crypto from "crypto";
import * as XLSX from "xlsx";

export type RawRow = Record<string, string | number | undefined>;

export type ParsedExpense = {
  // Core
  amount: number;
  date: string; // ISO 8601
  vendor: string | null;
  description: string | null;
  category: ExpenseCategory;
  subcategory: string | null; // Amex hierarchical second half
  amex_category_raw: string | null; // original "Transportation-Fuel" preserved
  source: "credit_card_import";
  transaction_type: "expense" | "payment" | "fee"; // 'payment' = bill payment, not real expense

  // Company routing
  company_id: string | null; // resolved from Company column
  company_raw: string | null; // "Cascadia Forestry Inc"

  // Card info
  card_company: string | null; // AMEX / CHASE
  card_last4: string | null;
  cardholder_name: string | null; // raw from sheet
  payment_method: string | null; // derived: "AMEX 1234"
  crew_member: string | null; // distinct from cardholder for Business Card

  // Contract (empty in sheet — will be set by auto-match)
  contract_number: string | null;
  contract_id: string | null; // always null at parse time

  // Employee (will be resolved via cardholder_employee_map in the import step)
  employee_id: string | null;

  // Dates
  post_date: string | null;
  work_date: string | null;
  import_timestamp: string | null;

  // Location
  location_city: string | null;
  location_state: string | null;
  statement_description: string | null;

  // Vehicle / odometer
  vehicle_id: string | null; // will be resolved from Vehicle ID column if present
  odometer_start: number | null;
  odometer_end: number | null;

  // Misc
  notes: string | null;
  source_file: string | null;

  // Audit / dedup
  raw_row_hash: string;

  // Quality flags — set during parsing when critical fields are missing.
  // Stored as text[] in the DB so we can query "show me all rows with issues."
  quality_flags: string[];
};

/**
 * Expense categories — the 15-bucket schema agreed on the 2026-04-24 data call.
 *
 * Organized into four groups for reporting:
 *   Vehicle:   fuel, vehicle_maintenance, vehicle_rental
 *   Travel:    lodging, airfare_transit, tolls_parking
 *   Supplies:  meals, groceries, equipment, chainsaw, safety_gear
 *   Overhead:  office_admin, professional_services, fees_insurance, other
 *
 * Three enum values were renamed from the original 8-bucket schema:
 *   hotel          → lodging              (widened to include motels, RV parks)
 *   food           → meals                (narrowed — groceries split out)
 *   vehicle_repair → vehicle_maintenance  (includes oil changes, tires, service)
 *
 * Seven were added. See supabase/migrations/20260424000000_expand_expense_categories.sql
 * and scripts/remap-expense-categories.mjs for the one-time remap.
 */
export type ExpenseCategory =
  // Vehicle
  | "fuel"
  | "vehicle_maintenance"
  | "vehicle_rental"
  // Travel
  | "lodging"
  | "airfare_transit"
  | "tolls_parking"
  // Supplies
  | "meals"
  | "groceries"
  | "equipment"
  | "chainsaw"
  | "safety_gear"
  // Overhead
  | "office_admin"
  | "professional_services"
  | "fees_insurance"
  | "other";

export type ParseWarning = {
  rowIndex: number;
  message: string;
  fields: string[];
};

export type ParseResult = {
  parsed: ParsedExpense[];
  errors: Array<{ rowIndex: number; message: string; raw: RawRow }>;
  warnings: ParseWarning[];
  totalRows: number;
};

/** Company name strings from the sheet, mapped to our UUIDs. */
const CASCADIA_ID = "00000000-0000-0000-0000-000000000001";
const RAMOS_ID = "00000000-0000-0000-0000-000000000002";

function resolveCompany(companyRaw: string | undefined): string | null {
  if (!companyRaw) return null;
  const normalized = companyRaw.trim().toLowerCase();
  if (normalized.includes("cascadia")) return CASCADIA_ID;
  if (normalized.includes("ramos")) return RAMOS_ID;
  return null;
}

/**
 * Parse an Amex hierarchical category ("Transportation-Fuel") into
 * a main category and subcategory. Falls back gracefully for flat strings.
 */
function parseHierarchicalCategory(raw: string | undefined): {
  subcategory: string | null;
  amexCategoryRaw: string | null;
} {
  if (!raw) return { subcategory: null, amexCategoryRaw: null };
  const trimmed = raw.trim();
  if (!trimmed) return { subcategory: null, amexCategoryRaw: null };

  // Split on hyphen — "Transportation-Fuel" → ["Transportation", "Fuel"]
  // Use first hyphen only; some subcategories have hyphens in them
  const idx = trimmed.indexOf("-");
  if (idx === -1) {
    return { subcategory: null, amexCategoryRaw: trimmed };
  }
  const sub = trimmed.slice(idx + 1).trim();
  return { subcategory: sub || null, amexCategoryRaw: trimmed };
}

/**
 * Map a raw sheet category string to our DB enum. Uses the sheet_category_map
 * passed in by the caller (seeded from DB). Unmapped → "other".
 *
 * Match order: exact → case-insensitive exact → top-level exact → "other".
 *
 * Historical note — there used to be a startsWith fallback here
 * ("Travel" would match "Travel-Lodging"). That fallback silently
 * misclassified tolls as hotels and other ambiguous top-levels; it was
 * removed on 2026-04-24 after the audit. The fix: seed the map with
 * explicit entries for every amex_category_raw value we've seen in
 * production, and a safe default for bare top-levels (e.g. "Travel" →
 * "other"). Vendor-name patterns can still pin the correct bucket at
 * import time — see the caller in app/api/expenses/import/route.ts.
 */
export function resolveCategory(
  rawCategory: string | undefined,
  categoryMap: Map<string, ExpenseCategory>,
): ExpenseCategory {
  if (!rawCategory) return "other";
  const trimmed = rawCategory.trim();
  if (!trimmed) return "other";

  // 1. Exact match
  const exact = categoryMap.get(trimmed);
  if (exact) return exact;

  // 2. Case-insensitive exact match
  for (const [key, value] of categoryMap.entries()) {
    if (key.toLowerCase() === trimmed.toLowerCase()) return value;
  }

  // 3. Top-level exact match — "Transportation-Fuel" → try "Transportation"
  //    This is a safer fallback than the old startsWith scan because it
  //    requires the bare top-level to be explicitly mapped, not any key
  //    that happens to share a prefix.
  const topLevel = trimmed.split("-")[0].trim();
  if (topLevel && topLevel !== trimmed) {
    const topExact = categoryMap.get(topLevel);
    if (topExact) return topExact;
    for (const [key, value] of categoryMap.entries()) {
      if (key.toLowerCase() === topLevel.toLowerCase()) return value;
    }
  }

  return "other";
}

/**
 * Parse a date value. The live sheet has dates already in ISO format
 * ("2026-03-27"), but we handle Excel serial numbers and US-format dates
 * as fallbacks for safety.
 */
function parseDate(value: string | number | Date | undefined | null): string | null {
  if (value === undefined || value === null || value === "") return null;

  // JS Date object — cellDates: true in xlsx returns these.
  // The xlsx library decodes Excel serial dates into JS Date objects using
  // UTC. Extract the date using UTC methods to avoid local-timezone shifts.
  // Do NOT adjust by subtracting hours — that causes off-by-one errors.
  if (value instanceof Date) {
    // Guard against invalid dates
    if (isNaN(value.getTime())) return null;
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    // Sanity check — dates should be in a reasonable range (2000-2100)
    if (y < 2000 || y > 2100) return null;
    return `${y}-${m}-${d}`;
  }

  // Excel serial number (number or numeric string) — kept as fallback
  // for CSV mode where cellDates doesn't apply.
  if (typeof value === "number" || /^\d+(\.\d+)?$/.test(String(value))) {
    const serial = typeof value === "number" ? value : parseFloat(String(value));
    // Only treat as Excel serial if reasonable (between 1/1/2000 and 1/1/2100)
    if (serial > 36526 && serial < 73051) {
      const date = new Date((serial - 25569) * 86400000);
      return date.toISOString().split("T")[0];
    }
  }

  const str = String(value).trim();

  // ISO format (2026-03-27 or 2026-03-27T00:00:00)
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // US format (3/27/2026 or 03/27/2026)
  const usMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    const m = usMatch[1].padStart(2, "0");
    const d = usMatch[2].padStart(2, "0");
    return `${usMatch[3]}-${m}-${d}`;
  }

  return null;
}

/**
 * Parse an amount value. Handles strings with $, commas, parentheses (negatives),
 * and passes through numbers directly. Allows negatives (refunds).
 */
function parseAmount(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return value;

  let str = String(value).trim();
  if (!str) return null;

  // Accounting-style negatives: "(123.45)" → -123.45
  let isNegative = false;
  if (str.startsWith("(") && str.endsWith(")")) {
    isNegative = true;
    str = str.slice(1, -1);
  }

  // Strip $, commas, spaces
  str = str.replace(/[$,\s]/g, "");

  const n = Number(str);
  if (isNaN(n)) return null;
  return isNegative ? -n : n;
}

/**
 * Parse card last 4. The sheet sometimes stores it as a negative number
 * (-22039) which is how Excel handles leading-zero text fields. We strip
 * the sign and pad to 4 digits. Also handles "XXXX1234" format.
 */
function parseCardLast4(value: string | number | undefined): string | null {
  if (value === undefined || value === null || value === "") return null;
  const str = String(value).trim();
  if (!str) return null;

  // Extract just the digits
  const digits = str.replace(/\D/g, "");
  if (!digits) return null;

  // Take last 4
  return digits.slice(-4).padStart(4, "0");
}

/**
 * Parse an integer (for odometer). Returns null for invalid/empty.
 */
function parseInt(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Math.round(value);
  const n = Number(String(value).trim().replace(/,/g, ""));
  return isNaN(n) ? null : Math.round(n);
}

/**
 * Normalize a cardholder name for map lookup. The live sheet has 23 variants
 * for ~10 people — we strip extra spaces and lowercase to maximize matches.
 */
export function normalizeCardholder(name: string | undefined): string {
  if (!name) return "";
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Detect rows that are credit card bill payments (not real expenses).
 * The Credit Card Master Sheet contains rows like "AUTOPAY PAYMENT — THANK YOU"
 * which are credits posted when Jaime pays the card balance. They have no
 * merchant category code and inflate cardholder rollups if treated as expenses.
 */
export function classifyTransactionType(
  vendor: string | null,
  amexCategoryRaw: string | null,
): "expense" | "payment" | "fee" {
  if (!vendor) return "expense";
  const v = vendor.toUpperCase();
  if (
    v.includes("AUTOPAY PAYMENT") ||
    v.includes("AUTOMATIC PAYMENT") ||
    v.includes("PAYMENT THANK YOU") ||
    v.includes("PAYMENT - THANK") ||
    v.includes("PAYMENT THANK") ||
    v.startsWith("PAYMENT THANK YOU")
  ) {
    return "payment";
  }
  // Future-hook: detect annual fees, finance charges → 'fee'
  // For now, leave them as 'expense' until we have a clear use case.
  return "expense";
}

/**
 * Compute a deterministic hash for deduplication. Based on the fields that
 * uniquely identify a transaction: date, cardholder, vendor, amount, description.
 * Running the same import twice will produce identical hashes → skip duplicates.
 */
export function computeRowHash(row: {
  date: string;
  cardholder_name: string | null;
  vendor: string | null;
  amount: number;
  description: string | null;
}): string {
  const canonical = [
    row.date,
    (row.cardholder_name || "").trim().toLowerCase(),
    (row.vendor || "").trim(),
    row.amount.toFixed(2),
    (row.description || "").trim(),
  ].join("|");
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Columns that MUST be present for a sheet tab to be treated as an
 * expense tab. If a tab doesn't have at least these, it's skipped.
 * This is how we safely ignore tabs like "Unit Tracking" that live in
 * the same spreadsheet but have completely different data.
 */
const REQUIRED_EXPENSE_COLUMNS = new Set([
  "TransactionDate",
  "Amount",
]);

/**
 * Additional columns we look for to boost confidence. A tab with
 * TransactionDate + Amount + at least one of these is definitely
 * an expense tab.
 */
const BONUS_EXPENSE_COLUMNS = new Set([
  "CardMember",
  "Description",
  "Category",
  "Company",
  "CardCompany",
  "Date",
]);

/**
 * Check if a sheet tab has the expected expense columns.
 * Returns true if it has all required columns + at least one bonus column.
 */
function isExpenseTab(sheet: XLSX.WorkSheet): boolean {
  // Read the HEADER ROW directly from sheet cells, not from sheet_to_json.
  // sheet_to_json omits keys when a data cell is empty, which causes tabs
  // with empty Amount cells to fail the check and get silently skipped.
  // Reading the raw header row (row 1) avoids this — column names are
  // always present regardless of whether the data cells have values.
  const headers = new Set<string>();
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: col });
    const cell = sheet[cellAddr];
    if (cell && cell.v !== undefined && cell.v !== null) {
      headers.add(String(cell.v).trim());
    }
  }

  if (headers.size === 0) return false;

  // Must have ALL required columns
  for (const col of REQUIRED_EXPENSE_COLUMNS) {
    if (!headers.has(col)) return false;
  }

  // Must have at least one bonus column (to avoid false positives on
  // random tabs that happen to have "Amount" and "TransactionDate")
  for (const col of BONUS_EXPENSE_COLUMNS) {
    if (headers.has(col)) return true;
  }

  return false;
}

/**
 * Parse expense data from a workbook (CSV string or XLSX buffer).
 *
 * Supports two input modes:
 *   - CSV string: legacy single-tab mode (reads first sheet only)
 *   - XLSX buffer: multi-tab mode (iterates ALL sheets, skips non-expense tabs)
 *
 * The multi-tab mode is the primary path. Each tab that passes the
 * column-header check gets parsed, and results are merged. Dedup by
 * raw_row_hash happens downstream in the import route, so duplicate
 * rows across tabs are handled correctly.
 *
 * @param content - CSV string OR XLSX Buffer
 * @param categoryMap - Map from sheet category strings to our enum values
 * @returns ParseResult with parsed rows, errors per row, totals, and tab info
 */
export function parseCreditCardCsv(
  content: string | Buffer,
  categoryMap: Map<string, ExpenseCategory>,
): ParseResult & { tabsProcessed: string[]; tabsSkipped: string[] } {
  const isBuffer = Buffer.isBuffer(content);
  // cellDates: true tells the xlsx library to convert Excel serial dates
  // into JS Date objects instead of leaving them as numbers. This avoids
  // the off-by-one day bug we hit when doing the serial→date math ourselves
  // (Google Sheets XLSX export serial dates were landing +1 day vs the CSV
  // export for the same row). By letting xlsx handle the conversion, we get
  // consistent dates regardless of export format.
  const workbook = isBuffer
    ? XLSX.read(content, { type: "buffer", cellDates: true })
    : XLSX.read(content, { type: "string", cellDates: true });

  if (workbook.SheetNames.length === 0) {
    return {
      parsed: [],
      errors: [{ rowIndex: 0, message: "No sheets in workbook", raw: {} }],
      warnings: [],
      totalRows: 0,
      tabsProcessed: [],
      tabsSkipped: [],
    };
  }

  const parsed: ParsedExpense[] = [];
  const errors: ParseResult["errors"] = [];
  const warnings: ParseWarning[] = [];
  const tabsProcessed: string[] = [];
  const tabsSkipped: string[] = [];

  // Iterate ALL tabs — detect expense tabs by column headers
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      tabsSkipped.push(sheetName);
      continue;
    }

    // Check if this tab has expense-like columns
    if (!isExpenseTab(sheet)) {
      tabsSkipped.push(sheetName);
      continue;
    }

    tabsProcessed.push(sheetName);
    const rows: RawRow[] = XLSX.utils.sheet_to_json(sheet);

    parseRowsFromTab(rows, sheetName, categoryMap, parsed, errors, warnings);
  }

  return {
    parsed,
    errors,
    warnings,
    totalRows: parsed.length + errors.length,
    tabsProcessed,
    tabsSkipped,
  };
}

/**
 * Parse rows from a single tab. Shared logic extracted so both
 * single-tab and multi-tab paths use the same code.
 */
function parseRowsFromTab(
  rows: RawRow[],
  tabName: string,
  categoryMap: Map<string, ExpenseCategory>,
  parsed: ParsedExpense[],
  errors: ParseResult["errors"],
  warnings: ParseWarning[],
): void {

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // Parse amount and date — if invalid, DON'T skip the row.
      // Import it with amount=0 / date=today and flag it so it shows
      // in the Needs Attention section. Nothing should silently vanish.
      const earlyFlags: string[] = [];
      let amount = parseAmount(row.Amount);
      if (amount === null) {
        amount = 0;
        earlyFlags.push("invalid_amount");
      }

      let date = parseDate(row.TransactionDate ?? row.Date);
      if (!date) {
        date = new Date().toISOString().slice(0, 10); // fallback to today
        earlyFlags.push("invalid_date");
      }

      const vendor = typeof row.Description === "string" ? row.Description.trim() || null : null;
      const description = typeof row.ExtendedDetails === "string" ? row.ExtendedDetails.trim() || null : null;

      const rawCategory = row.Category ?? row.AmexCategory;
      const category = resolveCategory(typeof rawCategory === "string" ? rawCategory : undefined, categoryMap);
      const { subcategory, amexCategoryRaw } = parseHierarchicalCategory(
        typeof rawCategory === "string" ? rawCategory : undefined,
      );

      const companyRaw = typeof row.Company === "string" ? row.Company : null;
      const companyId = resolveCompany(companyRaw || undefined);

      const cardCompany = typeof row.CardCompany === "string" ? row.CardCompany.trim() || null : null;
      const cardLast4 = parseCardLast4(row.CardLast4);
      const cardholderRaw = typeof row.CardMember === "string" ? row.CardMember.trim() || null : null;
      const crewMember = typeof row.CrewMember === "string" ? row.CrewMember.trim() || null : null;

      // Skip "Business Card" rows — per Jaime (April 2026), this is the
      // owner's personal card and isn't tracked in the forestry ops system.
      // These rows get silently skipped during import so they never reach
      // the dashboard or office queue. If Jaime ever changes his mind,
      // remove this guard and run the reverse SQL in
      // scripts/migrate-expenses-hide-business-card.mjs.
      if (cardholderRaw && cardholderRaw.trim().toLowerCase() === "business card") {
        continue;
      }

      // Chase sign convention fix — Jaime's sheet stores Chase data with
      // the opposite sign convention from Amex:
      //   Amex:  positive = charge,          negative = refund/payment
      //   Chase: negative = charge,          positive = refund/payment
      // Jaime's sheet script hasn't been updated to normalize these yet,
      // so we flip the sign here on import. After this, the whole system
      // can assume the Amex convention everywhere: +charge, -refund.
      // A one-time DB backfill handles rows imported before this fix —
      // see scripts/archive/migrate-expenses-chase-sign-fix.mjs.
      // IMPORTANT: This runs BEFORE the row hash is computed so re-imports
      // of a Chase row match the flipped amount in the DB.
      const normalizedAmount =
        cardCompany && cardCompany.toUpperCase() === "CHASE" ? -amount : amount;

      const paymentMethod = cardCompany && cardLast4 ? `${cardCompany} ${cardLast4}` : cardCompany;

      const transactionType = classifyTransactionType(vendor, amexCategoryRaw);

      const record: ParsedExpense = {
        amount: normalizedAmount,
        date,
        vendor,
        description,
        category,
        subcategory,
        amex_category_raw: amexCategoryRaw,
        source: "credit_card_import",
        transaction_type: transactionType,

        company_id: companyId,
        company_raw: companyRaw,

        card_company: cardCompany,
        card_last4: cardLast4,
        cardholder_name: cardholderRaw,
        payment_method: paymentMethod,
        crew_member: crewMember,

        contract_number: typeof row.Contract === "string"
          ? row.Contract.trim() || null
          : typeof row.Project === "string"
            ? row.Project.trim() || null
            : null,
        contract_id: null, // always null at parse time; auto-match sets it later

        employee_id: null, // resolved via cardholder_employee_map during import

        post_date: parseDate(row.PostDate),
        work_date: parseDate(row.WorkDate),
        import_timestamp: parseDate(row.ImportTimestamp),

        location_city: null, // parsed below
        location_state: null,
        statement_description: typeof row.StatementName === "string" ? row.StatementName.trim() || null : null,

        vehicle_id: null, // Vehicle ID column stores text name; resolve to vehicles.id in import step
        odometer_start: parseInt(row.OdometerStart),
        odometer_end: parseInt(row.OdometerEnd),

        notes: typeof row.Notes === "string" ? row.Notes.trim() || null : null,
        source_file: typeof row.SourceFile === "string" ? row.SourceFile.trim() || null : null,

        raw_row_hash: "", // computed below
        quality_flags: [], // set below after field checks
      };

      // Parse CityState → city + state ("Longview, WA" or "LONGVIEW WA")
      const cityState = typeof row.CityState === "string" ? row.CityState.trim() : "";
      if (cityState) {
        // Try "City, ST" format first
        const commaMatch = cityState.match(/^(.+),\s*([A-Z]{2})$/i);
        if (commaMatch) {
          record.location_city = commaMatch[1].trim();
          record.location_state = commaMatch[2].toUpperCase();
        } else {
          // Try "CITY ST" format (last 2 chars uppercase)
          const spaceMatch = cityState.match(/^(.+)\s+([A-Z]{2})$/);
          if (spaceMatch) {
            record.location_city = spaceMatch[1].trim();
            record.location_state = spaceMatch[2].toUpperCase();
          } else {
            record.location_city = cityState;
          }
        }
      }

      // Compute dedup hash after all fields are set
      record.raw_row_hash = computeRowHash({
        date: record.date,
        cardholder_name: record.cardholder_name,
        vendor: record.vendor,
        amount: record.amount,
        description: record.description,
      });

      // Flag rows that parsed successfully but are missing critical fields.
      // These aren't errors (the row is valid enough to store) but they're
      // degraded and should be surfaced so Jaime can fix the source data.
      // Flags are stored on the record itself (quality_flags column) so
      // the "Needs Attention" section can query for them directly.
      const flags: string[] = [...earlyFlags];
      const warningParts: string[] = [];
      if (earlyFlags.includes("invalid_amount")) warningParts.push("amount (invalid or missing)");
      if (earlyFlags.includes("invalid_date")) warningParts.push("date (invalid or missing)");
      if (!record.vendor) {
        flags.push("missing_vendor");
        warningParts.push("vendor");
      }
      if (!record.cardholder_name) {
        flags.push("missing_cardholder");
        warningParts.push("cardholder");
      }
      if (record.category === "other") {
        const rawCat = typeof row.Category === "string" ? row.Category.trim() : "";
        // Only flag if the raw category is NOT in the map at all.
        // If it IS in the map but intentionally maps to "other" (e.g.,
        // "Bills & Utilities" → other), that's deliberate and shouldn't
        // trigger a warning. We only flag truly unknown categories.
        if (rawCat && !categoryMap.has(rawCat)) {
          // Also try case-insensitive before flagging
          let found = false;
          for (const key of categoryMap.keys()) {
            if (key.toLowerCase() === rawCat.toLowerCase()) { found = true; break; }
          }
          if (!found) {
            flags.push("unmapped_category");
            warningParts.push("category (unmapped: " + rawCat.slice(0, 30) + ")");
          }
        }
      }
      record.quality_flags = flags;
      if (warningParts.length > 0) {
        warnings.push({
          rowIndex: i + 2,
          message: `[${tabName}] Row missing: ${warningParts.join(", ")}`,
          fields: warningParts,
        });
      }

      parsed.push(record);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ rowIndex: i + 2, message: `[${tabName}] ${msg}`, raw: row });
    }
  }
}
