export interface Flight {
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
  speedKts: number | null     // converted from m/s: * 1.94384
  heading: number | null
  verticalRate: number | null
  onGround: boolean
  isDomestic: boolean | null  // from AviationStack (lazy)
  depCountry: string | null
  arrCountry: string | null
}
