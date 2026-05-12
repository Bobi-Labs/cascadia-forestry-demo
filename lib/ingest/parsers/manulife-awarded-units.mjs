/**
 * Manulife "Awarded Units" xlsx parser.
 *
 * Format tag: `manulife-awarded-units-xlsx` (see lib/ingest/landowner-detect.mjs).
 * Parser mode: A (structured spreadsheet).
 *
 * Source columns (verified against `Copy of Ramos Awarded Units (1).xlsx`,
 * 24 unit rows + 1 header row):
 *
 *   Activity Category    →  units.work_type
 *   Season               →  notes (no canonical field; e.g. "Fall")
 *   Activity Category2   →  (skipped — duplicate of Activity Category in samples)
 *   GIS Area             →  units.amount
 *   GIS Area Unit Type   →  units.amount_type  ('acres' string → 'acre' enum)
 *   Primary State or Province  →  units.state
 *   Primary County       →  units.county
 *   Property             →  units.notes  (tract / parent area; e.g. "Long Canyon")
 *   CommonName           →  units.name   (the unit display name)
 *   PlannedYear          →  notes  (e.g. 2026)
 *   Spacing              →  units.target_spacing  (e.g. "14x14")
 *   Ramos                →  units.price_per_unit  (per-unit bid)
 *   awarded Bid          →  (skipped — duplicate of Ramos in our samples)
 *   Total                →  (skipped — derived = price_per_unit × amount)
 *   Awardee              →  (skipped — always "Ramos" in this dataset)
 *
 * The parser returns { canonicalRow, sourceRow, unmappedFields } per
 * source row. `unmappedFields` captures anything that didn't map to a
 * units column, so the office-review queue can show provenance and we
 * can extend the schema later without losing data.
 *
 * No DB writes here. The orchestrator (lib/ingest/process-batch.mjs)
 * handles contract lookup, conflict resolution against existing units,
 * and either inserts to units or queues to unit_pending_review.
 */

// Webpack/Next is stricter than Node's CJS interop — `import XLSX from
// "xlsx"` works at runtime via node but fails at build with
// "does not contain a default export". Use the namespace form.
import * as XLSX from "xlsx";
import { canonicalizeState, canonicalizeWorkType } from "../canonicalize.mjs";
import { extractLocation } from "../extract-location.mjs";

/** Stable identifier for this parser. Stored on column-map rows + audit entries. */
export const FORMAT_TAG = "manulife-awarded-units-xlsx";
export const PARSER_VERSION = 1;

/**
 * Run the parser against an xlsx buffer. Pure function — no IO.
 *
 * @param {Buffer | ArrayBuffer | Uint8Array} buffer  xlsx file bytes
 * @returns {{
 *   formatTag: string,
 *   version: number,
 *   rowCount: number,
 *   parsed: Array<{
 *     canonicalRow: Record<string, unknown>,
 *     sourceRow: Record<string, unknown>,
 *     unmappedFields: Record<string, unknown>,
 *     warnings: string[],
 *   }>,
 *   sheetWarnings: string[],
 * }}
 */
