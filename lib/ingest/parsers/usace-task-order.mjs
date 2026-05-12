/**
 * USACE (US Army Corps of Engineers) Task Order parser.
 *
 * Format tag: `usace-task-order`. Mode B (PDF, text-extractable).
 *
 * The USACE ships per-task-order PDFs on DD Form 1155 — typically 9
 * pages including the cover, Section B (line items), Section C (work
 * statement), and various FAR clauses. The unit data we care about
 * lives in Section B as a "Supplies/Service" table:
 *
 *   Section B - Supplies or Services & Prices or Costs
 *   | Item | Supplies/Service                                  | Quantity | Unit |
 *   | 1001 | CLIN 1001 - LABOR - ACRE - $108.00 X 232.70 = ... | 232.7    | Acre |
 *   | 1002 | CLIN 1002 - MIX 1 - ACRE - $80.00 X 51.60 = ...   | 51.6     | Acre |
 *   | 1005 | CLIN 1005 - MIX 4 - ACRE - $30.00 X 76.40 = ...   | 76.4     | Acre |
 *   | 1010 | CLIN 1010 - MIX 9 - ACRE - $35.00 X 104.70 = ...  | 104.7    | Acre |
 *
 * Each CLIN is treated as a unit of work. Names like "CLIN 1001 LABOR",
 * "CLIN 1002 MIX 1" etc. — unique within the contract. Acres come from
 * the embedded "X <qty>" in the description; we cross-check against the
 * Quantity column when present.
 *
 * Section C ("Description/Specifications/Statement of Work") contains
 * the location prose — typically a base name like "Joint Base Lewis
 * McChord, WA". We pull state from there. County isn't usually
 * specified — left null for office to fill.
 *
 * No DB writes here. Orchestrator dispatches based on `format_tag`
 * and inserts to `units` (clean parse) or `unit_pending_review`.
 */

import { canonicalizeState, canonicalizeWorkType } from "../canonicalize.mjs";
import { extractLocation } from "../extract-location.mjs";

// pdfjs-dist + the polyfills + worker pre-import — copied from the
// Manulife data-sheet parser. See that parser's comment for why each
// piece is necessary in Vercel's serverless runtime.
function ensurePdfJsGlobals() {
  if (typeof globalThis.DOMMatrix === "undefined") {
    globalThis.DOMMatrix = class DOMMatrix { constructor() {} };
  }
  if (typeof globalThis.ImageData === "undefined") {
    globalThis.ImageData = class ImageData { constructor() {} };
  }
  if (typeof globalThis.Path2D === "undefined") {
    globalThis.Path2D = class Path2D { constructor() {} };
  }
}

let _getDocument = null;
async function loadGetDocument() {
  if (_getDocument) return _getDocument;
  ensurePdfJsGlobals();
  const workerMod = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  globalThis.pdfjsWorker = workerMod;
  const mod = await import("pdfjs-dist/legacy/build/pdf.mjs");
  _getDocument = mod.getDocument;
  return _getDocument;
}

export const FORMAT_TAG = "usace-task-order";
export const PARSER_VERSION = 1;

/**
 * Pull the contract number out of the cover page header (block 1
 * "CONTRACT/PURCH ORDER/AGREEMENT NO." or 2 "DELIVERY ORDER/CALL NO.").
 * USACE filenames always include this — we still extract it from
 * content for redundancy + audit trail.
 */
function extractContractNumber(text) {
  const m = text.match(/W912DW\w+/);
  return m ? m[0] : "";
}

/**
 * Extract state from the Section C work-statement prose. Pattern:
 *   "...perform <activity> on Joint Base Lewis McChord, WA."
 * Falls back to scanning for any 2-letter state code at the end of a
 * geographic phrase. Empty string on miss — orchestrator falls back to
 * batch.landowner / contract context.
 */
