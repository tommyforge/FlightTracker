export interface AircraftMeta {
  aircraftType: string | null
  manufacturer: string | null
  operator: string | null       // airline/operator name from OpenSky metadata
}

export interface RouteInfo {
  isDomestic: boolean | null
  depCountry: string | null
  arrCountry: string | null
}

export interface FilterState {
  search: string
  airlineCountry: string
  airline: string
  aircraftType: string
  status: 'all' | 'airborne' | 'grounded'
  altitude: 'all' | 'low' | 'mid' | 'high'
  domestic: 'all' | 'domestic' | 'international'
}

// Flight with cache values merged in + loading flags (used by UI components)
export interface EnrichedFlight extends Flight {
  _aircraftLoading: boolean
  _routeLoading: boolean
}

export interface Flight {
  icao24: string
  callsign: string
  originCountry: string       // from OpenSky states
  airline: string | null      // from OpenSky metadata operator field (lazy)
  airlineCountry: string | null
  aircraftType: string | null // from OpenSky metadata (lazy)
  manufacturer: string | null
  lat: number | null
  lon: number | null
  altitudeM: number | null
  speedKts: number | null     // converted from m/s: * 1.94384
  heading: number | null
  verticalRate: number | null
  onGround: boolean
  isDomestic: boolean | null  // from AviationStack (lazy)
  depCountry: string | null
  arrCountry: string | null
}
