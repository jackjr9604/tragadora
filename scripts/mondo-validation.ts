export const MONDO_HEADERS = ['FIRM', 'TRUST PILOT', 'TOTAL PAID', '# PAYOUTS', 'LARGEST', 'AVERAGE', 'AVG. TIME'] as const

export type NumericMondoMetric = {
  amount: number
  payoutCount: number
  largestPayout: number
  averagePayout: number
}

export class SourceRowInconsistencyError extends Error {
  constructor(
    readonly average: number,
    readonly calculatedAverage: number,
  ) {
    super(`SOURCE_ROW_INCONSISTENCY: average=${average} amount/count=${calculatedAverage.toFixed(2)}`)
    this.name = 'SourceRowInconsistencyError'
  }
}

export function assertMondoHeaders(headers: readonly string[]) {
  const normalized = headers.map((header) => header.trim().replace(/\s+/g, ' ').toUpperCase())
  if (normalized.length !== MONDO_HEADERS.length || MONDO_HEADERS.some((header, index) => normalized[index] !== header)) {
    throw new Error(`DOM_HEADERS_CHANGED: expected=${MONDO_HEADERS.join(' | ')} actual=${normalized.join(' | ')}`)
  }
}

export function validateMondoMetric(metric: NumericMondoMetric) {
  if (metric.amount <= 0 || metric.payoutCount <= 0 || metric.largestPayout < 0 || metric.averagePayout <= 0) {
    throw new Error('métricas fuera de rango')
  }
  const calculatedAverage = metric.amount / metric.payoutCount
  if (Math.abs(metric.averagePayout - calculatedAverage) > Math.max(1, calculatedAverage * 0.005)) {
    throw new SourceRowInconsistencyError(metric.averagePayout, calculatedAverage)
  }
}

export type MondoRunSummary = {
  periodFailures: number
  blocked: number
  snapshotsPrepared: number
}

export function mondoRunIsFatal(summary: MondoRunSummary) {
  return summary.periodFailures > 0 || summary.blocked > 0 || summary.snapshotsPrepared === 0
}