export function parseManulifeAwardedUnits(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetWarnings = [];
  const parsed = [];

  if (wb.SheetNames.length === 0) {
    sheetWarnings.push("xlsx had no sheets");
    return { formatTag: FORMAT_TAG, version: PARSER_VERSION, rowCount: 0, parsed, sheetWarnings };
  }

  // Use the first sheet — Manulife xlsx samples we've seen are single-sheet.
  // If a future sample is multi-sheet, the office review queue will surface
  // the extra rows so we can update the parser.
  const firstSheet = wb.SheetNames[0];
  if (wb.SheetNames.length > 1) {
    sheetWarnings.push(
      `xlsx has ${wb.SheetNames.length} sheets; only "${firstSheet}" is parsed`,
    );
  }

  const ws = wb.Sheets[firstSheet];
  /** @type {Array<Record<string, unknown>>} */
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });

  // Normalize header keys — Manulife xlsx samples have leading/trailing
  // whitespace on some headers (e.g. " awarded Bid ", " Total "). Trim
  // them so column matching works without per-variant header aliases.
  const rows = rawRows.map((r) => {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(r)) {
      out[String(k).trim()] = v;
    }
    return out;
  });

  // Universal location pass — join every cell value into one text blob
  // and scan for GPS / township. xlsx is structured so this rarely
  // matches (Manulife awarded-units doesn't carry GPS today), but the
  // hook is in place so if a future xlsx adds a GPS column it lands
  // automatically without parser changes.
  const allText = rawRows
    .flatMap((r) => Object.values(r))
    .filter((v) => v != null)
    .map((v) => String(v))
    .join(" ");
  const sharedLocation = extractLocation(allText);

  for (const sourceRow of rows) {
    const warnings = [];
    const unmappedFields = {};
    const canonicalRow = {};

    // Required: name (CommonName). Skip rows with no name silently —
    // they're typically totals / footer rows on a Manulife xlsx.
    const name = pickString(sourceRow, ["CommonName", "Common Name", "Unit Name", "Unit"]);
    if (!name) {
      // Don't add a parsed entry for footer/blank rows — keeps the
      // pending-review queue clean. If a row genuinely has data but no
      // name, we'd need to detect that here; for the Manulife format
      // every real unit row has CommonName populated.
      continue;
    }
    canonicalRow.name = name;

    // Optional fields (each lookup tolerant of common header variants)
    const acres = pickNumber(sourceRow, ["GIS Area", "Acres", "GIS Acres"]);
    if (acres !== null) {
      canonicalRow.amount = acres;
      const unitType = pickString(sourceRow, ["GIS Area Unit Type", "Acre Unit", "Unit Type"]);
      if (unitType && /acres?/i.test(unitType)) canonicalRow.amount_type = "acre";
      else if (unitType) {
        warnings.push(`unrecognized GIS Area Unit Type: "${unitType}"`);
        unmappedFields.gis_area_unit_type = unitType;
      } else {
        canonicalRow.amount_type = "acre"; // sensible default for Manulife
      }
    }

    // State + work_type go through canonicalize.mjs so the proposed
    // unit matches the DB convention (2-letter state code, snake_case
    // work_type slug). Without this the orchestrator's diff thinks
    // "Washington" ≠ "WA" and "Crop Maintenance" ≠ "crop_maintenance",
    // and every existing-unit re-import gets queued for review even
    // when nothing actually changed.
    const state = pickString(sourceRow, ["Primary State or Province", "State"]);
    if (state) canonicalRow.state = canonicalizeState(state);

    const county = pickString(sourceRow, ["Primary County", "County"]);
    if (county) canonicalRow.county = county;

    const spacing = pickString(sourceRow, ["Spacing", "Target Spacing"]);
    if (spacing) canonicalRow.target_spacing = spacing;

    const workType = pickString(sourceRow, ["Activity Category", "Work Type", "Activity"]);
    if (workType) canonicalRow.work_type = canonicalizeWorkType(workType);

    const pricePerUnit = pickNumber(sourceRow, ["Ramos", "awarded Bid", "Price", "Bid"]);
    if (pricePerUnit !== null) canonicalRow.price_per_unit = pricePerUnit;

    // Property = tract / parent area (e.g. "Long Canyon", "Silver Mountain").
    // No first-class units column for tract; stash in notes for now so the
    // context isn't lost. PlannedYear + Season similarly preserved.
    const noteParts = [];
    const property = pickString(sourceRow, ["Property", "Tract"]);
    if (property) noteParts.push(`Property: ${property}`);
    const plannedYear = pickNumber(sourceRow, ["PlannedYear", "Planned Year", "Year"]);
    if (plannedYear !== null) noteParts.push(`Year: ${plannedYear}`);
    const season = pickString(sourceRow, ["Season"]);
    if (season) noteParts.push(`Season: ${season}`);
    if (noteParts.length > 0) canonicalRow.notes = noteParts.join(" · ");
    if (sharedLocation.latitude != null) canonicalRow.latitude = sharedLocation.latitude;
    if (sharedLocation.longitude != null) canonicalRow.longitude = sharedLocation.longitude;
    if (sharedLocation.township_range) canonicalRow.township_range = sharedLocation.township_range;

    // Capture every other column as unmapped — preserved for review and
    // potential schema extension. Strip null/undefined so the JSON is lean.
    const KNOWN_HEADERS = new Set([
      "CommonName", "Common Name", "Unit Name", "Unit",
      "GIS Area", "Acres", "GIS Acres",
      "GIS Area Unit Type", "Acre Unit", "Unit Type",
      "Primary State or Province", "State",
      "Primary County", "County",
      "Spacing", "Target Spacing",
      "Activity Category", "Work Type", "Activity",
      "Ramos", "awarded Bid", "Price", "Bid",
      "Property", "Tract",
      "PlannedYear", "Planned Year", "Year",
      "Season",
      // Known-but-skipped (recorded as duplicates / derived in our samples)
      "Activity Category2", "Total", "Awardee", "Awarded Contractr", "Awarded Contractor",
    ]);
    for (const [k, v] of Object.entries(sourceRow)) {
      if (KNOWN_HEADERS.has(k)) continue;
      if (v === null || v === undefined || v === "") continue;
      unmappedFields[k] = v;
    }

    parsed.push({
      canonicalRow,
      sourceRow,
      unmappedFields,
      warnings,
    });
  }

  return {
    formatTag: FORMAT_TAG,
    version: PARSER_VERSION,
    rowCount: rows.length,
    parsed,
    sheetWarnings,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Pick the first non-null, non-empty STRING value across header aliases. */
function pickString(row, headers) {
  for (const h of headers) {
    const v = row[h];
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s.length > 0) return s;
  }
  return null;
}

/** Pick the first numeric value across header aliases. Coerces strings if parseable. */
function pickNumber(row, headers) {
  for (const h of headers) {
    const v = row[h];
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v.replace(/[$,\s]/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}
