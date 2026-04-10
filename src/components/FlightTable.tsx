'use client'

import { useState, useEffect, useRef, type ReactElement } from 'react'
import type { EnrichedFlight } from '@/types/flight'
import styles from './FlightTable.module.scss'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortKey =
  | 'callsign'
  | 'airline'
  | 'airlineCountry'
  | 'aircraftType'
  | 'originCountry'
  | 'altitudeM'
  | 'speedKts'
  | 'heading'
  | 'verticalRate'
  | 'onGround'
  | 'isDomestic'

type SortDir = 'asc' | 'desc'

const PAGE_SIZES = [50, 100, 200] as const

interface Column {
  key: SortKey
  label: string
  lazy?: boolean
}

const COLUMNS: Column[] = [
  { key: 'callsign',       label: 'Callsign' },
  { key: 'airline',        label: 'Airline', lazy: true },
  { key: 'airlineCountry', label: 'Airline Country' },
  { key: 'aircraftType',   label: 'Aircraft Type', lazy: true },
  { key: 'originCountry',  label: 'Origin Country' },
  { key: 'altitudeM',      label: 'Altitude (m)' },
  { key: 'speedKts',       label: 'Speed (kts)' },
  { key: 'heading',        label: 'Hdg (°)' },
  { key: 'verticalRate',   label: 'V-Rate' },
  { key: 'onGround',       label: 'Status' },
  { key: 'isDomestic',     label: 'Dom/Intl', lazy: true },
]

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

function sortFlights(flights: EnrichedFlight[], key: SortKey, dir: SortDir): EnrichedFlight[] {
  return [...flights].sort((a, b) => {
    const av = a[key]
    const bv = b[key]

    if (av === null && bv === null) return 0
    if (av === null) return 1  // nulls sink to bottom regardless of direction
    if (bv === null) return -1

    let cmp: number
    if (typeof av === 'boolean' && typeof bv === 'boolean') {
      // airborne (false=onGround) sorts before grounded
      cmp = av === bv ? 0 : av ? 1 : -1
    } else if (typeof av === 'string' && typeof bv === 'string') {
      cmp = av.localeCompare(bv)
    } else {
      cmp = (av as number) - (bv as number)
    }

    return dir === 'asc' ? cmp : -cmp
  })
}

// ---------------------------------------------------------------------------
// Cell formatters
// ---------------------------------------------------------------------------

function fmtNum(v: number | null, decimals = 0): string {
  if (v === null) return '—'
  return v.toFixed(decimals)
}

function fmtStatus(onGround: boolean): ReactElement {
  return onGround
    ? <span className={styles.grounded}>GND</span>
    : <span className={styles.airborne}>AIR</span>
}

function fmtDomestic(isDomestic: boolean | null, loading: boolean): ReactElement | string {
  if (loading) return <span className={styles.skeleton} />
  if (isDomestic === null) return '—'
  return isDomestic
    ? <span className={styles.domestic}>DOM</span>
    : <span className={styles.international}>INTL</span>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  flights: EnrichedFlight[]
  loading: boolean
  refreshId: number
  onRowsVisible: (rows: EnrichedFlight[]) => void
}

