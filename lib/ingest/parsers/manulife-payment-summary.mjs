/**
 * Manulife "Ramos Payment Summary — Completed Units" parser.
 *
 * Format tag: `manulife-payment-summary`. Mode B (PDF, text-extractable).
 *
 * What this doc is: a payment-period summary showing actual planting
 * activity per unit per day, with stock type, trees planted, quality %,
 * gross/net pay, crew, property. Jaime described it on the May 14 call
 * as a "rare case" document — usually unit data lives in Exhibit C or
 * the awarded-units sheet, but occasionally a payment summary carries
 * NEW unit data the project list hasn't seen yet.
 *
 * Why parse it at all: per the May 14 field-coverage rule, every parser
 * extracts every unit field it can. This doc carries unit identity
 * (Job Name) + stock type + trees planted that ANY existing parser
 * does NOT cover (Exhibit C has spec'd targets; this one has actuals).
 *
 * What we extract: ONLY the unit-data fields. Financials (gross/net
 * pay, quality %) are NOT canonical schema fields and are kept in the
 * sourceRow for future use but not promoted to the units table. Bees
 * may want a unit_payments / production_logs landing for the
 * completion + payment data separately — that's the schema decision
 * question that stays open for now.
 *
 * Aggregation: one unit can appear on MULTIPLE rows in the payment
 * summary (different planting days, different stock types). The
 * parser aggregates by Job Name, summing trees_planted into
 * total_seedlings. The unit's existing-or-not status is decided
 * downstream by the orchestrator (INSERT new, UPDATE existing).
 *
 * Column structure (verified May 14):
 *
 *   PlantingDate JobName StockType TreesPlanted Quality% GrossPay NetPay Crew Property
 *
 * Where:
 *   PlantingDate  — M/D/YYYY
 *   JobName       — unit name (e.g. "Anchor PP2-SO", "Spike DF-SO")
 *   StockType     — "Plugs - Cat" / "Plugs - Line" /
 *                   "Bareroot - Cat" / "Bareroot - Line"
 *   TreesPlanted  — integer with optional comma (e.g. "1,080" / "800")
 *   Quality%      — NN.NN% (e.g. "98.20%")
 *   GrossPay      — $NNN.NN with trailing $ (e.g. "318.60 $")
 *   NetPay        — same as gross typically
 *   Crew          — first name (e.g. "Augustine")
 *   Property      — 2-3 letter code (matches the Client column from Exhibit C)
 */

import { canonicalizeWorkType } from "../canonicalize.mjs";
import { extractLocation } from "../extract-location.mjs";

// Reuse the pdfjs setup pattern from the other Manulife parsers.
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

export const FORMAT_TAG = "manulife-payment-summary";
export const PARSER_VERSION = 1;

// Stock type strings as they appear in the doc, ordered longest-first
// so "Plugs - Line" doesn't get partially matched as "Plugs - L" or
// similar. Each maps to a canonical stock_type value for the units
// table (existing convention: "P+0", "P+1", "Plug", "Bareroot").
const STOCK_TYPE_MAP = [
  { source: "Bareroot - Line", canonical: "Bareroot" },
  { source: "Bareroot - Cat", canonical: "Bareroot" },
  { source: "Plugs - Line", canonical: "Plug" },
  { source: "Plugs - Cat", canonical: "Plug" },
];

const DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
const PROPERTY_CODE_RE = /^[A-Z]{2,4}$/;
const PERCENT_RE = /^\d{1,3}(\.\d+)?%$/;

/**
 * @param {Buffer | ArrayBuffer | Uint8Array} buffer
 * @param {{filename?: string}} [_context]
 */