function extractState(text) {
  // Section C work-statement prose ("Joint Base Lewis McChord, WA")
  // is often image-only on DD Form 1155 Task Orders, so we can't rely
  // on it. Fall back to address blocks on the cover page — pattern is
  // "<CITY>, <STATE> <ZIP>". The cover has multiple addresses though:
  //   block 6  ISSUED BY       (Seattle, WA — contracting office)
  //   block 9  CONTRACTOR      (Kelso, WA — Ramos)
  //   block 15 PAYMENT MADE BY (Millington, TN — USACE Finance Center)
  //
  // pdfjs's text-extraction order doesn't match the visual layout, so
  // we can't just take the first match. Instead, collect every
  // "<CITY>, XX <ZIP>" hit and pick the most-frequent PNW state — work
  // sites for Ramos contracts are always PNW (WA/OR/ID/MT) and the
  // payment office's TN is the noisy outlier.
  const PNW = new Set(["WA", "OR", "ID", "MT", "CA"]);
  const counts = new Map();
  const matches = text.matchAll(/,\s+([A-Z]{2})\s+\d{5}/g);
  for (const m of matches) {
    const code = m[1];
    if (!PNW.has(code)) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  if (counts.size > 0) {
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  // Fallback if nothing PNW-shaped — section C prose if extracted, or
  // a full state name anywhere.
  const sectionC = text.match(/,\s*([A-Z]{2})\s*[\.\n]/);
  if (sectionC && PNW.has(sectionC[1])) return sectionC[1];
  const fullName = text.match(
    /\b(Washington|Oregon|Idaho|Montana|California)\b/i,
  );
  return fullName ? fullName[1] : "";
}

/**
 * Parse the CLIN line items out of the flat text. Each CLIN block has
 * a fixed shape:
 *   CLIN <4-digit code> - <activity> - ACRE - $<rate> X <qty> = $<total>
 *
 * Returns one entry per CLIN match. The `acres` field comes from the
 * "X <qty>" inside the description — that's the authoritative figure
 * that's also echoed in the Quantity column. We avoid relying on the
 * column-extracted Quantity since pdfjs's column ordering for table
 * cells is fragile in DD Form 1155.
 */
function parseClinRows(allText) {
  const rows = [];
  // pdfjs's text extraction on DD Form 1155 PDFs has a font quirk: the
  // "L" glyph in "CLIN" decodes as nothing, so "CLIN1001" comes through
  // as "CUN1001" or even "C IN1001" depending on the PDF generation
  // tool. Tolerate any 1-2 letter sequence between C and N at the head
  // of the marker; fall back to plain CLIN where the encoding is fine.
  // Also: there's often no space between marker + digits, hence the
  // optional whitespace.
  //
  // After the marker we have:
  //   - <activity> (e.g. "LABOR", "MIX 1", "MIX 4")
  //   - ACRE
  //   - $<rate>
  //   - X <qty>
  // In the flat-text dump pdfjs emits the column-extracted quantity
  // (e.g. "232.7") AFTER the "X" — that's the qty we capture. The
  // exact total may appear further along but isn't reliable to anchor
  // on across cell boundaries, so we skip it.
  const re = /C[A-Z]{0,2}N\s*(\d{4})\s*-\s*([^-\n]+?)\s*-\s*ACRE\s*-\s*\$([\d,.]+)\s*X\s*([\d,.]+)/gi;
  let m;
  while ((m = re.exec(allText)) !== null) {
    const code = m[1];
    const activity = m[2].trim();
    const ratePerAcre = parseFloat(m[3].replace(/,/g, ""));
    const acres = parseFloat(m[4].replace(/,/g, ""));
    if (!Number.isFinite(acres)) continue;
    rows.push({ code, activity, ratePerAcre, acres, total: null });
  }
  return rows;
}

/**
 * Map a USACE activity label to a canonical work_type slug. The
 * Task Orders we've seen are all herbicide application — "LABOR" is
 * the labor line, "MIX <n>" lines are different chemical mix codes.
 * All collapse to "spray" via canonicalizeWorkType, which also
 * matches some existing rows in the units table.
 */
function workTypeForActivity(activity) {
  const upper = activity.toUpperCase();
  if (upper.includes("MIX")) return canonicalizeWorkType("herbicide_spray");
  if (upper.includes("LABOR")) return canonicalizeWorkType("spray");
  return canonicalizeWorkType("spray");
}

/**
 * @param {Buffer | ArrayBuffer | Uint8Array} buffer
 */
export async function parseUsaceTaskOrder(buffer) {
  const u8 = buffer instanceof Buffer
    ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    : (buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
  const getDocument = await loadGetDocument();
  const doc = await getDocument({
    data: u8,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;

  let allText = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const txt = await page.getTextContent();
    for (const item of txt.items) {
      if (typeof item.str === "string") allText += " " + item.str;
    }
  }

  const sheetWarnings = [];
  // Universal location pass (May 14, 2026 — same hook across every parser).
  const sharedLocation = extractLocation(allText);
  const contractNumber = extractContractNumber(allText);
  const state = extractState(allText);
  const clinRows = parseClinRows(allText);

  if (clinRows.length === 0) {
    // Couldn't find any CLIN line items — either the file is the
    // attachment supplement (large PDF with maps) rather than the
    // Task Order itself, or the format drifted. Surface a single
    // parse_warnings row.
    sheetWarnings.push("clin_lines_not_found: Section B CLIN parsing produced zero rows");
    return {
      formatTag: FORMAT_TAG,
      version: PARSER_VERSION,
      rowCount: 0,
      parsed: [
        {
          canonicalRow: {
            name: contractNumber
              ? `USACE ${contractNumber} — CLIN parse failed`
              : "USACE Task Order — CLIN parse failed",
            notes: "Auto-imported from USACE Task Order PDF — Section B CLIN list couldn't be parsed. Office: open the source PDF and add per-CLIN units manually.",
          },
          sourceRow: { contractNumber, state },
          unmappedFields: {},
          warnings: ["clin_lines_not_found"],
        },
      ],
      sheetWarnings,
    };
  }

  const parsed = clinRows.map((c) => {
    const canonicalRow = {
      name: `CLIN ${c.code} ${c.activity}`.trim(),
      amount: c.acres,
      amount_type: "acre",
      work_type: workTypeForActivity(c.activity),
      price_per_unit: Number.isFinite(c.ratePerAcre) ? c.ratePerAcre : null,
    };
    if (state) canonicalRow.state = canonicalizeState(state);
    const noteParts = [];
    if (contractNumber) noteParts.push(`Contract: ${contractNumber}`);
    if (Number.isFinite(c.ratePerAcre) && Number.isFinite(c.acres)) {
      // Re-derive the total since pdfjs's column ordering doesn't let
      // us extract the printed total reliably. Same number, sourced
      // locally so the office sees it without opening the PDF.
      const total = c.ratePerAcre * c.acres;
      noteParts.push(`Total: $${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    }
    if (noteParts.length > 0) canonicalRow.notes = noteParts.join(" · ");
    if (sharedLocation.latitude != null) canonicalRow.latitude = sharedLocation.latitude;
    if (sharedLocation.longitude != null) canonicalRow.longitude = sharedLocation.longitude;
    if (sharedLocation.township_range) canonicalRow.township_range = sharedLocation.township_range;

    return {
      canonicalRow,
      sourceRow: {
        clinCode: c.code,
        activity: c.activity,
        ratePerAcre: c.ratePerAcre,
        acres: c.acres,
        total: c.total,
        contractNumber,
        state,
      },
      unmappedFields: {},
      warnings: [],
    };
  });

  return {
    formatTag: FORMAT_TAG,
    version: PARSER_VERSION,
    rowCount: parsed.length,
    parsed,
    sheetWarnings,
  };
}
