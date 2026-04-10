import type { EnrichedFlight } from '@/types/flight'
import styles from './FlightMap.module.scss'

interface Props {
  flight: EnrichedFlight
  x: number
  y: number
}

export default function AircraftTooltip({ flight, x, y }: Props) {
  return (
    <div className={styles.tooltip} style={{ left: x + 14, top: y - 14 }}>
      <div className={styles.tooltipCallsign}>{flight.callsign}</div>
      {flight.airline && (
        <div className={styles.tooltipRow}>{flight.airline}</div>
      )}
      {flight.aircraftType && (
        <div className={styles.tooltipRow}>{flight.aircraftType}</div>
      )}
      <div className={styles.tooltipRow}>
        {flight.altitudeM !== null ? `${Math.round(flight.altitudeM).toLocaleString()} m` : '—'}
        {flight.speedKts !== null ? ` · ${flight.speedKts} kts` : ''}
      </div>
    </div>
  )
}
