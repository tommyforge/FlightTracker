# Flight Tracker — Project Context

## Stack
- Next.js 14 (App Router), TypeScript (strict), SCSS Modules, Node.js
- No state management library — use React context + useReducer
- No UI component libraries

## Goal
Live global flight tracker. Sortable, filterable table of all active flights.

---

## Data Sources

### 1. Live Flight States — FREE, no key
```
GET https://opensky-network.org/api/states/all
```
Returns: icao24, callsign, origin_country, lon, lat, baro_altitude, on_ground, velocity (m/s), true_track, vertical_rate  
Rate limit: anonymous = 10s resolution, 400 flights max. Registered = full dataset.  
Refresh: every 30s.

### 2. Aircraft Type/Model — FREE, requires free OpenSky account
Register at opensky-network.org → get `client_id` + `client_secret`.  
Auth token endpoint:
```
POST https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token
body: grant_type=client_credentials&client_id=...&client_secret=...
```
Then:
```
GET https://opensky-network.org/api/metadata/aircraft/icao/{icao24}
```
Returns: typecode, manufacturer, model, owner, operator  
**Cache results** — fetch once per icao24, store in-memory Map. Do not re-fetch on every refresh.

### 3. Airline Name — FREE, no key, static lookup
Bundle `src/data/airlines.json` — map ICAO callsign prefix (first 3 chars) → airline name + country.  
Source to generate from: https://github.com/nicovak/ICAO-airline-designators (public domain JSON).  
Derive airline from `callsign.slice(0, 3)`.

### 4. Domestic / International — requires API key (free tier: 100 req/month)
```
GET https://api.aviationstack.com/v1/flights?access_key={KEY}&flight_icao={callsign}
```
Returns: dep_iata, arr_iata, dep_country, arr_country  
Domestic = dep_country === arr_country.  
**Cache per callsign. Only fetch for visible/filtered rows** (not all 10k flights).  
Env var: `AVIATIONSTACK_API_KEY`  
If key absent: show "—" for domestic/international column. Do not throw.

---

## Environment Variables
```
# .env.local
OPENSKY_CLIENT_ID=<your-opensky-client-id>
OPENSKY_CLIENT_SECRET=<your-opensky-client-secret>
AVIATIONSTACK_API_KEY=<your-aviationstack-api-key>
```

---

## API Routes (Next.js Route Handlers)

| Route | Purpose |
|---|---|
| `GET /api/flights` | Proxy OpenSky states. Adds airline name from static JSON. Returns enriched array. |
| `GET /api/aircraft/[icao24]` | Proxy OpenSky metadata. Server-side cache (Map, TTL 1h). |
| `GET /api/route/[callsign]` | Proxy AviationStack. Returns dep/arr country. Server-side cache (Map, TTL 1h). |

All routes handle missing env vars gracefully — return partial data, never 500.

---

## Data Model
```ts
interface Flight {
  icao24: string
  callsign: string
  originCountry: string       // from OpenSky states
  airline: string | null      // from static JSON lookup
  airlineCountry: string | null
  aircraftType: string | null // from OpenSky metadata (lazy)
  manufacturer: string | null
  lat: number | null
  lon: number | null
  altitudeM: number | null
  speedKts: number | null     // convert from m/s: * 1.94384
  heading: number | null
  verticalRate: number | null
  onGround: boolean
  isDomestic: boolean | null  // from AviationStack (lazy)
  depCountry: string | null
  arrCountry: string | null
}
```

---

## Filters (all client-side after initial fetch)
- **Search**: callsign, airline, country (text input)
- **Airline country**: dropdown from unique values
- **Airline**: dropdown from unique values
- **Aircraft type**: dropdown from unique values (populated lazily as metadata loads)
- **Status**: All / Airborne / Grounded
- **Altitude band**: All / Low (<3000m) / Mid (3000–9000m) / High (>9000m)
- **Domestic/International**: All / Domestic / International (null = "—")

---

## Table Columns & Sort
All columns sortable (click header, toggle asc/desc):  
Callsign | Airline | Airline Country | Aircraft Type | Origin Country | Altitude | Speed | Heading | V-Rate | Status | Dom/Intl

Pagination: 50 / 100 / 200 per page.

---

## UI
- Dark aviation terminal aesthetic — monospace font for data cells
- SCSS variables in `src/styles/_variables.scss`
- No inline styles
- Loading skeleton rows (not spinner) while fetching
- Aircraft type + Dom/Intl columns show skeleton shimmer while lazy-loading
- Auto-refresh badge showing countdown to next refresh

---

## Constraints
- All API calls go through Next.js route handlers (never call OpenSky/AviationStack directly from browser — CORS)
- Server-side caches use module-level Maps (acceptable for single-instance dev/preview; document this)
- TypeScript strict — no `any`
- SCSS modules only — no global styles except `_variables.scss` and `globals.scss`
