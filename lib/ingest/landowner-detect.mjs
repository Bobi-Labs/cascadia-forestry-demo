/**
 * Landowner + format detection from Drive folder ancestry + filename.
 *
 * Item 8 — Unit Data Ingest. Stage 2 component.
 *
 * The Drive folder structure follows:
 *   Contracts/<Landowner>/<Project>/Maps & Specs/<file>
 *   Contracts/<Landowner>/<Project>/Units/<TractName>, <UnitID>/<file>
 *
 * The watcher walks this tree and uses two signals to route a file to
 * the right parser:
 *
 * 1. **Landowner** — the second path component (`<Landowner>`).
 *    Maps directly to one of the canonical landowner keys we have
 *    column maps for. Unrecognized → 'unknown', file gets queued for
 *    office review with reason='unknown_landowner'.
 *
 * 2. **Format tag** — the specific file format within a landowner.
 *    Detected by filename pattern (e.g. `PlantationExam_*.pdf` → WY
 *    plantation-exam format). Some landowners have multiple formats
 *    (Manulife: xlsx awarded units, PDF exhibit B specs, etc.).
 *
 * Files that don't match any known format for the detected landowner
 * are queued with reason='unmapped_columns' so the office can pick a
 * column map.
 *
 * The detection is intentionally conservative — better to flag for
 * review than parse the wrong format. Adding a new format = adding
 * one entry to FORMAT_PATTERNS below + a parser in
 * lib/ingest/parsers/.
 */

/**
 * @typedef {"weyerhaeuser" | "manulife" | "usace" | "dnr" | "hood-river"
 *   | "chelan-county" | "chilton" | "vaagen-bros" | "mcfeg" | "private"
 *   | "unknown"} LandownerKey
 */

/**
 * Canonical landowner keys mapped from the Drive folder name in
 * `Contracts/<FolderName>/...`. Folder names are checked
 * case-insensitively against the list of keywords for each landowner.
 */
const LANDOWNER_FOLDER_KEYWORDS = {
  weyerhaeuser:    ["weyerhaeuser"],
  manulife:        ["manulife"],
  usace:           ["us army corps", "usace"],
  dnr:             ["dnr", "dept. of natural resources"],
  "hood-river":    ["hood river"],
  "chelan-county": ["chelan county", "chelan natural resources"],
  chilton:         ["chilton"],
  "vaagen-bros":   ["vaagen"],
  mcfeg:           ["mid columbia fisheries", "mcfeg"],
  private:         ["private"],
};

/** @returns {LandownerKey} */
export function detectLandownerFromFolderName(folderName) {
  const lower = (folderName ?? "").toLowerCase();
  for (const [key, keywords] of Object.entries(LANDOWNER_FOLDER_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) {
      return /** @type {LandownerKey} */ (key);
    }
  }
  return "unknown";
}

/**
 * Format tags = specific file format within a landowner. Format-tag
 * naming is `<landowner>-<distinct-format-name>`. The first matching
 * pattern wins; order patterns from most-specific to least.
 *
 * Each pattern: { landowner, formatTag, parserMode (A=xlsx, B=PDF),
 *   match(filename, mimeType) → bool }.
 */
