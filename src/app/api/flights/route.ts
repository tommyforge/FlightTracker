import { NextResponse } from 'next/server'
import type { Flight } from '@/types/flight'
import { getOpenSkyToken } from '@/lib/opensky'

// OpenSky states/all returns a `states` array where each element is a fixed-position array.
// Indices: https://openskynetwork.github.io/opensky-api/rest.html#all-state-vectors
type StateVector = [
  string,         // 0  icao24
  string | null,  // 1  callsign
  string,         // 2  origin_country
  number | null,  // 3  time_position
  number | null,  // 4  last_contact
  number | null,  // 5  longitude
  number | null,  // 6  latitude
  number | null,  // 7  baro_altitude
  boolean,        // 8  on_ground
  number | null,  // 9  velocity (m/s)
  number | null,  // 10 true_track
  number | null,  // 11 vertical_rate
  unknown,        // 12 sensors
  number | null,  // 13 geo_altitude
  string | null,  // 14 squawk
  boolean,        // 15 spi
  number,         // 16 position_source
]

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const token = await getOpenSkyToken()

    // Build headers: Bearer token when credentials are present, anonymous otherwise
    const headers: HeadersInit = token
      ? { Authorization: `Bearer ${token}` }
      : {}

    let res: Response
    try {
      res = await fetch('https://opensky-network.org/api/states/all', {
        headers,
        cache: 'no-store',
      })
    } catch {
      return NextResponse.json({ error: 'OpenSky unreachable' }, { status: 502 })
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: `OpenSky returned ${res.status}` },
        { status: 502 }
      )
    }

    const data = (await res.json()) as { states: StateVector[] | null }
    const states = data.states ?? []

    const flights: Flight[] = states
      .filter((s) => s[1] !== null && s[1].trim() !== '')
      .map((s) => {
        const callsign = (s[1] as string).trim()
        const velocityMs = s[9]

        return {
          icao24: s[0],
          callsign,
          originCountry: s[2],
          airline: null,        // populated lazily via /api/aircraft/[icao24] (operator field)
          airlineCountry: null,
          aircraftType: null,   // populated lazily via /api/aircraft/[icao24]
          manufacturer: null,
          lat: s[6],
          lon: s[5],
          altitudeM: s[7],
          speedKts: velocityMs !== null ? Math.round(velocityMs * 1.94384) : null,
          heading: s[10],
          verticalRate: s[11],
          onGround: s[8],
          isDomestic: null,     // populated lazily via /api/route/[callsign]
          depCountry: null,
          arrCountry: null,
        }
      })

    return NextResponse.json(flights)
  } catch (err) {
    console.error('[/api/flights]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
