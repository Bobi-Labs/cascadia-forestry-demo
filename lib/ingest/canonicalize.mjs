/**
 * Canonicalization helpers shared across parsers + orchestrator.
 *
 * Goal: when a parser produces "Washington" but the DB stores "WA",
 * the office shouldn't see a "unit_changed" review for a unit that
 * didn't actually change. Two things have to line up:
 *
 *   1. Parsers emit canonical values on `canonicalRow` — `state` is a
 *      2-letter US code, `work_type` is a normalized slug. This is what
 *      ends up in `unit_pending_review.proposed_unit`, so the office
 *      sees the same shape as the DB.
 *
 *   2. The orchestrator runs `diffUnits` before queueing a review. A
 *      name match alone isn't a change — only when at least one
 *      compared field actually differs do we record it as
 *      `reason: "unit_changed"`.
 *
 * This file is deliberately small + framework-free. Keep it that way —
 * parsers and process-batch.mjs both import from here.
 */

// US state names → USPS 2-letter codes. Pacific Northwest forestry rarely
// reaches outside WA/OR/ID/MT/CA, but we cover the contiguous + AK to
// be safe; adding territories on demand. Lookup is case-insensitive and
// trims whitespace at call time.
const STATE_NAME_TO_CODE = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
}

/**
 * Convert any state-shaped string into its USPS 2-letter code.
 * Already-canonical codes pass through unchanged. Unrecognized values
 * pass through unchanged so we don't silently drop edge cases.
 */
export function canonicalizeState(value) {
  if (value == null) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed
  if (/^[a-z]{2}$/.test(trimmed)) return trimmed.toUpperCase()
  const code = STATE_NAME_TO_CODE[trimmed.toLowerCase()]
  return code ?? trimmed
}

/**
 * Normalize a work_type label into the snake_case slug form used by
 * most existing rows. This is comparison-friendly: "Crop Maintenance",
 * "Crop  Maintenance", "crop_maintenance", "CROP MAINTENANCE" all
 * collapse to "crop_maintenance".
 *
 * The DB column has no enforced canonical form (it's a free-text mess
 * — see scripts/ingest/reset-test-data.mjs output for the live
 * histogram), so this normalization is what lets us compare without
 * false positives. We don't try to map onto the work_types table here;
 * that would mask values the office hasn't classified yet.
 */
export function canonicalizeWorkType(value) {
  if (value == null) return null
  const slug = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return slug || null
}

/**
 * Field-by-field diff between an existing unit (DB row) and a proposed
 * unit (parser output, post-canonicalize). Returns an array of
 * { field, existing, proposed } entries — one per actually-different
 * field. Empty array means "no real change; skip the review."
 *
 * Numeric fields use a small epsilon so 100.49 vs 100.4900001 don't
 * round-trip into a fake change. String fields are trimmed; null and
 * empty string compare equal.
 */
export function diffUnits(existing, proposed) {
  const fields = [
    "name",
    "state",
    "county",
    "work_type",
    "amount",
    "amount_type",
    "notes",
  ]
  const changes = []
  for (const f of fields) {
    let a = existing?.[f]
    let b = proposed?.[f]
    if (f === "state") {
      a = canonicalizeState(a)
      b = canonicalizeState(b)
    } else if (f === "work_type") {
      a = canonicalizeWorkType(a)
      b = canonicalizeWorkType(b)
    } else if (typeof a === "string" || typeof b === "string") {
      a = a == null ? null : String(a).trim()
      b = b == null ? null : String(b).trim()
    }
    // Treat null and empty string as equal.
    if ((a ?? "") === "" && (b ?? "") === "") continue
    if (typeof a === "number" && typeof b === "number") {
      if (Math.abs(a - b) < 0.001) continue
    }
    if ((a ?? null) === (b ?? null)) continue
    changes.push({ field: f, existing: a ?? null, proposed: b ?? null })
  }
  return changes
}