export default function FlightTable({ flights, loading, refreshId, onRowsVisible }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('callsign')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState<50 | 100 | 200>(50)

  const prevRefreshId = useRef(refreshId)
  // Stable ref so the lazy-fetch effect doesn't re-fire every time the callback
  // identity changes (which happens on every completed metadata fetch in the parent)
  const onRowsVisibleRef = useRef(onRowsVisible)
  useEffect(() => { onRowsVisibleRef.current = onRowsVisible })

  // Reset page on new data set or filter change
  useEffect(() => {
    if (prevRefreshId.current !== refreshId) {
      setPage(0)
      prevRefreshId.current = refreshId
    }
  }, [refreshId])

  const sorted = sortFlights(flights, sortKey, sortDir)
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const pageRows = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize)

  // Notify parent of visible rows for lazy fetching.
  // Only re-fires when the set of visible icao24s actually changes — NOT when the
  // callback reference changes (which would happen 50+ times as metadata loads).
  const pageKey = pageRows.map((r) => r.icao24).join(',')
  useEffect(() => {
    if (pageRows.length > 0) {
      console.log('[FlightTable] visible rows changed, triggering lazy fetch for', pageRows.length, 'rows')
      onRowsVisibleRef.current(pageRows)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey])

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(0)
  }

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return <span className={styles.sortNeutral}>⇅</span>
    return <span className={styles.sortActive}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // -------------------------------------------------------------------------
  // Skeleton rows (initial load)
  // -------------------------------------------------------------------------
  if (loading && flights.length === 0) {
    return (
      <div className={styles.wrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key} className={styles.th}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 15 }).map((_, i) => (
              <tr key={i} className={styles.skeletonRow}>
                {COLUMNS.map((col) => (
                  <td key={col.key} className={styles.td}>
                    <span className={styles.skeleton} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------
  if (!loading && flights.length === 0) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.empty}>No flights match the current filters.</div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Table
  // -------------------------------------------------------------------------
  return (
    <div className={styles.outer}>
      <div className={styles.toolbar}>
        <span className={styles.count}>
          {flights.length.toLocaleString()} flight{flights.length !== 1 ? 's' : ''}
        </span>
        <div className={styles.pageSizeRow}>
          <span className={styles.label}>Per page:</span>
          {PAGE_SIZES.map((n) => (
            <button
              key={n}
              className={pageSize === n ? styles.pageSizeActive : styles.pageSizeBtn}
              onClick={() => { setPageSize(n); setPage(0) }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.wrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`${styles.th} ${col.lazy ? styles.thLazy : ''}`}
                  onClick={() => toggleSort(col.key)}
                >
                  {col.label} {sortIndicator(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((f) => (
              <tr key={f.icao24} className={styles.tr}>
                <td className={`${styles.td} ${styles.callsign}`}>{f.callsign}</td>
                <td className={`${styles.td} ${styles.lazy}`}>
                  {/* staticAirline is always available — show it immediately.
                      operator refines/confirms the name once metadata loads. */}
                  {f.airline ?? f.staticAirline ?? '—'}
                </td>
                <td className={styles.td}>{f.airlineCountry ?? '—'}</td>
                <td className={`${styles.td} ${styles.lazy}`}>
                  {f._aircraftLoading
                    ? <span className={styles.skeleton} />
                    : f.aircraftType ?? '—'
                  }
                </td>
                <td className={styles.td}>{f.originCountry}</td>
                <td className={`${styles.td} ${styles.numeric}`}>
                  {fmtNum(f.altitudeM)}
                </td>
                <td className={`${styles.td} ${styles.numeric}`}>
                  {fmtNum(f.speedKts)}
                </td>
                <td className={`${styles.td} ${styles.numeric}`}>
                  {fmtNum(f.heading)}
                </td>
                <td className={`${styles.td} ${styles.numeric}`}>
                  {f.verticalRate !== null
                    ? (f.verticalRate >= 0 ? '+' : '') + fmtNum(f.verticalRate, 1)
                    : '—'
                  }
                </td>
                <td className={styles.td}>{fmtStatus(f.onGround)}</td>
                <td className={`${styles.td} ${styles.lazy}`}>
                  {fmtDomestic(f.isDomestic, f._routeLoading)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            onClick={() => setPage(0)}
            disabled={safePage === 0}
          >
            «
          </button>
          <button
            className={styles.pageBtn}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
          >
            ‹
          </button>
          <span className={styles.pageInfo}>
            {safePage + 1} / {totalPages}
          </span>
          <button
            className={styles.pageBtn}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
          >
            ›
          </button>
          <button
            className={styles.pageBtn}
            onClick={() => setPage(totalPages - 1)}
            disabled={safePage >= totalPages - 1}
          >
            »
          </button>
        </div>
      )}
    </div>
  )
}
