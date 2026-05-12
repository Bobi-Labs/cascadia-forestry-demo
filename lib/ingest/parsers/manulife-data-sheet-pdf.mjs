/**
 * Manulife "Data sheet" PDF parser (Mode B).
 *
 * Format tag: `manulife-data-sheet-pdf`. Lives alongside the xlsx
 * parser (`manulife-awarded-units-xlsx`) — they ingest the SAME
 * underlying data, but Manulife sometimes sends only the PDF export.
 * Both produce identical canonical rows.
 *
 * The PDF is a single-page table export of the Manulife awarded-units
 * dataset:
 *
 *   CommonName  GIS Area  GIS Area Unit Type  Season  Activity Category2
 *     Primary State or Province  Primary County  Property  PlannedYear
 *   7 Leguas LG  100.49 acres  Fall  Crop Maintenance  Washington
 *     Stevens  Long Canyon  2026
 *   7 Leguas SA  85.01 acres  ...
 *
 * pdfjs returns text items with positional info — we don't use the
 * positions. Instead we treat the page as flat text and parse rows by
 * looking for the column-1 pattern (a unit name) followed by acreage,
 * unit type, season, etc. The known column structure makes this safe.
 *
 * Falls back to flagged-for-review if a row doesn't match the expected
 * shape — better to surface oddities than parse them wrong.
 */

import { canonicalizeState, canonicalizeWorkType } from "../canonicalize.mjs";
import { extractLocation } from "../extract-location.mjs";

// pdfjs-dist is dynamic-imported inside the parser. Static import at the
// top of the file made the entire orchestrator module fail to initialize
// in Vercel's serverless runtime — pdfjs has node-specific module
// resolution quirks that webpack's serverless bundle doesn't always
// satisfy. Defer loading until a PDF actually needs parsing; the cron
// route + the orchestrator import chain stays clean.
//
// Also polyfill the few browser globals pdfjs reaches for. Node 18+
// removed `DOMMatrix` from globals; pdfjs's legacy build still touches
// it (only via `instanceof` checks for transform matrices). We don't
// render anything visual — just extract text — so empty-class stubs are
// enough. Same logic applies to `ImageData` and `Path2D` if they ever
// surface; pre-empt them now so we don't loop on this error.
function ensurePdfJsGlobals() {
  if (typeof globalThis.DOMMatrix === "undefined") {
    globalThis.DOMMatrix = class DOMMatrix {
      constructor() {}
    };
  }
  if (typeof globalThis.ImageData === "undefined") {
    globalThis.ImageData = class ImageData {
      constructor() {}
    };
  }
  if (typeof globalThis.Path2D === "undefined") {
    globalThis.Path2D = class Path2D {
      constructor() {}
    };
  }
}

let _getDocument = null;
async function loadGetDocument() {
  if (_getDocument) return _getDocument;
  ensurePdfJsGlobals();
  // Pre-load the worker module and stash it on globalThis. pdfjs v5's
  // fake-worker setup checks `globalThis.pdfjsWorker?.WorkerMessageHandler`
  // before falling back to a dynamic `import(workerSrc)` — and that
  // fallback path is what fails in Vercel's serverless bundle (the
  // /*webpackIgnore: true*/ directive on pdfjs's dynamic import means
  // webpack doesn't bundle pdf.worker.mjs at all, so at runtime the
  // file isn't on disk to resolve). Importing it here without that
  // directive forces webpack to bundle it; assigning to globalThis lets
  // pdfjs find it via the early-return path and skip the failing
  // dynamic import entirely.
  const workerMod = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  globalThis.pdfjsWorker = workerMod;
  const mod = await import("pdfjs-dist/legacy/build/pdf.mjs");
  _getDocument = mod.getDocument;
  return _getDocument;
}

export const FORMAT_TAG = "manulife-data-sheet-pdf";
export const PARSER_VERSION = 1;

