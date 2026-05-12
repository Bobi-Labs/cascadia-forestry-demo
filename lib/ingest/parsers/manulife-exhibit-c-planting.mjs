/**
 * Manulife "Exhibit C — Planting" PDF parser (Mode B).
 *
 * Format tag: `manulife-exhibit-c-planting`. Sibling to the
 * awarded-units data-sheet parser. Both are Manulife formats but
 * cover different document types:
 *
 *   data-sheet:  high-level awarded-units summary (1 row per unit,
 *                CommonName + GIS Area + Season + State + County)
 *   exhibit C:   per-unit planting specs (1 row per unit, with
 *                stocking-density data — TPA, total trees, spacing,
 *                species, elevation, acres)
 *
 * Both produce canonical rows that flow into the same `units` table.
 * Exhibit C carries more silviculture detail so when it's available,
 * units land more populated than they would from the data-sheet alone.
 *
 * Column structure verified against the May 13 sample
 * (La Grande 2026 / Exhibit C Planting.pdf):
 *
 *   Client | JobName | Line | PlantType | TPA | EstimatedTotalTrees |
 *     Spacing | Species | Elevation | Acres
 *
 * Where:
 *   Client     — 2-3 letter property code (LG, SO, BL, EC, SM, ...)
 *   JobName    — 1-3 words (unit name; ends with the property code)
 *   Line       — empty for most rows; "x" for interplants / special
 *   PlantType  — "Plant" | "Re-Plant" | "Inter-Plant"
 *   TPA        — trees per acre (100-400 typical)
 *   Total      — total trees for the unit (with comma sep on big nums)
 *   Spacing    — NNxNN (e.g. 12x12, 13X13)
 *   Species    — multi-word (Western larch, Douglas-fir, Ponderosa pine)
 *   Elevation  — feet, integer
 *   Acres      — decimal
 *
 * pdfjs returns a flat text blob; we tokenize on whitespace and
 * anchor each row on a spacing token (NNxNN), then walk outward to
 * extract the surrounding fields.
 */

import { canonicalizeWorkType } from "../canonicalize.mjs";
import { extractLocation } from "../extract-location.mjs";

// Reuse the pdfjs setup pattern from the data-sheet parser.
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

export const FORMAT_TAG = "manulife-exhibit-c-planting";
export const PARSER_VERSION = 1;

// Spacing pattern: 12x12, 13X13, 8x10, etc. Case-insensitive.
const SPACING_RE = /^\d{1,2}[xX]\d{1,2}$/;
// PlantType tokens (exact match, no embedded spacing).
const PLANT_TYPES = new Set(["Plant", "Re-Plant", "Inter-Plant", "Replant", "Interplant"]);
// Property codes are short uppercase (2-4 letters typical).
const PROPERTY_CODE_RE = /^[A-Z]{2,4}$/;
// Species tokens we recognize. Keys are canonical names; values list
// the token sequences (lowercased) that should match. The parser
// matches greedily — longest sequence wins.
const SPECIES_TOKENS = [
  { name: "Douglas Fir",        match: [["douglas-fir"], ["douglas", "fir"]] },
  { name: "Western Larch",      match: [["western", "larch"]] },
  { name: "Ponderosa Pine",     match: [["ponderosa", "pine"]] },
  { name: "Western Hemlock",    match: [["western", "hemlock"]] },
  { name: "Western Red Cedar",  match: [["western", "red", "cedar"]] },
  { name: "Lodgepole Pine",     match: [["lodgepole", "pine"]] },
  { name: "Grand Fir",          match: [["grand", "fir"]] },
  { name: "Noble Fir",          match: [["noble", "fir"]] },
  { name: "White Pine",         match: [["white", "pine"]] },
  { name: "Sugar Pine",         match: [["sugar", "pine"]] },
];

/**
 * Try to match a species starting at tokens[i]. Returns
 *   { canonical, consumed } if a match is found, else null.
 */
function matchSpecies(tokens, i) {
  const lower = (s) => s.toLowerCase().replace(/,$/, "");
  for (const sp of SPECIES_TOKENS) {
    for (const seq of sp.match) {
      let ok = true;
      for (let k = 0; k < seq.length; k++) {
        if (lower(tokens[i + k] ?? "") !== seq[k]) { ok = false; break; }
      }
      if (ok) return { canonical: sp.name, consumed: seq.length };
    }
  }
  return null;
}

