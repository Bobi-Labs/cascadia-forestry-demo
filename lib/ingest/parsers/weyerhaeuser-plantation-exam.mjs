/**
 * Weyerhaeuser PlantationExam PDF parser (Mode B).
 *
 * Format tags: `wy-plantation-exam-unit` (the data version)
 *              `wy-plantation-exam-photo` (photo-laden version, skipped)
 *
 * The PlantationExam_*.pdf files are SCANNED documents — image-only,
 * no text layer. Two extraction paths:
 *
 *   1. **OCR path (preferred)** — once Vision API is enabled on the
 *      Cascadia GCP project + the service account has the Cloud Vision
 *      API User role, the parser sends the PDF bytes to Vision OCR,
 *      regex-extracts acres / spacing / species / TPA / county from
 *      the resulting text, and lands a fully-populated canonical row.
 *
 *   2. **Filename fallback** — if Vision isn't enabled OR OCR returns
 *      nothing useful, fall back to extracting just the unit ID from
 *      the filename and queueing for office review with reason=
 *      'ocr_required'. Same behavior as before OCR support shipped.
 *
 * Photo variants (`PlantationExam_PhotoNoPlots_*.pdf`) are skipped —
 * they're 10MB+ image PDFs with no parseable structure beyond the unit
 * ID, and the data variant covers the same unit.
 */

import { ocrPdf, isOcrAvailable } from "./_ocr.mjs";
import { extractLocation } from "../extract-location.mjs";

export const FORMAT_TAG = "wy-plantation-exam-unit";
export const PARSER_VERSION = 2; // bumped from 1 when OCR path landed

/**
 * Extract structured fields from OCR text. Permissive — every field is
 * optional, and we degrade gracefully when a field can't be matched.
 * Returns an object suitable for spreading into canonicalRow.
 */
function extractFieldsFromOcrText(text) {
  const fields = {};

  // Acres: strict patterns only — WY plantation exams say "Forestable
  // Acres" or "Total Acres" with the number BEFORE the word. Bare
  // "<num> acres" patterns are too loose against road numbers and
  // miscellaneous integers in the OCR'd text.
  const acresMatch =
    /(\d+(?:\.\d+)?)\s+forestable\s+acres/i.exec(text) ||
    /total\s+acres?\s*[:\-]\s*(\d+(?:\.\d+)?)/i.exec(text) ||
    /acres?\s*[:\-]\s*(\d+(?:\.\d+)?)/i.exec(text);
  if (acresMatch) {
    const n = Number(acresMatch[1].replace(/,/g, ""));
    if (!isNaN(n) && n > 0 && n < 10000) {
      fields.amount = n;
      fields.amount_type = "acre";
    }
  }

  // TPA: still strict — only "TPA: NNN" or "Target TPA NNN".
  const tpaMatch = /(?:target\s+)?tpa\s*[:\-]\s*(\d+)/i.exec(text);
  if (tpaMatch) {
    const n = parseInt(tpaMatch[1], 10);
    if (!isNaN(n) && n > 0 && n < 10000) fields.tpa_target = n;
  }

  // Spacing: REQUIRE the explicit "spacing" keyword to anchor — bare
  // "NxN" patterns hit too many false positives in WY plantation exams
  // (map gridlines, OCR confusion of "x" between digits).
  const spacingMatch = /spacing\s*[:\-]?\s*(\d{1,2})\s*[x×]\s*(\d{1,2})/i.exec(text);
  if (spacingMatch) {
    fields.target_spacing = `${spacingMatch[1]}x${spacingMatch[2]}`;
  }

  // County: ONLY the "<Name> County" suffix style. The "County: <Name>"
  // prefix style was wrong — WY plantation exams use suffix style
  // ("Cowlitz County") and the prefix-style regex was matching
  // "County\s*StandKey" cross-line as the start-then-next-word pattern.
  const countyMatch = /\b([A-Z][a-z]{2,})\s+County\b/.exec(text);
  if (countyMatch) {
    const c = countyMatch[1].trim();
    if (c.length >= 3 && c.length <= 40) fields.county = c;
  }

  // State: require a context word ("County, WA" or "State: WA") OR a
  // standalone occurrence at the very start of a line. Bare \b(WA|...)\b
  // matches "ID" inside "Exam ID:" — that's the regression we just hit.
  const stateMatch =
    /county[,\s]+(WA|OR|ID|MT)\b/i.exec(text) ||
    /state\s*[:\-]\s*(WA|OR|ID|MT)\b/i.exec(text);
  if (stateMatch) fields.state = stateMatch[1].toUpperCase();

  // Species: look for "Species: Douglas Fir" or list of common species
  const SPECIES_KEYWORDS = ["Douglas Fir", "Douglas-Fir", "Western Hemlock", "Western Red Cedar", "Ponderosa Pine", "Western Larch", "Lodgepole Pine"];
  const foundSpecies = [];
  for (const sp of SPECIES_KEYWORDS) {
    if (new RegExp(sp.replace(/-/g, "[-\\s]?"), "i").test(text)) {
      foundSpecies.push(sp);
    }
  }
  if (foundSpecies.length > 0) {
    // Encode as JSON-string entries (matches existing units.species text[] format)
    fields.species = foundSpecies.map((name) => JSON.stringify({ name, stockType: "", count: null }));
  }

  // Elevation: "Elevation 962.0 ft" or "Elev: 962" or "962 ft elevation"
  const elevMatch =
    /elevation\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:ft|feet)?/i.exec(text) ||
    /elev\.?\s*[:\-]?\s*(\d+(?:\.\d+)?)/i.exec(text);
  if (elevMatch) {
    const n = parseInt(elevMatch[1], 10);
    if (!isNaN(n) && n > 0 && n < 15000) {
      fields.elevation_min = n;
      fields.elevation_max = n;
    }
  }

  // Universal location pass — GPS / township from the OCR'd text.
  // Only set fields that actually matched; NULL stays NULL.
  const loc = extractLocation(text);
  if (loc.latitude != null) fields.latitude = loc.latitude;
  if (loc.longitude != null) fields.longitude = loc.longitude;
  if (loc.township_range) fields.township_range = loc.township_range;

  return fields;
}

