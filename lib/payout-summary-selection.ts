type Row = Record<string, unknown>

// Company summaries and the subset of individually attributed payments have different
// coverage. Keep the chosen summary as one packet; verified_* remains independent.
export function payoutMetricPriority(row: Row) {
  const type = row.source_type, level = row.verification_level
  if (level === 'unverified') return -1
  if (type === 'official_api') return 500
  if (type === 'official_firm' && level === 'firm_reported') return 400
  if (type === 'third_party_api' && level === 'tracked_external') return 300
  if (type === 'third_party_public' && level === 'blockchain_external') return 250
  if (type === 'third_party_public' && level === 'tracked_external') return 200
  if (['official_firm', 'third_party_api'].includes(String(type))) return 150
  if (type === 'third_party_public') return 120
  return type === 'manual' ? 100 : 0
}

export function selectPayoutSummary(row: Row, metrics: readonly Row[]): Row {
  const selected = metrics.filter(metric => metric.platform_id === row.platform_id
    && metric.period_key === row.period_key && metric.is_current === true
    && metric.metric_type === 'payout_summary' && payoutMetricPriority(metric) >= 0)
    .sort((a, b) => payoutMetricPriority(b) - payoutMetricPriority(a)
      || String(b.collected_at).localeCompare(String(a.collected_at))
      || String(b.updated_at).localeCompare(String(a.updated_at))
      || String(a.id).localeCompare(String(b.id)))[0]
  const hasVerified = Number(row.verified_payout_count) > 0
  return {
    ...row,
    display_total_amount: selected ? selected.amount : hasVerified ? row.verified_amount : null,
    known_payout_count: selected ? selected.payout_count : hasVerified ? row.verified_payout_count : null,
    known_largest_payout: selected ? selected.largest_payout : hasVerified ? row.verified_largest_payout : null,
    known_average_payout: selected ? selected.average_payout : hasVerified ? row.verified_average_payout : null,
    known_median_time_minutes: selected?.median_time_minutes ?? null,
    known_currency: selected ? selected.currency : hasVerified ? 'USD' : null,
    display_total_source_type: selected ? selected.source_type : hasVerified ? 'tragadora_blockchain' : null,
    display_total_source_name: selected ? selected.source_name : hasVerified ? 'Tragadora' : null,
    display_total_source_url: selected?.source_url ?? null,
    display_total_verification_level: selected ? selected.verification_level : hasVerified ? 'verified' : null,
    display_total_updated_at: selected ? selected.collected_at ?? selected.updated_at : hasVerified ? row.verified_last_payout_at : null,
  }
}
