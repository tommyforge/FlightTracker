import airlinesData from '@/data/airlines.json'

interface AirlineInfo {
  name: string
  country: string
}

// airlines.json is keyed by 3-char ICAO designator (e.g. "AAL" → American Airlines)
const airlines = airlinesData as Record<string, AirlineInfo>

/**
 * Look up airline name and country from a flight callsign.
 * Uses the first 3 characters as the ICAO designator.
 */
export function lookupAirline(callsign: string): AirlineInfo | null {
  if (!callsign || callsign.length < 3) return null
  const prefix = callsign.slice(0, 3).toUpperCase()
  return airlines[prefix] ?? null
}
