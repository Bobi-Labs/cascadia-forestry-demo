/**
 * Universal location extractor — runs over any text blob a parser
 * produces and pulls out GPS coordinates + township/range when present.
 *
 * Per Bees on 2026-05-14: every parser tries every field, NULL when
 * the source doc doesn't carry it. GPS and township/range are the
 * highest-value universal fields — they appear in most landowner
 * spec docs (header block, per-unit row, or a sidebar) and let the
 * Maps page surface unit pins without manual entry.
 *
 * Returns { latitude, longitude, township_range } — any of which
 * may be null if not found. Caller spreads the result into the
 * canonical row; the unit form's existing NULL handling does the rest.
 *
 * Pacific NW sanity bounds:
 *   - latitude:  42.0 to 49.0 (OR/WA/ID range)
 *   - longitude: -125.0 to -116.0
 * Values outside these ranges are rejected as false matches (e.g.
 * a stand_key or area number that happens to look like coordinates).
 */

// Coordinate ranges for the territory we actually work in. Anything
// outside is almost certainly a false match against numeric data
// elsewhere in the doc (acres, elevation, stand keys, etc.).
const LAT_MIN = 42.0;
const LAT_MAX = 49.0;
const LON_MIN = -125.0;
const LON_MAX = -116.0;

/**
 * Decimal-degree pairs, comma- or whitespace-separated. Order-agnostic
 * (lat-first or lon-first both match) — the caller's bounding-box
 * check disambiguates which value is which.
 *
 * Permissive on whitespace, optional sign, optional N/S/E/W suffix.
 * Integer part 2-3 digits to handle PNW longitudes (e.g. -122.5).
 *
 * Examples that match:
 *   "45.1234, -122.5678"            (lat, lon — standard)
 *   "-122.57317 46.04515"           (lon, lat — WY plantation exams)
 *   "45.1234,-122.5678"
 *   "lat 45.1234 lon -122.5678"
 *   "45.1234° N, 122.5678° W"
 */
const DECIMAL_PAIR_RE = /(-?\d{2,3}\.\d{2,8})\s*°?\s*[NSEW]?\s*[,\s]\s*(-?\d{2,3}\.\d{2,8})\s*°?\s*[NSEW]?/i;

/**
 * Township / range — "T7N R3E S15" or "T07N R03E" or "T7N R3E" (no section).
 * Permissive on spacing and case.
 */
const TOWNSHIP_RE = /\bT\s*0?(\d{1,3})\s*([NS])\s+R\s*0?(\d{1,3})\s*([EW])(?:\s+S\s*0?(\d{1,3}))?\b/i;

/**
 * @param {string | null | undefined} text  raw text from the parsed doc
 * @returns {{ latitude: number | null, longitude: number | null, township_range: string | null }}
 */
export function extractLocation(text) {
  if (!text || typeof text !== "string") {
    return { latitude: null, longitude: null, township_range: null };
  }

  let latitude = null;
  let longitude = null;
  let township_range = null;

  // GPS: scan all decimal-degree pairs. Each pair could be (lat, lon)
  // OR (lon, lat) depending on the doc's convention — WY plantation
  // exams use lon-first. Disambiguate using the PNW bounding box:
  // latitudes are 42-49, longitudes are -125 to -116 (or 116-125 unsigned).
  // Whichever assignment of the two numbers falls inside both ranges wins.
  const re = new RegExp(DECIMAL_PAIR_RE.source, "gi");
  let m;
  while ((m = re.exec(text)) !== null) {
    const a = parseFloat(m[1]);
    const b = parseFloat(m[2]);
    // Try a as latitude, b as longitude (with auto-negate for PNW lon)
    const candidates = [
      { lat: a, lon: b > 0 && b >= 116 && b <= 125 ? -b : b },
      { lat: b, lon: a > 0 && a >= 116 && a <= 125 ? -a : a },
    ];
    for (const c of candidates) {
      if (c.lat >= LAT_MIN && c.lat <= LAT_MAX && c.lon >= LON_MIN && c.lon <= LON_MAX) {
        latitude = c.lat;
        longitude = c.lon;
        break;
      }
    }
    if (latitude != null) break;
  }

  // Township/range — first match wins. Normalize to "T7N R3E S15"
  // (or "T7N R3E" if no section). Strips leading zeros from numbers
  // for consistency with the unit form's freeform input convention.
  const tm = TOWNSHIP_RE.exec(text);
  if (tm) {
    const t = parseInt(tm[1], 10);
    const r = parseInt(tm[3], 10);
    const tDir = tm[2].toUpperCase();
    const rDir = tm[4].toUpperCase();
    const sec = tm[5] ? ` S${parseInt(tm[5], 10)}` : "";
    township_range = `T${t}${tDir} R${r}${rDir}${sec}`;
  }

  return { latitude, longitude, township_range };
}
