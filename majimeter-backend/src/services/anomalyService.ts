import type { AlertType, AlertSeverity } from '../types/db'

export interface AnomalyResult {
  type: AlertType
  severity: AlertSeverity
  message: string
}

interface SensorValues {
  flow_rate?: number | null
  pressure?: number | null
  water_level?: number | null
}

/**
 * Pure function — no side effects. Returns any threshold violations found
 * in a sensor reading. Thresholds come from env vars so they can be
 * overridden per deployment without code changes.
 */
export function checkAnomalies(reading: SensorValues): AnomalyResult[] {
  const t = {
    waterLevelLow:      parseFloat(process.env.THRESHOLD_WATER_LEVEL_LOW      ?? '20'),
    waterLevelCritical: parseFloat(process.env.THRESHOLD_WATER_LEVEL_CRITICAL ?? '10'),
    pressureHigh:       parseFloat(process.env.THRESHOLD_PRESSURE_HIGH        ?? '5.0'),
    pressureLow:        parseFloat(process.env.THRESHOLD_PRESSURE_LOW         ?? '0.5'),
    flowNoFlow:         parseFloat(process.env.THRESHOLD_FLOW_NO_FLOW         ?? '0.1'),
  }

  const results: AnomalyResult[] = []

  // ── Water level ────────────────────────────────────────────────────────────
  if (reading.water_level != null) {
    if (reading.water_level < t.waterLevelCritical) {
      results.push({
        type: 'low_level',
        severity: 'critical',
        message: `Water level critically low at ${reading.water_level.toFixed(1)}%`,
      })
    } else if (reading.water_level < t.waterLevelLow) {
      results.push({
        type: 'low_level',
        severity: 'warning',
        message: `Water level low at ${reading.water_level.toFixed(1)}%`,
      })
    }
  }

  // ── Pressure ───────────────────────────────────────────────────────────────
  if (reading.pressure != null) {
    if (reading.pressure > t.pressureHigh) {
      results.push({
        type: 'high_pressure',
        severity: 'warning',
        message: `Pressure high at ${reading.pressure.toFixed(2)} bar`,
      })
    } else if (reading.pressure > 0 && reading.pressure < t.pressureLow) {
      results.push({
        type: 'low_pressure',
        severity: 'warning',
        message: `Pressure low at ${reading.pressure.toFixed(2)} bar`,
      })
    }
  }

  // ── Flow rate ──────────────────────────────────────────────────────────────
  if (reading.flow_rate != null && reading.flow_rate < t.flowNoFlow) {
    results.push({
      type: 'no_flow',
      severity: 'warning',
      message: `No flow detected (${reading.flow_rate.toFixed(2)} L/min)`,
    })
  }

  return results
}
