import { createClient } from "@/lib/supabase/client";

/**
 * Today's weather across all locations where work is happening.
 *
 * Strategy:
 *   - Pull units belonging to active contracts
 *   - Group by (county, state)
 *   - For each group, pick a representative GPS coordinate:
 *       * First, any unit in the group that has lat/long
 *       * Otherwise, fall back to a hardcoded county-centroid lookup
 *         (for the WA / OR / ID counties this client's crews work in)
 *   - For each group with a coordinate, fetch NWS forecast
 *   - Return rows ordered by unit count (most active first)
 *
 * NWS API (api.weather.gov) is free, auth-free, and accurate. We cache
 * responses in-memory for 1 hour.
 */
export type CountyWeather = {
  county: string;
  state: string;
  unitCount: number;
  contractCount: number;
  contractNames: string[];        // distinct project names at this location
  high: number | null;
  low: number | null;
  condition: string;
  emoji: string;
  rainChance: number | null;
};

const cache = new Map<string, { data: Omit<CountyWeather, "unitCount" | "contractCount" | "contractNames">; expires: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

function emojiForCondition(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes("thunder")) return "⛈";
  if (c.includes("rain") || c.includes("shower")) return "🌧";
  if (c.includes("snow") || c.includes("flurr")) return "🌨";
  if (c.includes("fog") || c.includes("haze")) return "🌫";
  if (c.includes("partly") || c.includes("mostly")) return "⛅";
  if (c.includes("cloud") || c.includes("overcast")) return "☁️";
  if (c.includes("clear") || c.includes("sun")) return "☀️";
  return "🌤";
}

// Fallback county centroid lookup — used when no unit in a (county, state)
// group has a GPS coord. Covers the counties this client's crews work in
// (WA / OR / ID). Each entry is the approximate geographic centroid.
// Keys are normalized: lowercase county name (without "County" suffix) +
// "-" + lowercase state code.
const COUNTY_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  // Washington
  "lewis-wa":      { lat: 46.5,  lng: -122.4 },
  "cowlitz-wa":    { lat: 46.2,  lng: -122.7 },
  "thurston-wa":   { lat: 47.0,  lng: -122.9 },
  "pierce-wa":     { lat: 47.0,  lng: -122.3 },
  "stevens-wa":    { lat: 48.4,  lng: -117.9 },
  "ferry-wa":      { lat: 48.5,  lng: -118.5 },
  "skagit-wa":     { lat: 48.5,  lng: -121.8 },
  "snohomish-wa":  { lat: 48.0,  lng: -121.7 },
  "skamania-wa":   { lat: 46.0,  lng: -121.9 },
  "klickitat-wa":  { lat: 45.9,  lng: -120.8 },
  "okanogan-wa":   { lat: 48.5,  lng: -119.7 },
  "whatcom-wa":    { lat: 48.7,  lng: -121.9 },
  "grays harbor-wa": { lat: 47.0, lng: -123.7 },
  "pacific-wa":    { lat: 46.5,  lng: -123.7 },
  "clallam-wa":    { lat: 48.0,  lng: -123.9 },
  "jefferson-wa":  { lat: 47.8,  lng: -123.6 },
  "spokane-wa":    { lat: 47.6,  lng: -117.4 },
  "yakima-wa":     { lat: 46.5,  lng: -120.7 },
  // Oregon
  "columbia-or":   { lat: 46.0,  lng: -123.0 },
  "clatsop-or":    { lat: 46.0,  lng: -123.7 },
  "tillamook-or":  { lat: 45.5,  lng: -123.7 },
  "hood river-or": { lat: 45.7,  lng: -121.5 },
  "jackson-or":    { lat: 42.4,  lng: -122.9 },
  "washington-or": { lat: 45.6,  lng: -123.0 },
  "multnomah-or":  { lat: 45.5,  lng: -122.6 },
  "lane-or":       { lat: 44.0,  lng: -123.1 },
  "linn-or":       { lat: 44.5,  lng: -122.6 },
  "marion-or":     { lat: 44.9,  lng: -122.6 },
  "polk-or":       { lat: 44.9,  lng: -123.4 },
  "yamhill-or":    { lat: 45.2,  lng: -123.3 },
  // Idaho
  "shoshone-id":   { lat: 47.4,  lng: -115.7 },
  "boundary-id":   { lat: 48.7,  lng: -116.4 },
  "bonner-id":     { lat: 48.3,  lng: -116.5 },
  "benewah-id":    { lat: 47.2,  lng: -116.6 },
  "kootenai-id":   { lat: 47.7,  lng: -116.7 },
  "latah-id":      { lat: 46.8,  lng: -116.7 },
  "clearwater-id": { lat: 46.7,  lng: -115.6 },
};

function normalizeCounty(county: string): string {
  return county
    .trim()
    .toLowerCase()
    .replace(/\s+county\s*$/i, "")
    .replace(/\s+co\.?\s*$/i, "")
    .replace(/\s+/g, " ");
}

