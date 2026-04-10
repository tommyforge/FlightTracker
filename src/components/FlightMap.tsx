'use client'

import { useRef, useCallback, useState, useMemo } from 'react'
import MapGL, { Source, Layer } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { MapRef, MapLayerMouseEvent } from 'react-map-gl/maplibre'
import type { FeatureCollection } from 'geojson'
import type { EnrichedFlight } from '@/types/flight'
import AircraftTooltip from './AircraftTooltip'
import styles from './FlightMap.module.scss'

// Top-down airplane silhouette pointing north (white on transparent for SDF coloring)
const AIRPLANE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
  <path fill="white" d="M10 0 L13 8 L20 10 L13 12 L11.5 20 L10 18 L8.5 20 L7 12 L0 10 L7 8 Z"/>
</svg>`

// Layer ID patterns to remove from the MapTiler base style
function shouldDropLayer(id: string): boolean {
  // Always keep country borders, labels, water, land background
  if (/admin|boundary|country|place|label|capital|water|background|landcover/.test(id)) {
    return false
  }
  return /road|street|bridge|tunnel|path|ferry|building|poi|transit|rail|bus|aeroway|hillshade|terrain|landuse|parking|contour/.test(id)
}

// ---------------------------------------------------------------------------

interface TooltipState {
  flight: EnrichedFlight
  x: number
  y: number
}

interface Props {
  flights: EnrichedFlight[]
  selectedIcao: string | null
  onFlightSelect: (icao24: string | null) => void
}

export default function FlightMap({ flights, selectedIcao, onFlightSelect }: Props) {
  const mapRef = useRef<MapRef>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  // Fast icao24 → flight lookup used by event handlers
  const flightByIcao = useMemo(() => {
    const m = new Map<string, EnrichedFlight>()
    for (const f of flights) m.set(f.icao24, f)
    return m
  }, [flights])

  // Build GeoJSON FeatureCollection from filtered flights
  const geojson = useMemo<FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: flights
      .filter((f) => f.lat !== null && f.lon !== null)
      .map((f) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [f.lon!, f.lat!] },
        properties: {
          icao24: f.icao24,
          onGround: f.onGround,
          heading: f.heading ?? 0,
          selected: f.icao24 === selectedIcao ? 1 : 0,
        },
      })),
  }), [flights, selectedIcao])

  // Add SDF airplane icon and customize the MapTiler style on load
  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    // Register SDF airplane icon so icon-color can be driven by data expressions
    const img = new Image(20, 20)
    img.onload = () => {
      if (!map.hasImage('airplane')) {
        map.addImage('airplane', img, { sdf: true })
      }
    }
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(AIRPLANE_SVG)}`

    // Strip unwanted layers (roads, POIs, buildings, terrain …)
    const currentStyle = map.getStyle()
    if (currentStyle?.layers) {
      for (const layer of currentStyle.layers) {
        if (shouldDropLayer(layer.id)) {
          try { map.removeLayer(layer.id) } catch { /* layer may already be absent */ }
        }
      }

      // Restyle remaining layers to match the dark terminal theme
      for (const layer of currentStyle.layers) {
        try {
          if (layer.id === 'background') {
            map.setPaintProperty('background', 'background-color', '#1a1a2e')
          } else if (layer.type === 'fill' && /^water/.test(layer.id)) {
            map.setPaintProperty(layer.id, 'fill-color', '#0d0d1a')
          } else if (layer.type === 'line' && /admin|boundary/.test(layer.id)) {
            map.setPaintProperty(layer.id, 'line-color', '#3a4a5a')
            map.setPaintProperty(layer.id, 'line-opacity', 1)
          }
        } catch { /* paint property may not exist on this layer type */ }
      }
    }
  }, [])

  // Hover: show tooltip when over an aircraft feature
  const handleMouseMove = useCallback((e: MapLayerMouseEvent) => {
    const feature = e.features?.[0]
    if (!feature) {
      setTooltip(null)
      return
    }
    const icao24 = feature.properties?.icao24 as string | undefined
    if (!icao24) { setTooltip(null); return }
    const flight = flightByIcao.get(icao24)
    if (flight) {
      setTooltip({ flight, x: e.point.x, y: e.point.y })
    }
  }, [flightByIcao])

  const handleMouseLeave = useCallback(() => setTooltip(null), [])

  // Click: select/deselect flight; click on empty map deselects
  const handleClick = useCallback((e: MapLayerMouseEvent) => {
    const feature = e.features?.[0]
    if (feature) {
      const icao24 = feature.properties?.icao24 as string | undefined
      if (icao24) {
        onFlightSelect(icao24 === selectedIcao ? null : icao24)
        return
      }
    }
    onFlightSelect(null)
  }, [onFlightSelect, selectedIcao])

  const selectedFlight = selectedIcao ? flightByIcao.get(selectedIcao) ?? null : null

  const apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY
  const mapStyleUrl = apiKey
    ? `https://api.maptiler.com/maps/basic-v2-dark/style.json?key=${apiKey}`
    : null

  return (
    <div className={styles.container}>
      {!mapStyleUrl && (
        <div className={styles.noKey}>
          Set <code>NEXT_PUBLIC_MAPTILER_API_KEY</code> in <code>.env.local</code> to enable the map view.
        </div>
      )}

      {mapStyleUrl && (
        <MapGL
          ref={mapRef}
          mapStyle={mapStyleUrl}
          initialViewState={{ longitude: 10, latitude: 25, zoom: 2 }}
          onLoad={handleMapLoad}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          interactiveLayerIds={['aircraft-layer']}
          cursor={tooltip ? 'pointer' : 'grab'}
        >
          <Source id="aircraft" type="geojson" data={geojson}>
            {/* Airborne flights */}
            <Layer
              id="aircraft-layer"
              type="symbol"
              layout={{
                'icon-image': 'airplane',
                'icon-rotate': ['get', 'heading'],
                'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.45, 6, 0.65, 10, 1.0],
                'icon-allow-overlap': true,
                'icon-rotation-alignment': 'map',
                'icon-pitch-alignment': 'map',
              }}
              paint={{
                'icon-color': [
                  'case',
                  // Selected: white highlight
                  ['==', ['get', 'selected'], 1], '#ffffff',
                  // Grounded: red
                  ['boolean', ['get', 'onGround'], false], '#e84040',
                  // Airborne: green
                  '#00ff88',
                ],
                'icon-opacity': [
                  'case',
                  ['==', ['get', 'selected'], 1], 1.0,
                  0.85,
                ],
              }}
            />
          </Source>
        </MapGL>
      )}

      {/* Hover tooltip — hidden when a detail panel is open */}
      {tooltip && !selectedFlight && (
        <AircraftTooltip
          flight={tooltip.flight}
          x={tooltip.x}
          y={tooltip.y}
        />
      )}

      {/* Selected-flight detail panel */}
      {selectedFlight && (
        <div className={styles.detailPanel}>
          <button className={styles.detailClose} onClick={() => onFlightSelect(null)}>✕</button>
          <div className={styles.detailCallsign}>{selectedFlight.callsign}</div>
          {selectedFlight.airline && (
            <div className={styles.detailAirline}>{selectedFlight.airline}</div>
          )}
          <div className={styles.detailGrid}>
            <span className={styles.detailLabel}>Status</span>
            <span className={selectedFlight.onGround ? styles.detailGrounded : styles.detailAirborne}>
              {selectedFlight.onGround ? 'GND' : 'AIR'}
            </span>

            <span className={styles.detailLabel}>Altitude</span>
            <span className={styles.detailValue}>
              {selectedFlight.altitudeM !== null
                ? `${Math.round(selectedFlight.altitudeM).toLocaleString()} m`
                : '—'}
            </span>

            <span className={styles.detailLabel}>Speed</span>
            <span className={styles.detailValue}>
              {selectedFlight.speedKts !== null ? `${selectedFlight.speedKts} kts` : '—'}
            </span>

            <span className={styles.detailLabel}>Heading</span>
            <span className={styles.detailValue}>
              {selectedFlight.heading !== null ? `${Math.round(selectedFlight.heading)}°` : '—'}
            </span>

            {selectedFlight.aircraftType && (
              <>
                <span className={styles.detailLabel}>Aircraft</span>
                <span className={styles.detailValue}>{selectedFlight.aircraftType}</span>
              </>
            )}

            <span className={styles.detailLabel}>Country</span>
            <span className={styles.detailValue}>{selectedFlight.originCountry}</span>

            {selectedFlight.isDomestic !== null && (
              <>
                <span className={styles.detailLabel}>Route</span>
                <span className={styles.detailValue}>
                  {selectedFlight.isDomestic ? 'Domestic' : 'International'}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
