// Offline proposal review only. This module neither fetches nor persists payout data.
export type OfficialPayoutEvidence = {
  firm: string
  source: { url: string; officialHost: string; checkedAt: string; asOf: string | null; accessible: boolean }
  amount: { literal: string; value: string | null; precision: 'exact' | 'approximate' | 'lower_bound' | 'unknown'; operator: 'eq' | 'approx' | 'gt' | 'gte' | 'plus' | 'unknown' }
  currency: string | null
  scope: 'firm_total' | 'individual_payout' | 'individual_total' | 'funding' | 'conditions' | 'unknown'
  period: { kind: 'lifetime' | 'calendar' | 'rolling' | 'unknown'; start: string | null; end: string | null; days: number | null }
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const nullableString = (value: unknown) => value === null || typeof value === 'string'

function isEvidence(value: unknown): value is OfficialPayoutEvidence {
  if (!object(value) || !object(value.source) || !object(value.amount) || !object(value.period)) return false
  const { source, amount, period } = value
  return typeof value.firm === 'string' && typeof source.url === 'string' && typeof source.officialHost === 'string'
    && typeof source.checkedAt === 'string' && nullableString(source.asOf) && typeof source.accessible === 'boolean'
    && typeof amount.literal === 'string' && nullableString(amount.value) && nullableString(value.currency)
    && ['exact', 'approximate', 'lower_bound', 'unknown'].includes(String(amount.precision))
    && ['eq', 'approx', 'gt', 'gte', 'plus', 'unknown'].includes(String(amount.operator))
    && ['firm_total', 'individual_payout', 'individual_total', 'funding', 'conditions', 'unknown'].includes(String(value.scope))
    && ['lifetime', 'calendar', 'rolling', 'unknown'].includes(String(period.kind))
    && nullableString(period.start) && nullableString(period.end) && (period.days === null || typeof period.days === 'number')
}

// Require an explicit calendar date, not locale-dependent parsing such as "October".
function time(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return NaN
  const parsed = Date.parse(value)
  const calendar = Date.parse(value.slice(0, 10))
  return Number.isFinite(parsed) && Number.isFinite(calendar) && new Date(calendar).toISOString().slice(0, 10) === value.slice(0, 10) ? parsed : NaN
}

export function reviewOfficialPayoutEvidence(input: unknown, now = Date.now()) {
  if (!isEvidence(input)) return { status: 'blocked' as const, issues: ['INVALID_EVIDENCE_SHAPE'], evidence: null, loadAuthorized: false as const }
  const evidence = structuredClone(input)
  const issues: string[] = []
  const { source, amount, period } = evidence
  try {
    const url = new URL(source.url)
    const host = (value: string) => value.toLowerCase().replace(/^www\./, '')
    if (url.protocol !== 'https:' || url.username || url.password || host(url.hostname) !== host(source.officialHost)) issues.push('OFFICIAL_SOURCE_URL_NOT_CONFIRMED')
  } catch { issues.push('INVALID_SOURCE_URL') }
  if (!source.accessible) issues.push('PUBLIC_SOURCE_ACCESS_UNCONFIRMED')
  const checkedAt = time(source.checkedAt), asOf = time(source.asOf)
  if (!Number.isFinite(checkedAt) || checkedAt > now) issues.push('INVALID_CHECK_DATE')
  if (!Number.isFinite(asOf) || asOf > checkedAt) issues.push('DATA_CUTOFF_UNCONFIRMED')
  if (!evidence.currency || !/^[A-Z]{3}$/.test(evidence.currency)) issues.push('CURRENCY_UNCONFIRMED')
  if (!amount.literal.trim()) issues.push('ORIGINAL_CLAIM_MISSING')
  if (amount.value === null || !/^\d+(?:\.\d+)?$/.test(amount.value)) issues.push('AMOUNT_VALUE_UNCONFIRMED')
  const hasLimit = /[+>≥]|\b(over|more than|at least|mais de|pelo menos)\b|más de|al menos/i.test(amount.literal)
  const hasApproximation = /[~≈]|\b(about|approximately|circa|around)\b|aprox|cerca de/i.test(amount.literal)
  if (amount.precision === 'exact' && (amount.operator !== 'eq' || hasLimit || hasApproximation)) issues.push('PROMOTIONAL_CLAIM_IS_NOT_EXACT')
  if (amount.precision === 'approximate' && (amount.operator !== 'approx' || hasLimit)) issues.push('APPROXIMATION_SEMANTICS_MISMATCH')
  if (amount.precision === 'lower_bound' && !['gt', 'gte', 'plus'].includes(amount.operator)) issues.push('BOUND_OPERATOR_MISSING')
  if (amount.precision === 'lower_bound' && (!hasLimit || hasApproximation)) issues.push('BOUND_LITERAL_MISMATCH')
  if (amount.precision === 'unknown') issues.push('PRECISION_UNCONFIRMED')
  if (amount.operator === 'gt' && /\+/.test(amount.literal) && !/\b(over|more than|mais de)\b|más de|>/i.test(amount.literal)) issues.push('PLUS_OPERATOR_MUST_REMAIN_UNQUALIFIED')
  if (amount.precision === 'lower_bound' && amount.operator === 'plus' && !amount.literal.includes('+')) issues.push('BOUND_LITERAL_MISMATCH')
  if (amount.operator === 'gte' && !/≥|>=|\b(at least|pelo menos)\b|al menos/i.test(amount.literal)) issues.push('BOUND_LITERAL_MISMATCH')
  if (amount.operator === 'gt' && /≥|>=|\b(at least|pelo menos)\b|al menos/i.test(amount.literal)) issues.push('BOUND_LITERAL_MISMATCH')
  if (evidence.scope !== 'firm_total') issues.push('NOT_A_FIRM_PAYOUT_TOTAL')
  if (period.kind === 'unknown') issues.push('PERIOD_UNCONFIRMED')
  if (period.kind === 'lifetime' && (period.start !== null || period.end !== null || period.days !== null)) issues.push('LIFETIME_PERIOD_MUST_NOT_MIX_WINDOWS')
  if (period.kind === 'calendar' || period.kind === 'rolling') {
    const start = time(period.start), end = time(period.end)
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || end > asOf) issues.push('PERIOD_BOUNDARIES_UNCONFIRMED')
    if (period.kind === 'calendar' && period.days !== null) issues.push('CALENDAR_PERIOD_IS_NOT_A_ROLLING_WINDOW')
    if (period.kind === 'rolling' && (!Number.isInteger(period.days) || (period.days ?? 0) <= 0 || end - start !== (period.days ?? 0) * 86_400_000)) issues.push('ROLLING_PERIOD_DURATION_MISMATCH')
  }
  return {
    status: issues.length ? 'blocked' as const : amount.precision === 'exact' ? 'exact_candidate_for_human_review' as const : 'reference_only' as const,
    issues, evidence,
    // No review result is permission to load data or a database insert payload.
    loadAuthorized: false as const,
  }
}