function normalizeState(state: string): string {
  const s = state.trim().toUpperCase();
  if (s === "WASHINGTON" || s === "WA") return "WA";
  if (s === "OREGON" || s === "OR") return "OR";
  if (s === "IDAHO" || s === "ID") return "ID";
  return s;
}

async function fetchForecast(lat: number, lng: number): Promise<{
  high: number | null;
  low: number | null;
  condition: string;
  rainChance: number | null;
} | null> {
  try {
    const pointsRes = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`, {
      headers: { "User-Agent": "cascadia-ramos-forestry-app (matthew@bobilabs.io)" },
    });
    if (!pointsRes.ok) return null;
    const pointsJson = await pointsRes.json();
    const forecastUrl = pointsJson?.properties?.forecast;
    if (!forecastUrl) return null;

    const fcastRes = await fetch(forecastUrl, {
      headers: { "User-Agent": "cascadia-ramos-forestry-app (matthew@bobilabs.io)" },
    });
    if (!fcastRes.ok) return null;
    const fcastJson = await fcastRes.json();
    const periods = fcastJson?.properties?.periods || [];
    if (periods.length === 0) return null;

    const dayPeriod = periods.find((p: { isDaytime: boolean }) => p.isDaytime) || periods[0];
    const nightPeriod = periods.find((p: { isDaytime: boolean }) => !p.isDaytime);

    return {
      high: typeof dayPeriod.temperature === "number" ? dayPeriod.temperature : null,
      low: nightPeriod && typeof nightPeriod.temperature === "number" ? nightPeriod.temperature : null,
      condition: dayPeriod.shortForecast || "—",
      rainChance: dayPeriod?.probabilityOfPrecipitation?.value ?? null,
    };
  } catch {
    return null;
  }
}

export async function getWeatherToday(): Promise<CountyWeather[]> {
  const supabase = createClient();

  // Pull active contracts + their units
  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, name, status")
    .eq("status", "active");
  if (!contracts || contracts.length === 0) return [];

  const contractIds = contracts.map((c) => c.id);
  const contractById = new Map(contracts.map((c) => [c.id, c.name as string | null]));

  const { data: units } = await supabase
    .from("units")
    .select("id, contract_id, county, state, latitude, longitude")
    .in("contract_id", contractIds);
  if (!units || units.length === 0) return [];

  // Group by (normalizedCounty, normalizedState)
  type Group = {
    county: string;
    state: string;
    units: typeof units;
    contractIds: Set<string>;
    representativeGPS: { lat: number; lng: number } | null;
  };
  const groups = new Map<string, Group>();
  for (const u of units) {
    if (!u.county || !u.state) continue;
    const ncounty = normalizeCounty(u.county);
    const nstate = normalizeState(u.state);
    const key = `${ncounty}-${nstate}`;
    if (!groups.has(key)) {
      groups.set(key, {
        county: u.county,
        state: nstate,
        units: [],
        contractIds: new Set(),
        representativeGPS: null,
      });
    }
    const g = groups.get(key)!;
    g.units.push(u);
    if (u.contract_id) g.contractIds.add(u.contract_id);
    if (u.latitude && u.longitude && !g.representativeGPS) {
      g.representativeGPS = { lat: Number(u.latitude), lng: Number(u.longitude) };
    }
  }

  // For groups without unit GPS, fall back to county-centroid lookup
  for (const [, g] of groups) {
    if (g.representativeGPS) continue;
    const ncounty = normalizeCounty(g.county);
    const nstate = normalizeState(g.state);
    const centroid = COUNTY_CENTROIDS[`${ncounty}-${nstate.toLowerCase()}`];
    if (centroid) g.representativeGPS = centroid;
  }

  // Sort groups by unit count, take top 20 (Bees: scrollable, 10-20)
  const sortedGroups = [...groups.values()]
    .filter((g) => g.representativeGPS !== null)
    .sort((a, b) => b.units.length - a.units.length)
    .slice(0, 20);

  // Fetch forecast for each (using cache)
  const results: CountyWeather[] = [];
  for (const g of sortedGroups) {
    const gps = g.representativeGPS!;
    const cacheKey = `${gps.lat.toFixed(2)},${gps.lng.toFixed(2)}`;
    let forecast = cache.get(cacheKey);
    if (!forecast || forecast.expires < Date.now()) {
      const f = await fetchForecast(gps.lat, gps.lng);
      if (f) {
        forecast = {
          data: {
            county: g.county,
            state: g.state,
            high: f.high,
            low: f.low,
            condition: f.condition,
            emoji: emojiForCondition(f.condition),
            rainChance: f.rainChance,
          },
          expires: Date.now() + CACHE_TTL_MS,
        };
        cache.set(cacheKey, forecast);
      }
    }
    if (!forecast) continue;

    const contractNames = [...g.contractIds]
      .map((id) => contractById.get(id))
      .filter((n): n is string => !!n)
      .sort();

    results.push({
      ...forecast.data,
      county: g.county,
      state: g.state,
      unitCount: g.units.length,
      contractCount: g.contractIds.size,
      contractNames,
    });
  }

  return results;
}