export const FORMAT_PATTERNS = [
  // ─── Weyerhaeuser ───
  // The stand-id portion accepts \w (digits/letters/underscores). Real
  // Weyerhaeuser stand IDs are 7-10 digits (e.g. 1995281517) but our
  // test fixtures use 5-digit synthetic IDs (99001, 99002, …) so the
  // detector matches both. The leading anchor + literal prefix keep it
  // tight — only files of the exact PlantationExam_(Unit|Photo)NoPlots_
  // shape qualify.
  {
    landowner: "weyerhaeuser",
    formatTag: "wy-plantation-exam-unit",
    parserMode: "B",
    match: (n) => /^PlantationExam_UnitNoPlots_\w+\.pdf$/i.test(n),
  },
  {
    landowner: "weyerhaeuser",
    formatTag: "wy-plantation-exam-photo", // photos-only, skip parsing
    parserMode: "B",
    match: (n) => /^PlantationExam_PhotoNoPlots_\w+\.pdf$/i.test(n),
  },

  // ─── Manulife ───
  // The "awarded units" check accepts any single separator between the
  // two words (space, dash, underscore, period, none) so we don't reject
  // the same content under different filename conventions:
  //   "Copy of Ramos Awarded Units (1).xlsx"     ← production
  //   "Ramos Awarded Units TEST ALPHA.xlsx"      ← test fixture, canonical
  //   "manulife-ALPHA-Awarded-Units.xlsx"        ← human-typed via dashboard
  //   "Awarded_Units_2026.xlsx"                  ← potential variant
  {
    landowner: "manulife",
    formatTag: "manulife-awarded-units-xlsx",
    parserMode: "A",
    match: (n, mt) => /awarded[\s\-_.]?units/i.test(n) &&
      (mt === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
       /\.xlsx?$/i.test(n)),
  },
  // Same separator-tolerance for the data-sheet PDF + drop the start
  // anchor so "Manulife Data Sheet — 2026.pdf" matches alongside the
  // canonical "Data sheet. 2026 PCT manulife awarded.pdf".
  {
    landowner: "manulife",
    formatTag: "manulife-data-sheet-pdf",
    parserMode: "B",
    match: (n) => /data[\s\-_.]?sheet/i.test(n) &&
      /manulife/i.test(n) &&
      /awarded/i.test(n) &&
      /\.pdf$/i.test(n),
  },
  {
    landowner: "manulife",
    formatTag: "manulife-exhibit-b-specs",
    parserMode: "B",
    match: (n) => /^Exhibit B.*Tree Planting/i.test(n),
  },
  // Exhibit C — per-unit planting specs (TPA / total / spacing / species
  // / elevation / acres). Added 2026-05-14 after the May 13 La Grande
  // 2026 folder review. Distinct from Exhibit B (specs/specs-only); this
  // one carries the unit table that lands as canonical rows.
  {
    landowner: "manulife",
    formatTag: "manulife-exhibit-c-planting",
    parserMode: "B",
    match: (n) => /Exhibit\s*C.*Planting/i.test(n) && /\.pdf$/i.test(n),
  },
  // Payment Summary — Ramos completion + payment report. Per Jaime on
  // the May 14 call this is a "rare case" doc, but when it shows up it
  // can carry NEW unit data the project list hasn't seen yet. The
  // parser extracts only the unit-data fields (name, stock_type,
  // total_seedlings, property) — financials are out of scope until
  // the schema decision (unit_payments table vs production_logs) lands.
  {
    landowner: "manulife",
    formatTag: "manulife-payment-summary",
    parserMode: "B",
    match: (n) =>
      /Payment\s*Summary/i.test(n) &&
      /\.pdf$/i.test(n) &&
      // Distinguish from any unrelated "payment summary" docs by also
      // requiring either "Completed Units" or "Ramos" in the filename.
      (/Completed\s*Units/i.test(n) || /Ramos/i.test(n)),
  },

  // ─── USACE ───
  {
    landowner: "usace",
    formatTag: "usace-attachment-1",
    parserMode: "B",
    match: (n) => /^Attachment 1.*Information Sheet/i.test(n),
  },
  {
    landowner: "usace",
    formatTag: "usace-task-order",
    parserMode: "B",
    match: (n) => /^Task Order.*W912DW/i.test(n),
  },

  // ─── DNR ───
  {
    landowner: "dnr",
    formatTag: "dnr-silv-contract",
    parserMode: "B",
    match: (n) => /^lm_silv_contract_\d+/i.test(n),
  },
  {
    landowner: "dnr",
    formatTag: "dnr-herbicide-contract",
    parserMode: "B",
    match: (n) => /Ground_Herbicide.*Contract/i.test(n),
  },
  {
    landowner: "dnr",
    formatTag: "dnr-refor-contract",
    parserMode: "B",
    match: (n) => /Contract_\d+.*Refor/i.test(n),
  },

  // ─── Hood River ───
  {
    landowner: "hood-river",
    formatTag: "hr-vegetation-control-bid",
    parserMode: "B",
    match: (n) => /Ground Vegetation Control/i.test(n) && /\.pdf$/i.test(n),
  },
];

/**
 * @returns {{landowner: LandownerKey, formatTag: string, parserMode: "A"|"B"|"unknown"}}
 */
export function detectFormat(filename, mimeType, landowner) {
  for (const p of FORMAT_PATTERNS) {
    if (p.landowner === landowner && p.match(filename, mimeType)) {
      return { landowner: p.landowner, formatTag: p.formatTag, parserMode: p.parserMode };
    }
  }
  return { landowner, formatTag: "unknown", parserMode: "unknown" };
}