/**
 * Manulife data-sheet column order (verified in sample).
 *   1. CommonName (string)
 *   2. GIS Area (number)
 *   3. GIS Area Unit Type (string, "acres")
 *   4. Season (string, "Fall")
 *   5. Activity Category2 (string, "Crop Maintenance" — same as Activity Category)
 *   6. Primary State or Province (string)
 *   7. Primary County (string)
 *   8. Property (string)
 *   9. PlannedYear (number)
 *
 * Rows are parsed top-down; each row consumes 9 fields.
 */

/**
 * @param {Buffer | ArrayBuffer | Uint8Array} buffer
 */
export async function parseManulifeDataSheetPdf(buffer) {
  // pdfjs explicitly rejects Node Buffer (which is a Uint8Array subclass)
  // — it wants a "real" Uint8Array. Construct one over the same bytes.
  const u8 = buffer instanceof Buffer
    ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    : (buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
  const getDocument = await loadGetDocument();
  // isEvalSupported:false avoids runtime Function() (sandbox-blocked in
  // some serverless runtimes). useSystemFonts:false skips font lookups
  // we don't need for text extraction.
  const doc = await getDocument({
    data: u8,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;

  const sheetWarnings = [];
  const parsed = [];

  // Concatenate all text from all pages into one flat string. pdfjs
  // returns text items with inconsistent splitting (sometimes a whole
  // page is one item, sometimes per-cell); flat text + whitespace
  // tokenization is more reliable than item-level parsing.
  let allText = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const txt = await page.getTextContent();
    for (const item of txt.items) {
      if (typeof item.str === "string") allText += " " + item.str;
    }
  }

  // Universal location pass (May 14, 2026 — same hook across every
  // parser). NULL if the doc doesn't carry GPS / township; otherwise
  // gets folded into every canonical row this doc produces.
  const sharedLocation = extractLocation(allText);

  // Skip past the header. Anchor on "PlannedYear" (last column header) —
  // data rows start right after. If "PlannedYear" appears multiple times
  // (page breaks etc.) the first occurrence is the header.
  const headerEndIdx = allText.search(/PlannedY\s*ear/i);
  let dataText;
  if (headerEndIdx >= 0) {
    // Skip past the header word (and any trailing whitespace/page-break)
    const afterHeader = allText.slice(headerEndIdx).replace(/^PlannedY\s*ear/i, "");
    dataText = afterHeader.replace(/\s+/g, " ").trim();
  } else {
    sheetWarnings.push("header row not found; parsing entire text — may produce false rows");
    dataText = allText.replace(/\s+/g, " ").trim();
  }
  const flatText = dataText;

  // Strategy: scan for unit names as anchors. A unit name in the
  // Manulife format is typically multi-word and ends right before a
  // numeric acreage value followed by "acres". Use that as the row
  // boundary. Greedy match: name = everything until "<number> acres".
  //
  // Pattern: <name (greedy)>  <acres (number)>  acres  <rest>
  // Where rest = season + category + state + county + property + year.
  //
  // After acres+unit, the next 6 fields complete the row:
  //   Season (1 word usually)  Category (multi-word: "Crop Maintenance")
  //   State (1 word: "Washington")  County (1 word: "Stevens")
  //   Property (multi-word: "Silver Mountain")  Year (4-digit)
  //
  // Easier approach: find positions of "acres" + 4-digit year. Each
  // pair anchors one row: name before acres, year ends row.

  // Tokenize on whitespace
  const tokens = flatText.split(/\s+/);

  // Walk through tokens collecting rows
  let i = 0;
  while (i < tokens.length) {
    // Look ahead for an acreage pattern: a numeric token followed by "acres"
    let acresIdx = -1;
    for (let j = i + 1; j < Math.min(i + 12, tokens.length); j++) {
      if (/^acres?$/i.test(tokens[j]) && j > 0 && /^\d+(\.\d+)?$/.test(tokens[j - 1])) {
        acresIdx = j; // j is the "acres" word; j-1 is the number
        break;
      }
    }
    if (acresIdx < 0) {
      // No more rows — abort
      break;
    }

    // Look ahead for the year (4-digit) that ends the row
    let yearIdx = -1;
    for (let j = acresIdx; j < Math.min(acresIdx + 15, tokens.length); j++) {
      if (/^(19|20)\d{2}$/.test(tokens[j])) {
        yearIdx = j;
        break;
      }
    }
    if (yearIdx < 0) {
      // Malformed — skip to past acres and try again
      sheetWarnings.push(`row missing year after acreage at token ${acresIdx}`);
      i = acresIdx + 1;
      continue;
    }

    // Compose row
    const name = tokens.slice(i, acresIdx - 1).join(" ").trim();
    const acres = Number(tokens[acresIdx - 1]);
    const unitType = tokens[acresIdx].toLowerCase().startsWith("acre") ? "acre" : null;
    // Between acresIdx+1 and yearIdx are: Season, Activity Category, State, County, Property
    const middle = tokens.slice(acresIdx + 1, yearIdx);
    // Heuristic split: Season is 1 token. Activity Category is 2 tokens
    // ("Crop Maintenance"). State is 1 token. County is 1 token. Property
    // is whatever's left (variable length).
    let m = 0;
    const season = middle[m++] ?? null;
    // Activity Category: try 2-token "Crop Maintenance"; fallback 1 token
    let activityCategory = null;
    if (middle[m] && middle[m + 1] && /^[A-Z]/.test(middle[m]) && /^[A-Z]/.test(middle[m + 1])) {
      activityCategory = `${middle[m]} ${middle[m + 1]}`;
      m += 2;
    } else if (middle[m]) {
      activityCategory = middle[m];
      m += 1;
    }
    const state = middle[m++] ?? null;
    const county = middle[m++] ?? null;
    const property = middle.slice(m).join(" ") || null;
    const year = Number(tokens[yearIdx]);

    const sourceRow = {
      CommonName: name,
      "GIS Area": acres,
      "GIS Area Unit Type": tokens[acresIdx],
      Season: season,
      "Activity Category2": activityCategory,
      "Primary State or Province": state,
      "Primary County": county,
      Property: property,
      PlannedYear: year,
    };

    const canonicalRow = { name };
    if (Number.isFinite(acres)) {
      canonicalRow.amount = acres;
      canonicalRow.amount_type = unitType ?? "acre";
    }
    // canonicalize.mjs converts "Washington" → "WA" and "Crop
    // Maintenance" → "crop_maintenance" so the proposed unit lines up
    // with how existing units are stored. Otherwise every existing
    // Manulife unit re-imports as "unit_changed" on the format
    // mismatch alone — see docs/unit-ingest-testing.md gotchas.
    if (state) canonicalRow.state = canonicalizeState(state);
    if (county) canonicalRow.county = county;
    if (activityCategory) canonicalRow.work_type = canonicalizeWorkType(activityCategory);
    const noteParts = [];
    if (property) noteParts.push(`Property: ${property}`);
    if (Number.isFinite(year)) noteParts.push(`Year: ${year}`);
    if (season) noteParts.push(`Season: ${season}`);
    if (noteParts.length > 0) canonicalRow.notes = noteParts.join(" · ");
    if (sharedLocation.latitude != null) canonicalRow.latitude = sharedLocation.latitude;
    if (sharedLocation.longitude != null) canonicalRow.longitude = sharedLocation.longitude;
    if (sharedLocation.township_range) canonicalRow.township_range = sharedLocation.township_range;

    parsed.push({
      canonicalRow,
      sourceRow,
      unmappedFields: {},
      warnings: [],
    });

    i = yearIdx + 1;
  }

  return {
    formatTag: FORMAT_TAG,
    version: PARSER_VERSION,
    rowCount: parsed.length,
    parsed,
    sheetWarnings,
  };
}
