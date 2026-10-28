export type MondoCheckOutcome = 'UNCHANGED' | 'INSERTED' | 'WOULD_INSERT' | 'NOT_LISTED' | 'MISSING_REQUIRED_METRICS' | 'SOURCE_ROW_INCONSISTENCY' | 'VALIDATION_FAILED'

export function mondoCheckRecord(firm: string, period: string, outcome: MondoCheckOutcome, checkedAt = new Date().toISOString(), dryRun = false) {
  return {
    event: 'MONDO_CHECK', firm, period, checkedAt, outcome, dryRun,
    // A dry run can verify extraction but cannot claim a persisted snapshot.
    successfulCheck: outcome === 'UNCHANGED' || outcome === 'INSERTED' || outcome === 'WOULD_INSERT',
    snapshotWritten: outcome === 'INSERTED',
  }
}

type Summary = {
  startedAt: string; finishedAt: string; periodsSucceeded: number; periodFailures: number
  blocked: number; snapshotsPrepared: number; snapshotsWouldInsert: number; writes: number; unchanged: number
  notListed: number; missingRequiredMetrics: number; validationFailures: number
  sourceValidationWarnings: number
}

export function formatMondoRunReport(summary: Summary) {
  const warnings: string[] = []
  if (summary.unchanged > 0 && summary.writes === 0 && summary.snapshotsWouldInsert === 0) {
    warnings.push('MONDO_NO_CHANGES: successful comparisons found no changes. This does not establish that upstream data is recent; snapshot capture dates are preserved.')
  }
  if (summary.notListed || summary.missingRequiredMetrics || summary.validationFailures || summary.sourceValidationWarnings) {
    warnings.push(`MONDO_COVERAGE_GAPS: notListed=${summary.notListed}, missingRequiredMetrics=${summary.missingRequiredMetrics}, validationFailures=${summary.validationFailures}, sourceValidationWarnings=${summary.sourceValidationWarnings}. These rows are not successful checks.`)
  }
  return {
    warnings,
    markdown: `## MondoTraders checks\n\nRun started: ${summary.startedAt}\n\nRun finished: ${summary.finishedAt}\n\nSuccessful periods: ${summary.periodsSucceeded}; failed periods: ${summary.periodFailures}; blocked: ${summary.blocked}.\n\nValid comparisons: ${summary.snapshotsPrepared}; unchanged: ${summary.unchanged}; snapshots written: ${summary.writes}.\n\n${warnings.join('\n\n')}\n\nMONDO_CHECK log entries identify each firm, period, check time and outcome. Check time is distinct from snapshot capture time. No snapshot dates are refreshed by this report.\n`,
  }
}
