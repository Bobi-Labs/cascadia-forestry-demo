/**
 * DNR (WA Department of Natural Resources) reforestation contract
 * parser.
 *
 * Format tag: `dnr-refor-contract`. Mode B (PDF, text-extractable).
 *
 * The DNR ships per-job contracts as 30+ page DocuSigned PDFs. The
 * unit data lives in two well-formatted sections:
 *
 *   SECTION II-A: UNIT DESCRIPTION
 *     A typed table with columns:
 *       Unit # | Work Area | Unit Name | Elevation (feet) | Gate
 *       | Inter Plant Unit | Acres to Treat | Total Seedlings per Acre
 *       | Average Spacing (feet) | Minimum Spacing (feet)
 *       | Maximum Seedlings per Inspection Plot | Seedling Species
 *       | Stock Type | Seedlings per Acre by Species | Total Trees by Species
 *
 *   SECTION II-A: DETAILED UNIT DESCRIPTIONS
 *     Free-text page with project-level fields:
 *       Land Ownership: <agency>
 *       Project Name: <name>
 *       Legal Location: <County>, <State>. <legal description>
 *       Gross Acres: <number>
 *
 * Strategy: pull all text via pdfjs (already wired up in the Manulife
 * parser — same dynamic-import dance for the serverless runtime), then
 * pattern-match on row shape. Each row in the unit table has 14
 * predictable fields with regex-discoverable types.
 *
 * Conservative fallback: if the table doesn't parse cleanly we surface
 * one parse_warnings row per file rather than mis-attributing data to
 * the wrong unit. Office hand-fills.
 *
 * No DB writes here. Orchestrator dispatches based on `format_tag`
 * and inserts to `units` (clean parse) or `unit_pending_review`.
 */

import { canonicalizeState, canonicalizeWorkType } from "../canonicalize.mjs";
import { extractLocation } from "../extract-location.mjs";

// pdfjs-dist + the polyfills + worker pre-import — copied from the
// Manulife data-sheet parser since the same serverless quirks apply.
// Keeping them inline (rather than factoring) so each parser is
// self-contained and one parser's pdfjs setup quirk can't leak.
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

export const FORMAT_TAG = "dnr-refor-contract";
export const PARSER_VERSION = 1;

/**
 * Extract county + state from the "Legal Location:" line of a Detailed
 * Unit Descriptions section. DNR's typical phrasing:
 *
 *   "Legal Location: Ferry County, Washington. The legal description is …"
 *
 * Returns { county, state } with empty strings on miss.
 */
