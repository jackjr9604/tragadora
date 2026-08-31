export const payoutPeriods = [
  { key: '24h', label: '24 h', days: 1 },
  { key: '7d', label: '7 días', days: 7 },
  { key: '30d', label: '30 días', days: 30 },
  { key: '365d', label: '365 días', days: 365 },
  { key: 'all', label: 'All Time', days: null },
] as const

export type PayoutPeriodKey = (typeof payoutPeriods)[number]['key']

export function payoutPeriod(value: string | undefined, fallback: PayoutPeriodKey): PayoutPeriodKey {
  return payoutPeriods.some((period) => period.key === value) ? value as PayoutPeriodKey : fallback
}

export function payoutPeriodLabel(key: PayoutPeriodKey) {
  return payoutPeriods.find((period) => period.key === key)?.label ?? key
}

export function payoutPeriodSince(key: PayoutPeriodKey) {
  const days = payoutPeriods.find((period) => period.key === key)?.days
  return days ? new Date(Date.now() - days * 86_400_000).toISOString() : null
}