/**
 * Push a parsed row into the result array. Builds the canonical
 * shape + source mirror; keeps the main loop readable.
 */
function pushRow(parsed, propertyCode, jobName, plantType, tpa, total, spacing, speciesList, elevation, acres, sharedLocation = {}) {
  const canonicalRow = {
    name: jobName,
    work_type: canonicalizeWorkType(plantType) || "Planting",
    amount: acres,
    amount_type: "acre",
    target_spacing: spacing,
    tpa_target: tpa,
    total_seedlings: total,
    species: speciesList.map((sp) => JSON.stringify({ name: sp, stockType: "", count: null })),
    elevation_min: elevation,
    elevation_max: elevation,
    notes: `Imported from Manulife Exhibit C — Planting. Property: ${propertyCode}. Plant type: ${plantType}.`,
  };
  // Universal-field pass — copy in any GPS / township the doc carried.
  // NULLs are fine (per the field-coverage rule); only set keys that
  // actually have a value so we don't overwrite with nulls.
  if (sharedLocation.latitude != null) canonicalRow.latitude = sharedLocation.latitude;
  if (sharedLocation.longitude != null) canonicalRow.longitude = sharedLocation.longitude;
  if (sharedLocation.township_range) canonicalRow.township_range = sharedLocation.township_range;
  parsed.push({
    canonicalRow,
    sourceRow: {
      property: propertyCode,
      jobName,
      plantType,
      tpa,
      totalTrees: total,
      spacing,
      species: speciesList,
      elevation,
      acres,
    },
    unmappedFields: {},
    warnings: [],
  });
}

/**
 * @param {Buffer | ArrayBuffer | Uint8Array} buffer
 * @param {{filename?: string}} [_context]
 */
