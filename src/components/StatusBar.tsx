'use client'

import { useMemo } from 'react'
import type { EnrichedFlight } from '@/types/flight'
import styles from './StatusBar.module.scss'

interface Props {
  flights: EnrichedFlight[]
  countdown: number
}

export default function StatusBar({ flights, countdown }: Props) {
  const stats = useMemo(() => {
    const airborne = flights.filter((f) => !f.onGround)
    const grounded = flights.filter((f) => f.onGround)
    const countries = new Set(flights.map((f) => f.originCountry)).size
    const speeds = airborne.map((f) => f.speedKts).filter((s): s is number => s !== null)
    const avgSpeed =
      speeds.length > 0 ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : null

    return {
      total: flights.length,
      airborne: airborne.length,
      grounded: grounded.length,
      countries,
      avgSpeed,
    }
  }, [flights])

  const pct = Math.round((countdown / 30) * 100)
  const circumference = 2 * Math.PI * 7 // r=7
  const dashOffset = circumference * (1 - pct / 100)

  return (
    <div className={styles.bar}>
      <Stat label="Total" value={stats.total.toLocaleString()} />
      <div className={styles.divider} />
      <Stat label="Airborne" value={stats.airborne.toLocaleString()} accent="airborne" />
      <Stat label="Grounded" value={stats.grounded.toLocaleString()} accent="grounded" />
      <div className={styles.divider} />
      <Stat label="Countries" value={stats.countries.toLocaleString()} />
      <Stat
        label="Avg Speed"
        value={stats.avgSpeed !== null ? `${stats.avgSpeed} kts` : '—'}
      />
      <div className={styles.divider} />

      {/* Countdown badge */}
      <div className={styles.countdown} title={`Refreshing in ${countdown}s`}>
        <svg className={styles.ring} viewBox="0 0 20 20" aria-hidden>
          <circle cx="10" cy="10" r="7" className={styles.ringTrack} />
          <circle
            cx="10"
            cy="10"
            r="7"
            className={styles.ringProgress}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <span className={styles.countdownNum}>{countdown}s</span>
      </div>
    </div>
  )
}

interface StatProps {
  label: string
  value: string
  accent?: 'airborne' | 'grounded'
}

function Stat({ label, value, accent }: StatProps) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span
        className={`${styles.statValue} ${
          accent === 'airborne'
            ? styles.airborne
            : accent === 'grounded'
            ? styles.grounded
            : ''
        }`}
      >
        {value}
      </span>
    </div>
  )
}