function extractLegalLocation(text) {
  // Tolerate either a county-suffix or a bare county name. The state
  // is captured non-greedily up to the first sentence-ender.
  const m = text.match(
    /Legal\s+Location\s*:\s*([A-Za-z][A-Za-z .'-]+?)\s+County\s*,\s*([A-Za-z .]+?)[\.\n]/i,
  );
  if (!m) return { county: "", state: "" };
  return {
    county: m[1].trim(),
    state: m[2].trim(),
  };
}

/**
 * Pluck the project name out of the Detailed Unit Descriptions page.
 * Used as a notes-prefix so the office sees "Goosmus Fire Salvage" on
 * each row even though the table column is just "Goosmus" / "Unit N".
 */
function extractProjectName(text) {
  const m = text.match(/Project\s+Name\s*:\s*(.+?)\s*\n/);
  return m ? m[1].trim() : "";
}

/**
 * Parse one unit row out of the flat text dump. The row pattern is
 * fixed by the contract template — 14 fields in column order. Allow
 * extra whitespace between cells (pdfjs varies). Return null on miss.
 *
 * Field order:
 *   unitNum | workArea | unitName | elevation | gate | interPlant |
 *   acres | totalSeedlingsPerAcre | avgSpacing | minSpacing |
 *   maxSeedlingsPerPlot | speciesCode | stockType |
 *   seedlingsPerAcreBySpecies | totalTreesBySpecies
 */
function parseUnitRow(rowText) {
  // unit name can be multi-word ("Unit 1", "Unit 2A", "Aspen Patch") so
  // we anchor on numeric/Yes-No fields around it. Walk left-to-right,
  // consuming tokens by expected type.
  const tokens = rowText.trim().split(/\s+/);
  if (tokens.length < 14) return null;

  // First token: unit number (integer, 1-3 digits). Anything else =
  // not a row start.
  if (!/^\d{1,3}$/.test(tokens[0])) return null;
  const unitNum = parseInt(tokens[0], 10);

  // Hunt the elevation field — pattern \d{3,4}-\d{3,4} or single \d+
  // — to find where unit name ends. Everything between token 1 and
  // (elevation index) is workArea + unitName.
  let elevationIdx = -1;
  for (let i = 2; i < tokens.length; i++) {
    if (/^\d{3,5}(-\d{3,5})?$/.test(tokens[i])) {
      // ensure next two tokens are Yes/No (gate + inter plant)
      if (
        /^(Yes|No)$/i.test(tokens[i + 1] ?? "") &&
        /^(Yes|No)$/i.test(tokens[i + 2] ?? "")
      ) {
        elevationIdx = i;
        break;
      }
    }
  }
  if (elevationIdx < 0) return null;

  const workArea = tokens[1];
  const unitName = tokens.slice(2, elevationIdx).join(" ");
  const elevation = tokens[elevationIdx];
  const gate = tokens[elevationIdx + 1];
  const interPlant = tokens[elevationIdx + 2];
  // Remaining numeric/code fields:
  let i = elevationIdx + 3;
  const acres = parseFloat(tokens[i++]);
  const seedlingsPerAcre = parseInt(tokens[i++], 10);
  const avgSpacing = parseFloat(tokens[i++]);
  const minSpacing = parseFloat(tokens[i++]);
  const maxSeedlingsPerPlot = parseInt(tokens[i++], 10);
  const speciesCode = tokens[i++];
  const stockType = tokens[i++];
  const seedlingsPerAcreBySpecies = parseInt(tokens[i++], 10);
  // Total trees can include commas — consume the rest of the row in
  // case it spilled (it shouldn't, but DocuSign formatting wobbles).
  const totalTreesRaw = (tokens[i] ?? "").replace(/,/g, "");
  const totalTrees = parseInt(totalTreesRaw, 10);

  if (Number.isNaN(acres) || !unitName) return null;

  return {
    unitNum,
    workArea,
    unitName,
    elevation,
    gate,
    interPlant,
    acres,
    seedlingsPerAcre,
    avgSpacing,
    minSpacing,
    maxSeedlingsPerPlot,
    speciesCode,
    stockType,
    seedlingsPerAcreBySpecies,
    totalTrees,
  };
}

/**
 * Find the Section II-A unit table inside the flat text and return
 * each row's parse. Anchors on the last column header
 * ("Total Trees by Species") so we know where the data rows start.
 */
function extractUnitTable(allText) {
  // Find the START anchor: the words "SECTION II-A" then the column
  // headers immediately above the first data row. Use "Total Trees by
  // Species" as the rightmost header — once we pass it, we're in the
  // data rows. Stop when we hit "SECTION II-A: DETAILED" (the next
  // sub-section) or "SECTION II-B" (the aspen-id page).
  const headerRe = /Total\s+Trees\s+by\s+Species/i;
  const stopRe = /SECTION\s+II-A:\s*DETAILED|SECTION\s+II-B/i;
  const headerMatch = headerRe.exec(allText);
  if (!headerMatch) return [];
  const stopMatch = stopRe.exec(allText.slice(headerMatch.index));
  const tableSlice = stopMatch
    ? allText.slice(headerMatch.index + headerMatch[0].length, headerMatch.index + stopMatch.index)
    : allText.slice(headerMatch.index + headerMatch[0].length);

  // Each unit row starts with a 1-3 digit unit number. The simplest
  // boundary heuristic: split on whitespace runs that contain at least
  // one newline AND are followed by a 1-3 digit number — but pdfjs
  // strips newlines. Instead, walk tokens and try to parse rows
  // greedily; advance past the consumed tokens.
  const tokens = tableSlice.trim().split(/\s+/);
  const rows = [];
  let cursor = 0;
  // Each successful row consumes ~14-16 tokens depending on unit name
  // length. Cap iterations to avoid infinite loops on unexpected
  // input.
  let safety = 200;
  while (cursor < tokens.length && safety-- > 0) {
    // Find next 1-3 digit unit number at cursor
    if (!/^\d{1,3}$/.test(tokens[cursor])) {
      cursor++;
      continue;
    }
    // Try parsing a row starting here; we need at least 14 tokens
    // ahead.
    const slice = tokens.slice(cursor, cursor + 25).join(" ");
    const row = parseUnitRow(slice);
    if (row) {
      rows.push(row);
      // Advance cursor past consumed tokens. parseUnitRow doesn't tell
      // us the exact count, so re-tokenize the consumed window: 1
      // (unitNum) + 1 (workArea) + N (unitName) + 1 (elev) + 2 (Y/N)
      // + 9 (numeric/code fields) = 14 + (N-1).
      const unitNameTokens = row.unitName.split(/\s+/).length;
      cursor += 14 + (unitNameTokens - 1);
    } else {
      cursor++;
    }
  }
  return rows;
}

/**
 * @param {Buffer | ArrayBuffer | Uint8Array} buffer
 */
export async function parseDnrReforContract(buffer) {
  // pdfjs explicitly rejects Node Buffer. Construct a real Uint8Array
  // over the same bytes — see manulife-data-sheet-pdf.mjs comment.
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
  // Universal location extraction — runs on the full doc text so GPS
  // pins and township/range info in any header / footer / legal block
  // get pulled in. Shared across every row in this contract.
  const sharedLocation = extractLocation(allText);
  const unitRows = extractUnitTable(allText);
  const { county, state } = extractLegalLocation(allText);
  const projectName = extractProjectName(allText);

  if (unitRows.length === 0) {
    // Couldn't find the unit table — queue the file for office review
    // with a single placeholder row so it shows up in the queue.
    sheetWarnings.push("unit_table_not_found: SECTION II-A header not parsed");
    return {
      formatTag: FORMAT_TAG,
      version: PARSER_VERSION,
      rowCount: 0,
      parsed: [
        {
          canonicalRow: {
            name: projectName || "DNR contract — unit table not parsed",
            notes: "Auto-imported from DNR refor contract PDF — Section II-A unit table couldn't be parsed. Fill in unit details manually from the source.",
          },
          sourceRow: { projectName, county, state },
          unmappedFields: {},
          warnings: ["unit_table_not_found"],
        },
      ],
      sheetWarnings,
    };
  }

  const parsed = unitRows.map((u) => {
    const canonicalRow = {
      // Combine work area + unit name when work area is non-trivial,
      // so "Goosmus / Unit 1" reads cleaner than "Unit 1" alone (the
      // latter clashes with every other DNR contract that also has
      // "Unit 1"). If projectName is unique enough, fall back to it.
      name: `${u.workArea} ${u.unitName}`.trim(),
    };
    if (Number.isFinite(u.acres)) {
      canonicalRow.amount = u.acres;
      canonicalRow.amount_type = "acre";
    }
    if (state) canonicalRow.state = canonicalizeState(state);
    if (county) canonicalRow.county = county;
    canonicalRow.work_type = canonicalizeWorkType("Planting");
    if (Number.isFinite(u.avgSpacing) && Number.isFinite(u.minSpacing)) {
      canonicalRow.target_spacing = `${u.avgSpacing}x${u.minSpacing}`;
    }
    // units.species is text[] — wrap singletons. DNR contracts can list
    // multiple species per unit ("WL,DF"), but the sample we've parsed
    // so far always has one code per row. Split on comma defensively
    // so the multi-species case lands as a real array rather than as
    // one string with a comma in it.
    if (u.speciesCode) {
      canonicalRow.species = u.speciesCode
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (u.stockType) canonicalRow.stock_type = u.stockType;
    if (Number.isFinite(u.seedlingsPerAcre)) {
      canonicalRow.seedlings_per_acre = u.seedlingsPerAcre;
    }
    if (Number.isFinite(u.totalTrees)) {
      canonicalRow.total_seedlings = u.totalTrees;
    }
    // Elevation is a "min-max" string in the contract; split if it has
    // a dash.
    if (u.elevation && u.elevation.includes("-")) {
      const [lo, hi] = u.elevation.split("-").map((s) => parseInt(s, 10));
      if (Number.isFinite(lo)) canonicalRow.elevation_min = lo;
      if (Number.isFinite(hi)) canonicalRow.elevation_max = hi;
    }
    const noteParts = [];
    if (projectName) noteParts.push(`Project: ${projectName}`);
    if (u.gate) noteParts.push(`Gate: ${u.gate}`);
    if (u.interPlant) noteParts.push(`Inter-plant: ${u.interPlant}`);
    if (noteParts.length > 0) canonicalRow.notes = noteParts.join(" · ");

    // Universal-field pass — fold in GPS / township when the doc had them.
    if (sharedLocation.latitude != null) canonicalRow.latitude = sharedLocation.latitude;
    if (sharedLocation.longitude != null) canonicalRow.longitude = sharedLocation.longitude;
    if (sharedLocation.township_range) canonicalRow.township_range = sharedLocation.township_range;

    return {
      canonicalRow,
      sourceRow: {
        unitNum: u.unitNum,
        workArea: u.workArea,
        unitName: u.unitName,
        elevation: u.elevation,
        gate: u.gate,
        interPlant: u.interPlant,
        acres: u.acres,
        totalSeedlingsPerAcre: u.seedlingsPerAcre,
        avgSpacing: u.avgSpacing,
        minSpacing: u.minSpacing,
        maxSeedlingsPerPlot: u.maxSeedlingsPerPlot,
        speciesCode: u.speciesCode,
        stockType: u.stockType,
        seedlingsPerAcreBySpecies: u.seedlingsPerAcreBySpecies,
        totalTreesBySpecies: u.totalTrees,
        projectName,
        county,
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
