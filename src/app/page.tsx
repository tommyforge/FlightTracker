'use client'

import { useReducer, useEffect, useCallback, useRef } from 'react'
import type {
  Flight,
  AircraftMeta,
  RouteInfo,
  FilterState,
  EnrichedFlight,
} from '@/types/flight'
import FlightTable from '@/components/FlightTable'
import Filters from '@/components/Filters'
import StatusBar from '@/components/StatusBar'
import { lookupAirline } from '@/lib/airlines'
import styles from './page.module.scss'

const REFRESH_INTERVAL = 30 // seconds

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface AppState {
  flights: Flight[]
  loading: boolean
  error: string | null
  countdown: number
  refreshId: number // increments on new data or filter change; resets table page
  filters: FilterState
  aircraftCache: Record<string, AircraftMeta>
  routeCache: Record<string, RouteInfo>
}

const INITIAL_FILTERS: FilterState = {
  search: '',
  airlineCountry: '',
  airline: '',
  aircraftType: '',
  status: 'all',
  altitude: 'all',
  domestic: 'all',
}

const initialState: AppState = {
  flights: [],
  loading: true,
  error: null,
  countdown: REFRESH_INTERVAL,
  refreshId: 0,
  filters: INITIAL_FILTERS,
  aircraftCache: {},
  routeCache: {},
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

type Action =
  | { type: 'LOADING_START' }
  | { type: 'FLIGHTS_LOADED'; flights: Flight[] }
  | { type: 'FLIGHTS_ERROR'; error: string }
  | { type: 'AIRCRAFT_LOADED'; icao24: string; data: AircraftMeta }
  | { type: 'ROUTE_LOADED'; callsign: string; data: RouteInfo }
  | { type: 'SET_FILTER'; key: keyof FilterState; value: string }
  | { type: 'TICK' }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOADING_START':
      return { ...state, loading: true, error: null }

    case 'FLIGHTS_LOADED':
      return {
        ...state,
        loading: false,
        error: null,
        flights: action.flights,
        countdown: REFRESH_INTERVAL,
        refreshId: state.refreshId + 1,
      }

    case 'FLIGHTS_ERROR':
      return { ...state, loading: false, error: action.error }

    case 'AIRCRAFT_LOADED':
      return {
        ...state,
        aircraftCache: { ...state.aircraftCache, [action.icao24]: action.data },
      }

    case 'ROUTE_LOADED':
      return {
        ...state,
        routeCache: { ...state.routeCache, [action.callsign]: action.data },
      }

    case 'SET_FILTER':
      return {
        ...state,
        filters: { ...state.filters, [action.key]: action.value },
        refreshId: state.refreshId + 1,
      }

    case 'TICK':
      return { ...state, countdown: state.countdown > 1 ? state.countdown - 1 : REFRESH_INTERVAL }

    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

function applyFilters(flights: EnrichedFlight[], filters: FilterState): EnrichedFlight[] {
  return flights.filter((f) => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (
        !f.callsign.toLowerCase().includes(q) &&
        !f.airline?.toLowerCase().includes(q) &&
        !f.originCountry.toLowerCase().includes(q)
      )
        return false
    }
    if (filters.airlineCountry && f.airlineCountry !== filters.airlineCountry) return false
    if (filters.airline) {
      const q = filters.airline.toLowerCase()
      const matchedStatic = f.staticAirline?.toLowerCase() === q
      const matchedOperator = f.airline !== null && f.airline.toLowerCase() === q
      if (!matchedStatic && !matchedOperator) return false
    }
    if (filters.aircraftType && f.aircraftType !== filters.aircraftType) return false
    if (filters.status === 'airborne' && f.onGround) return false
    if (filters.status === 'grounded' && !f.onGround) return false
    if (filters.altitude !== 'all') {
      if (f.altitudeM === null) return false
      if (filters.altitude === 'low' && f.altitudeM >= 3000) return false
      if (filters.altitude === 'mid' && (f.altitudeM < 3000 || f.altitudeM > 9000)) return false
      if (filters.altitude === 'high' && f.altitudeM <= 9000) return false
    }
    if (filters.domestic === 'domestic' && f.isDomestic !== true) return false
    if (filters.domestic === 'international' && f.isDomestic !== false) return false
    return true
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Home() {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Refs to debounce lazy fetches (prevent duplicate in-flight requests)
  const pendingAircraft = useRef(new Set<string>())
  const pendingRoute = useRef(new Set<string>())

  // -------------------------------------------------------------------
  // Fetch flights
  // -------------------------------------------------------------------
  const fetchFlights = useCallback(async () => {
    dispatch({ type: 'LOADING_START' })
    try {
      const res = await fetch('/api/flights')
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        dispatch({ type: 'FLIGHTS_ERROR', error: body.error ?? `HTTP ${res.status}` })
        return
      }
      const flights = (await res.json()) as Flight[]
      dispatch({ type: 'FLIGHTS_LOADED', flights })
    } catch {
      dispatch({ type: 'FLIGHTS_ERROR', error: 'Network error' })
    }
  }, [])

  // Initial fetch + auto-refresh every 30s
  useEffect(() => {
    fetchFlights()
    const interval = setInterval(fetchFlights, REFRESH_INTERVAL * 1000)
    return () => clearInterval(interval)
  }, [fetchFlights])

  // Countdown tick
  useEffect(() => {
    const interval = setInterval(() => dispatch({ type: 'TICK' }), 1000)
    return () => clearInterval(interval)
  }, [])

  // -------------------------------------------------------------------
  // Lazy fetches (triggered by FlightTable when rows become visible)
  // -------------------------------------------------------------------
  const handleRowsVisible = useCallback(
    (rows: EnrichedFlight[]) => {
      for (const row of rows) {
        if (
          !(row.icao24 in state.aircraftCache) &&
          !pendingAircraft.current.has(row.icao24)
        ) {
          pendingAircraft.current.add(row.icao24)
          fetch(`/api/aircraft/${row.icao24}`)
            .then((r) => r.json())
            .then((data: AircraftMeta) => {
              dispatch({ type: 'AIRCRAFT_LOADED', icao24: row.icao24, data })
            })
            .catch(() => {
              dispatch({
                type: 'AIRCRAFT_LOADED',
                icao24: row.icao24,
                data: { aircraftType: null, manufacturer: null, operator: null },
              })
            })
        }

        if (
          !(row.callsign in state.routeCache) &&
          !pendingRoute.current.has(row.callsign)
        ) {
          pendingRoute.current.add(row.callsign)
          fetch(`/api/route/${row.callsign}`)
            .then((r) => r.json())
            .then((data: RouteInfo) => {
              dispatch({ type: 'ROUTE_LOADED', callsign: row.callsign, data })
            })
            .catch(() => {
              dispatch({
                type: 'ROUTE_LOADED',
                callsign: row.callsign,
                data: { isDomestic: null, depCountry: null, arrCountry: null },
              })
            })
        }
      }
    },
    [state.aircraftCache, state.routeCache],
  )

  // -------------------------------------------------------------------
  // Enrich + filter
  // -------------------------------------------------------------------
  const enrichedFlights: EnrichedFlight[] = state.flights.map((f) => ({
    ...f,
    staticAirline: lookupAirline(f.callsign)?.name ?? null,
    airline: state.aircraftCache[f.icao24]?.operator ?? null,
    aircraftType: state.aircraftCache[f.icao24]?.aircraftType ?? null,
    manufacturer: state.aircraftCache[f.icao24]?.manufacturer ?? null,
    isDomestic: state.routeCache[f.callsign]?.isDomestic ?? null,
    depCountry: state.routeCache[f.callsign]?.depCountry ?? null,
    arrCountry: state.routeCache[f.callsign]?.arrCountry ?? null,
    _aircraftLoading: !(f.icao24 in state.aircraftCache),
    _routeLoading: !(f.callsign in state.routeCache),
  }))

  const filteredFlights = applyFilters(enrichedFlights, state.filters)

  // -------------------------------------------------------------------
  // Filter change handler
  // -------------------------------------------------------------------
  const handleFilterChange = useCallback(
    (key: keyof FilterState, value: string) => {
      dispatch({ type: 'SET_FILTER', key, value })
    },
    [],
  )

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            <span className={styles.titleIcon}>✈</span> Flight Tracker
          </h1>
          <StatusBar flights={enrichedFlights} countdown={state.countdown} />
        </div>
      </header>

      <Filters
        flights={enrichedFlights}
        aircraftCache={state.aircraftCache}
        filters={state.filters}
        onChange={handleFilterChange}
      />

      {state.error && (
        <div className={styles.error}>
          <span>⚠ {state.error}</span>
        </div>
      )}

      <FlightTable
        flights={filteredFlights}
        loading={state.loading}
        refreshId={state.refreshId}
        onRowsVisible={handleRowsVisible}
      />
    </div>
  )
}
