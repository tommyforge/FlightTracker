import { NextResponse } from 'next/server'
import { getOpenSkyToken } from '@/lib/opensky'

interface AircraftMeta {
  aircraftType: string | null
  manufacturer: string | null
  operator: string | null
}

/**
 * In-memory aircraft metadata cache keyed by icao24.
 * TTL: 1 hour. Acceptable for single-instance dev/preview deployments.
 * In multi-instance production, replace with a shared cache (Redis, etc.).
 */
interface CacheEntry {
  data: AircraftMeta
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()
const TTL_MS = 60 * 60 * 1000 // 1 hour

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ icao24: string }> }
) {
  const { icao24: rawIcao } = await params
  const icao24 = rawIcao.toLowerCase()

  // Return cached entry if still valid
  const cached = cache.get(icao24)
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.data)
  }

  const token = await getOpenSkyToken()

  if (!token) {
    // No credentials — return null data gracefully
    return NextResponse.json({ aircraftType: null, manufacturer: null, operator: null })
  }

  try {
    const res = await fetch(
      `https://opensky-network.org/api/metadata/aircraft/icao/${icao24}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }
    )

    if (!res.ok) {
      // Aircraft not found or API error — cache null result to avoid re-fetching
      const empty: AircraftMeta = { aircraftType: null, manufacturer: null, operator: null }
      cache.set(icao24, { data: empty, expiresAt: Date.now() + TTL_MS })
      return NextResponse.json(empty)
    }

    const raw = (await res.json()) as {
      typecode?: string
      manufacturerName?: string
      model?: string
      operator?: string
    }

    const data: AircraftMeta = {
      aircraftType: raw.typecode ?? raw.model ?? null,
      manufacturer: raw.manufacturerName ?? null,
      operator: raw.operator ?? null,
    }

    cache.set(icao24, { data, expiresAt: Date.now() + TTL_MS })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/aircraft]', err)
    return NextResponse.json({ aircraftType: null, manufacturer: null, operator: null })
  }
}
