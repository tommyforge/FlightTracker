import { NextResponse } from 'next/server'

interface RouteInfo {
  isDomestic: boolean | null
  depCountry: string | null
  arrCountry: string | null
}

/**
 * In-memory route cache keyed by callsign.
 * TTL: 1 hour. Acceptable for single-instance dev/preview deployments.
 * In multi-instance production, replace with a shared cache (Redis, etc.).
 */
interface CacheEntry {
  data: RouteInfo
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()
const TTL_MS = 60 * 60 * 1000 // 1 hour

const EMPTY: RouteInfo = { isDomestic: null, depCountry: null, arrCountry: null }

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ callsign: string }> }
) {
  const { callsign: rawCallsign } = await params
  const callsign = rawCallsign.trim().toUpperCase()

  // Return cached entry if still valid
  const cached = cache.get(callsign)
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.data)
  }

  const apiKey = process.env.AVIATIONSTACK_API_KEY
  if (!apiKey) {
    // No key configured — return null data gracefully (show "—" in UI)
    return NextResponse.json(EMPTY)
  }

  try {
    const url = new URL('https://api.aviationstack.com/v1/flights')
    url.searchParams.set('access_key', apiKey)
    url.searchParams.set('flight_icao', callsign)

    const res = await fetch(url.toString(), { next: { revalidate: 0 } })

    if (!res.ok) {
      cache.set(callsign, { data: EMPTY, expiresAt: Date.now() + TTL_MS })
      return NextResponse.json(EMPTY)
    }

    const json = (await res.json()) as {
      data?: Array<{
        departure?: { country_name?: string }
        arrival?: { country_name?: string }
      }>
    }

    const flight = json.data?.[0]
    if (!flight) {
      cache.set(callsign, { data: EMPTY, expiresAt: Date.now() + TTL_MS })
      return NextResponse.json(EMPTY)
    }

    const depCountry = flight.departure?.country_name ?? null
    const arrCountry = flight.arrival?.country_name ?? null
    const isDomestic =
      depCountry !== null && arrCountry !== null
        ? depCountry === arrCountry
        : null

    const data: RouteInfo = { isDomestic, depCountry, arrCountry }
    cache.set(callsign, { data, expiresAt: Date.now() + TTL_MS })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/route]', err)
    return NextResponse.json(EMPTY)
  }
}
