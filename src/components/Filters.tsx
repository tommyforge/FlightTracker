'use client'

import { useMemo } from 'react'
import type { EnrichedFlight, FilterState, AircraftMeta } from '@/types/flight'
import styles from './Filters.module.scss'

interface Props {
  flights: EnrichedFlight[]
  aircraftCache: Record<string, AircraftMeta>
  filters: FilterState
  onChange: (key: keyof FilterState, value: string) => void
}

export default function Filters({ flights, aircraftCache, filters, onChange }: Props) {
  // Unique values for dropdown options (derived from live data)
  const airlineCountries = useMemo(() => {
    const s = new Set<string>()
    for (const f of flights) if (f.airlineCountry) s.add(f.airlineCountry)
    return [...s].sort()
  }, [flights])

  // Populate from staticAirline (callsign-prefix lookup — available immediately
  // on load for all flights, not dependent on lazy metadata)
  const airlines = useMemo(() => {
    const s = new Set<string>()
    for (const f of flights) if (f.staticAirline) s.add(f.staticAirline)
    return [...s].sort()
  }, [flights])

  // Aircraft types come from the cache (lazily populated)
  const aircraftTypes = useMemo(() => {
    const s = new Set<string>()
    for (const meta of Object.values(aircraftCache)) {
      if (meta.aircraftType) s.add(meta.aircraftType)
    }
    return [...s].sort()
  }, [aircraftCache])

  return (
    <div className={styles.bar}>
      {/* Text search */}
      <div className={styles.group}>
        <label className={styles.label} htmlFor="search">Search</label>
        <input
          id="search"
          className={styles.input}
          type="search"
          placeholder="Callsign, airline, country…"
          value={filters.search}
          onChange={(e) => onChange('search', e.target.value)}
        />
      </div>

      {/* Airline country */}
      <div className={styles.group}>
        <label className={styles.label} htmlFor="airlineCountry">Airline Country</label>
        <select
          id="airlineCountry"
          className={styles.select}
          value={filters.airlineCountry}
          onChange={(e) => onChange('airlineCountry', e.target.value)}
        >
          <option value="">All</option>
          {airlineCountries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Airline */}
      <div className={styles.group}>
        <label className={styles.label} htmlFor="airline">Airline</label>
        <select
          id="airline"
          className={styles.select}
          value={filters.airline}
          onChange={(e) => onChange('airline', e.target.value)}
        >
          <option value="">All</option>
          {airlines.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* Aircraft type */}
      <div className={styles.group}>
        <label className={styles.label} htmlFor="aircraftType">Aircraft Type</label>
        <select
          id="aircraftType"
          className={styles.select}
          value={filters.aircraftType}
          onChange={(e) => onChange('aircraftType', e.target.value)}
        >
          <option value="">All</option>
          {aircraftTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Status */}
      <div className={styles.group}>
        <label className={styles.label} htmlFor="status">Status</label>
        <select
          id="status"
          className={styles.select}
          value={filters.status}
          onChange={(e) => onChange('status', e.target.value)}
        >
          <option value="all">All</option>
          <option value="airborne">Airborne</option>
          <option value="grounded">Grounded</option>
        </select>
      </div>

      {/* Altitude band */}
      <div className={styles.group}>
        <label className={styles.label} htmlFor="altitude">Altitude</label>
        <select
          id="altitude"
          className={styles.select}
          value={filters.altitude}
          onChange={(e) => onChange('altitude', e.target.value)}
        >
          <option value="all">All</option>
          <option value="low">Low (&lt;3000m)</option>
          <option value="mid">Mid (3–9km)</option>
          <option value="high">High (&gt;9000m)</option>
        </select>
      </div>

      {/* Domestic / international */}
      <div className={styles.group}>
        <label className={styles.label} htmlFor="domestic">Dom/Intl</label>
        <select
          id="domestic"
          className={styles.select}
          value={filters.domestic}
          onChange={(e) => onChange('domestic', e.target.value)}
        >
          <option value="all">All</option>
          <option value="domestic">Domestic</option>
          <option value="international">International</option>
        </select>
      </div>

      {/* Clear button — only shown when any filter is active */}
      {(filters.search ||
        filters.airlineCountry ||
        filters.airline ||
        filters.aircraftType ||
        filters.status !== 'all' ||
        filters.altitude !== 'all' ||
        filters.domestic !== 'all') && (
        <button
          className={styles.clearBtn}
          onClick={() => {
            onChange('search', '')
            onChange('airlineCountry', '')
            onChange('airline', '')
            onChange('aircraftType', '')
            onChange('status', 'all')
            onChange('altitude', 'all')
            onChange('domestic', 'all')
          }}
        >
          ✕ Clear
        </button>
      )}
    </div>
  )
}
