export type MondoMetric = { amount: number; payoutCount: number; largestPayout: number; averagePayout: number; medianTimeMinutes: number | null; currency: string }
export type CurrentMondoSnapshot = { platform_id: string; period_key: string; amount: number | null; payout_count: number | null; largest_payout: number | null; average_payout: number | null; median_time_minutes: number | null; currency: string }

export function parseMondoInteger(value: string): number | null {
  const normalized = value.trim()
  if (normalized === '' || normalized === '—' || normalized === '-' || normalized.toUpperCase() === 'N/A') return null
  // The English table uses whole dollars and grouping separators. Do not silently
  // turn decimal/compact values or unexpected text into a different integer.
  const number = normalized.replace(/^(?:US\$|\$)\s*/, '')
  if (!/^(?:\d+|\d{1,3}(?:[.,]\d{3})+)$/.test(number)) throw new Error(`valor no numérico o formato no soportado: ${value}`)
  const parsed = Number(number.replace(/[.,]/g, ''))
  if (!Number.isSafeInteger(parsed)) throw new Error(`valor fuera de rango: ${value}`)
  return parsed
}

export function sameMondoMetric(current: CurrentMondoSnapshot, metric: MondoMetric) {
  return current.amount !== null && Number(current.amount) === metric.amount
    && current.payout_count !== null && Number(current.payout_count) === metric.payoutCount
    && current.largest_payout !== null && Number(current.largest_payout) === metric.largestPayout
    && current.average_payout !== null && Number(current.average_payout) === metric.averagePayout
    && (current.median_time_minutes === null ? null : Number(current.median_time_minutes)) === metric.medianTimeMinutes
    && current.currency === metric.currency
}