/**
 * @param {Buffer | ArrayBuffer | Uint8Array} buffer
 * @param {{filename?: string}} [context]
 */
export async function parseWeyerhaeuserPlantationExam(buffer, context = {}) {
  const filename = context.filename ?? "";
  const sheetWarnings = [];
  const parsed = [];

  // Filename gate — must match the WY pattern even before we try OCR.
  const m = /PlantationExam_(?:UnitNoPlots|PhotoNoPlots)_([A-Za-z0-9]+)\.pdf$/i.exec(filename);
  if (!m) {
    sheetWarnings.push(`filename did not match expected PlantationExam pattern: ${filename}`);
    return {
      formatTag: FORMAT_TAG,
      version: PARSER_VERSION,
      rowCount: 0,
      parsed,
      sheetWarnings,
    };
  }
  const unitId = m[1];

  // Try OCR. Three outcomes:
  //   - OCR succeeds + extracts useful fields → fully-populated canonical row
  //   - OCR succeeds but no fields parse → filename fallback + warning
  //   - OCR throws (API not enabled, IAM missing, network) → filename fallback + warning
  let ocrFields = null;
  let ocrError = null;
  if (await isOcrAvailable()) {
    try {
      const { text, pageCount } = await ocrPdf(buffer);
      sheetWarnings.push(`ocr_pages: ${pageCount}`);
      if (text && text.trim().length > 0) {
        ocrFields = extractFieldsFromOcrText(text);
      }
    } catch (e) {
      ocrError = e instanceof Error ? e.message : String(e);
      sheetWarnings.push(`ocr_failed: ${ocrError}`);
    }
  } else {
    sheetWarnings.push("ocr_unavailable: Vision API not enabled or service account missing role");
  }

  const hasUsefulOcrFields = ocrFields && Object.keys(ocrFields).length > 0;

  const canonicalRow = {
    name: `WY Unit ${unitId}`, // placeholder; office can rename to tract+unit
    stand_key: unitId,
    notes: hasUsefulOcrFields
      ? `Auto-imported from Weyerhaeuser PlantationExam PDF via OCR. Source filename: ${filename}.`
      : `Auto-imported from Weyerhaeuser PlantationExam PDF. Source filename: ${filename}. ` +
        `Acres / spacing / species / other fields require OCR or manual entry.`,
    ...(ocrFields || {}),
  };

  const warnings = [];
  if (!hasUsefulOcrFields) {
    warnings.push("ocr_required: PDF is image-only, manual fields needed");
    if (ocrError) warnings.push(`ocr_error: ${ocrError}`);
  }

  parsed.push({
    canonicalRow,
    sourceRow: { filename, unitId, ocrFieldsExtracted: hasUsefulOcrFields ? Object.keys(ocrFields) : [] },
    unmappedFields: {},
    warnings,
  });

  return {
    formatTag: FORMAT_TAG,
    version: PARSER_VERSION,
    rowCount: 1,
    parsed,
    sheetWarnings,
  };
}

/**
 * Photo-variant parser — skipped entirely. Returns 0 rows so the
 * orchestrator marks the batch as success-with-zero-rows.
 *
 * @param {Buffer | ArrayBuffer | Uint8Array} _buffer
 * @param {{filename?: string}} [_context]
 */
export function parseWeyerhaeuserPlantationExamPhoto(_buffer, _context = {}) {
  return {
    formatTag: "wy-plantation-exam-photo",
    version: PARSER_VERSION,
    rowCount: 0,
    parsed: [],
    sheetWarnings: ["photo-variant skipped — UnitNoPlots variant covers this unit"],
  };
}
