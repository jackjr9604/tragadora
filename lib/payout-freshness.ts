export type PayoutFreshnessInput = {
  displayTotalUpdatedAt: string | null
  displayTotalSourceType: string | null
  displayTotalLastCheckedAt?: string | null
}

function validDate(value: string | null | undefined, now: number) {
  const time = value ? Date.parse(value) : NaN
  return Number.isFinite(time) && time <= now ? new Date(time).toISOString() : null
}

export function payoutFreshness(input: PayoutFreshnessInput, now = Date.now()) {
  const updatedAt = validDate(input.displayTotalUpdatedAt, now)
  const checkedAt = validDate(input.displayTotalLastCheckedAt, now)
  const thresholdHours = input.displayTotalSourceType === 'official_firm' ? 36 : 48
  return {
    updatedAt, checkedAt,
    // A successful comparison must never change the age of the captured figures.
    stale: updatedAt !== null && now - Date.parse(updatedAt) > thresholdHours * 3_600_000,
    unknown: updatedAt === null,
  }
}

export type OfficialCheckSource = {
  platform_id: string; source_type: string; source_url: string | null
  config: Record<string, unknown> | null; last_success_at: string | null
}

export function matchingOfficialCheck(summary: {
  platformId: string; periodKey: string; displayTotalSourceType: string | null
  displayTotalSourceName: string | null; displayTotalSourceUrl: string | null
}, sources: OfficialCheckSource[]) {
  if (summary.displayTotalSourceType !== 'official_firm' || !summary.displayTotalSourceUrl || !summary.displayTotalSourceName) return null
  const dates = sources.flatMap((source) => {
    const collector = source.config?.collector as Record<string, unknown> | undefined
    if (source.platform_id !== summary.platformId || source.source_type !== 'public_page'
      || source.source_url !== summary.displayTotalSourceUrl || collector?.sourceName !== summary.displayTotalSourceName
      || !Array.isArray(collector?.periods) || !collector.periods.some((period) => period?.periodKey === summary.periodKey)) return []
    return source.last_success_at ? [source.last_success_at] : []
  }).filter((value) => Number.isFinite(Date.parse(value)))
  return dates.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null
}