export async function parseManulifePaymentSummary(buffer, _context = {}) {
  const u8 = buffer instanceof Buffer
    ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    : (buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
  const getDocument = await loadGetDocument();
  const doc = await getDocument({
    data: u8,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;

  const sheetWarnings = [];

  // Flatten all pages to one text blob
  let allText = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const txt = await page.getTextContent();
    for (const item of txt.items) {
      if (typeof item.str === "string") allText += " " + item.str;
    }
  }

  // Anchor: skip past the header row. The last column header is "Property"
  // (after Crew). First occurrence is the header label.
  const headerEnd = allText.search(/Property/i);
  if (headerEnd < 0) {
    sheetWarnings.push("header row not found (expected 'Property' column header)");
    return { formatTag: FORMAT_TAG, version: PARSER_VERSION, rowCount: 0, parsed: [], sheetWarnings };
  }
  const dataText = allText
    .slice(headerEnd)
    .replace(/^Property/i, "")
    .replace(/\s+/g, " ")
    .trim();
  // Reduce stock-type tokens to a single hyphenated form so they're a
  // single token. "Plugs - Cat" → "Plugs-Cat" (only inside data rows).
  // Done before tokenization so the stock_type span is one token.
  let normalized = dataText;
  for (const st of STOCK_TYPE_MAP) {
    const re = new RegExp(st.source.replace(/\s+/g, "\\s+"), "gi");
    normalized = normalized.replace(re, st.source.replace(/\s+/g, "-"));
  }
  const tokens = normalized.split(/\s+/);

  // Shared location (rarely present in this doc, but the hook stays for
  // the universal-field rule).
  const sharedLocation = extractLocation(allText);

  // Walk: for each date token, parse a row.
  //
  //   tokens[i]   = date
  //   tokens[i+1..k] = JobName (1-3 words), ends before a stock-type token
  //   tokens[k]   = stock-type (Plugs-Cat / Plugs-Line / Bareroot-Cat / Bareroot-Line)
  //   tokens[k+1] = trees planted (number, may have commas)
  //   tokens[k+2] = quality % (e.g. "98.20%")
  //   tokens[k+3..k+6] = gross pay, "$", net pay, "$"  (4 tokens; "$" is its own token)
  //   tokens[k+7] = crew name
  //   tokens[k+8] = property code (2-4 caps)
  //   Then the next date starts.

  /** @type {Map<string, { jobName: string, totalTrees: number, stockTypes: Set<string>, property: string, dates: string[], crew: string, qualities: number[] }>} */
  const byJob = new Map();

  let i = 0;
  while (i < tokens.length) {
    if (!DATE_RE.test(tokens[i])) { i += 1; continue; }
    const date = tokens[i];

    // Find the stock-type token within the next 6 tokens
    let stockIdx = -1;
    let stockCanonical = null;
    for (let j = i + 1; j < Math.min(i + 8, tokens.length); j++) {
      const tok = tokens[j];
      for (const st of STOCK_TYPE_MAP) {
        if (tok === st.source.replace(/\s+/g, "-")) {
          stockIdx = j;
          stockCanonical = st.canonical;
          break;
        }
      }
      if (stockIdx >= 0) break;
    }
    if (stockIdx < 0) { i += 1; continue; }

    const jobName = tokens.slice(i + 1, stockIdx).join(" ").trim();
    if (!jobName) { i += 1; continue; }

    const treesRaw = tokens[stockIdx + 1];
    const trees = parseInt((treesRaw || "").replace(/,/g, ""), 10);
    if (isNaN(trees) || trees < 1) { i += 1; continue; }

    // Quality and pay tokens come next. Quality is optional in some
    // rows so we scan forward looking for the next property-code
    // pattern as the row terminator. Crew sits one slot before property.
    let endIdx = -1;
    for (let j = stockIdx + 2; j < Math.min(stockIdx + 12, tokens.length); j++) {
      if (PROPERTY_CODE_RE.test(tokens[j])) { endIdx = j; break; }
    }
    if (endIdx < 0) { i = stockIdx + 2; continue; }
    const property = tokens[endIdx];
    const crew = tokens[endIdx - 1] ?? "";

    // Quality %, if present, sits as the first %-bearing token after stock
    let quality = null;
    for (let j = stockIdx + 2; j < endIdx; j++) {
      if (PERCENT_RE.test(tokens[j])) {
        quality = parseFloat(tokens[j].replace("%", ""));
        break;
      }
    }

    const existing = byJob.get(jobName) ?? {
      jobName,
      totalTrees: 0,
      stockTypes: new Set(),
      property: "",
      dates: [],
      crew: "",
      qualities: [],
    };
    existing.totalTrees += trees;
    existing.stockTypes.add(stockCanonical);
    if (property) existing.property = property;
    if (date) existing.dates.push(date);
    if (crew) existing.crew = crew;
    if (quality != null) existing.qualities.push(quality);
    byJob.set(jobName, existing);

    i = endIdx + 1;
  }

  const parsed = [];
  for (const j of byJob.values()) {
    const stockList = [...j.stockTypes];
    const avgQuality = j.qualities.length > 0
      ? Math.round((j.qualities.reduce((s, q) => s + q, 0) / j.qualities.length) * 10) / 10
      : null;
    const dateRange = j.dates.length > 0
      ? `${j.dates[0]}${j.dates.length > 1 ? " — " + j.dates[j.dates.length - 1] : ""}`
      : "";

    // Payment Summary rows record actual completed planting events.
    // The presence of payment data + trees-planted count means crews
    // were paid, so the unit is at least in progress (planting started)
    // and most likely completed. Quality >= 80% = completed (full pay
    // tier per Manulife's standard); below = in_progress (replant or
    // touchup typically follows).
    const inferredStatus = avgQuality != null && avgQuality >= 80
      ? "completed"
      : "in_progress";

    // Fold the pay + completion context into notes so it's surfaced on
    // the unit's detail page (no separate canonical field for it yet).
    // Plain-English so the office can read it at a glance.
    const noteParts = [
      `Imported from Manulife Payment Summary.`,
      `Property: ${j.property || "?"}.`,
      dateRange ? `Planted ${dateRange}.` : null,
      `${j.totalTrees.toLocaleString()} trees planted` +
        (stockList.length > 0 ? ` (${stockList.join(" + ")})` : "") + ".",
      j.crew ? `Crew: ${j.crew}.` : null,
      avgQuality != null ? `Quality avg: ${avgQuality}%.` : null,
    ].filter(Boolean);

    const canonicalRow = {
      name: j.jobName,
      work_type: canonicalizeWorkType("Planting") || "Planting",
      status: inferredStatus,
      total_seedlings: j.totalTrees,
      // Stock type: take the first one we saw; if there were multiple
      // (Plugs + Bareroot on the same unit) note it in the warnings.
      stock_type: stockList[0] || null,
      notes: noteParts.join(" "),
    };
    if (sharedLocation.latitude != null) canonicalRow.latitude = sharedLocation.latitude;
    if (sharedLocation.longitude != null) canonicalRow.longitude = sharedLocation.longitude;
    if (sharedLocation.township_range) canonicalRow.township_range = sharedLocation.township_range;

    const warnings = [];
    if (stockList.length > 1) {
      warnings.push(`multiple stock types on same unit: ${stockList.join(", ")} — taking first`);
    }

    parsed.push({
      canonicalRow,
      sourceRow: {
        jobName: j.jobName,
        property: j.property,
        crew: j.crew,
        totalTreesPlanted: j.totalTrees,
        stockTypes: stockList,
        plantingDates: j.dates,
        qualityPercents: j.qualities,
        avgQuality,
        inferredStatus,
      },
      // No unmappedFields. Earlier versions stashed grossPay/netPay
      // hints here which generated noisy "didn't map to a known field"
      // warnings in the office review queue. The pay data is implicit
      // in the trees-planted + quality fields; we fold those into notes
      // and set status. Raw pay numbers stay accessible via the source
      // file (one click from the review row's Drive link).
      unmappedFields: {},
      warnings,
    });
  }

  if (parsed.length === 0) {
    sheetWarnings.push("0 rows parsed — file may not be Payment Summary format, or column order changed");
  }

  return {
    formatTag: FORMAT_TAG,
    version: PARSER_VERSION,
    rowCount: parsed.length,
    parsed,
    sheetWarnings,
  };
}
