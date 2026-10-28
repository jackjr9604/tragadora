// Legacy on-chain research is not a declarative official-page collector.
// Keep this exception narrow: newly broken configurations must still fail.
export function sourceDisposition(source: {
  name: string
  config: Record<string, unknown> | null
}, platformSlug: string): 'collect' | 'disabled' | 'quarantined' {
  const collector = source.config?.collector
  if (collector && typeof collector === 'object' && !Array.isArray(collector)
    && (collector as Record<string, unknown>).enabled === false) return 'disabled'
  if (collector == null && platformSlug === 'lucid-trading'
    && source.name === 'Lucid Trading - Arbitrum') return 'quarantined'
  return 'collect'
}

export async function settleSourceCleanup(
  closePage: () => Promise<unknown>,
  saveStatus: () => Promise<unknown>,
): Promise<string[]> {
  const errors: string[] = []
  // Saving status must still be attempted if page cleanup fails.
  for (const action of [closePage, saveStatus]) {
    try { await action() } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }
  return errors
}

export function collectorRunFailed(summary: { eligible: number; succeeded: number; failed: number }) {
  return summary.failed > 0 || summary.eligible === 0 || summary.succeeded === 0
}