export async function parseManulifeExhibitCPlanting(buffer, _context = {}) {
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
  const parsed = [];

  // Flatten all pages into one text blob.
  let allText = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const txt = await page.getTextContent();
    for (const item of txt.items) {
      if (typeof item.str === "string") allText += " " + item.str;
    }
  }

  // Skip past the column header. Anchor on "Acres" (last header column)
  // — header line is "... Species Elevation Acres" — the first occurrence
  // is the header word, not a data value.
  const headerEnd = allText.search(/Acres/i);
  if (headerEnd < 0) {
    sheetWarnings.push("header row not found (expected 'Acres' column header)");
    return { formatTag: FORMAT_TAG, version: PARSER_VERSION, rowCount: 0, parsed, sheetWarnings };
  }
  const dataText = allText.slice(headerEnd).replace(/^Acres/i, "").replace(/\s+/g, " ").trim();
  const tokens = dataText.split(/\s+/);

  // Universal location pass — pull GPS / township from anywhere in the
  // full text (often in a header block before the data table). Same
  // location is applied to every row since Exhibit C is a per-contract
  // doc, not per-unit GPS data. If per-unit GPS appears in the future
  // we'd switch to a per-row extract.
  const sharedLocation = extractLocation(allText);

  // Track the index immediately after the previous row's acres token
  // — that's where the next row starts (with its Client property code).
  // Seeds at 0 so the first row picks up tokens[0] as the Client code.
  // This is more reliable than walking back from PlantType looking for
  // a property code, because property codes also appear as suffixes
  // inside job names ("Anchor DF-SO" ends in SO). Anchoring on the
  // row boundary avoids that collision.
  let rowStart = 0;

  for (let s = 0; s < tokens.length; s++) {
    if (!SPACING_RE.test(tokens[s])) continue;

    // PlantType should sit at s-3 (TPA at s-2, Total at s-1, Spacing at s)
    const ptIdx = s - 3;
    if (ptIdx < 1) continue;
    if (!PLANT_TYPES.has(tokens[ptIdx])) continue;

    const tpaIdx = s - 2;
    const totalIdx = s - 1;
    const spacingIdx = s;

    const tpa = parseInt(tokens[tpaIdx], 10);
    if (isNaN(tpa) || tpa < 50 || tpa > 1000) continue;

    const total = parseInt(tokens[totalIdx].replace(/,/g, ""), 10);
    if (isNaN(total) || total < 1) continue;

    const spacing = tokens[spacingIdx].toLowerCase();

    // Walk forward from spacing for species
    let speciesEnd = spacingIdx;
    const speciesMatch = matchSpecies(tokens, spacingIdx + 1);
    const speciesList = [];
    if (speciesMatch) {
      speciesList.push(speciesMatch.canonical);
      speciesEnd = spacingIdx + speciesMatch.consumed;
    } else {
      sheetWarnings.push(`unrecognized species starting at "${tokens[spacingIdx + 1] ?? "(end)"}"`);
      continue;
    }

    const elevIdx = speciesEnd + 1;
    const acresIdx = speciesEnd + 2;
    if (acresIdx >= tokens.length) continue;
    const elevation = parseInt(tokens[elevIdx], 10);
    const acres = parseFloat(tokens[acresIdx]);
    if (isNaN(elevation) || isNaN(acres)) continue;

    // Row spans [rowStart, ptIdx). First token at rowStart should be
    // the Client property code; everything between is the JobName,
    // possibly with a trailing 'x' Line flag.
    if (rowStart >= ptIdx) {
      // No room for a property code + JobName — bail and try the
      // property-code-walkback fallback so we don't silently drop the row.
      let nameStart = -1;
      let propCode = "";
      for (let j = ptIdx - 1; j >= Math.max(0, ptIdx - 8); j--) {
        if (tokens[j] === "x" && j === ptIdx - 1) continue;
        if (PROPERTY_CODE_RE.test(tokens[j])) {
          nameStart = j + 1;
          propCode = tokens[j];
          break;
        }
      }
      if (nameStart < 0) {
        sheetWarnings.push(`row boundary lost near token index ${ptIdx} ("${tokens[ptIdx]}")`);
        rowStart = acresIdx + 1;
        continue;
      }
      const nameTokens = tokens.slice(nameStart, ptIdx).filter((t) => t !== "x");
      const jobName = nameTokens.join(" ").trim();
      if (!jobName) { rowStart = acresIdx + 1; continue; }
      pushRow(parsed, propCode, jobName, tokens[ptIdx], tpa, total, spacing, speciesList, elevation, acres, sharedLocation);
      rowStart = acresIdx + 1;
      continue;
    }

    let propertyCode = tokens[rowStart];
    let nameStart = rowStart + 1;
    if (!PROPERTY_CODE_RE.test(propertyCode)) {
      // First token isn't a property code — possibly a JobName that
      // starts mid-word from previous-row spillover. Try to recover by
      // looking for the property code anywhere in this slice.
      const slice = tokens.slice(rowStart, ptIdx);
      const propIdx = slice.findIndex((t) => PROPERTY_CODE_RE.test(t));
      if (propIdx < 0) {
        sheetWarnings.push(`row at index ${rowStart} has no property code: starts with "${propertyCode}"`);
        rowStart = acresIdx + 1;
        continue;
      }
      propertyCode = slice[propIdx];
      nameStart = rowStart + propIdx + 1;
    }

    const nameTokens = tokens.slice(nameStart, ptIdx).filter((t) => t !== "x");
    const jobName = nameTokens.join(" ").trim();
    if (!jobName) {
      sheetWarnings.push(`empty JobName at row starting "${propertyCode}"`);
      rowStart = acresIdx + 1;
      continue;
    }

    pushRow(parsed, propertyCode, jobName, tokens[ptIdx], tpa, total, spacing, speciesList, elevation, acres, sharedLocation);
    rowStart = acresIdx + 1;
  }

  if (sharedLocation.latitude != null || sharedLocation.township_range) {
    sheetWarnings.push(
      `location_extracted: lat=${sharedLocation.latitude ?? "—"} lon=${sharedLocation.longitude ?? "—"} township=${sharedLocation.township_range ?? "—"}`
    );
  }

  if (parsed.length === 0) {
    sheetWarnings.push("0 rows parsed — file may not be Exhibit C format, or column order changed");
  }

  return {
    formatTag: FORMAT_TAG,
    version: PARSER_VERSION,
    rowCount: parsed.length,
    parsed,
    sheetWarnings,
  };
}
