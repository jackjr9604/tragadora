import assert from 'node:assert/strict'
import test from 'node:test'
import { formatMondoRunReport, mondoCheckRecord } from './mondo-run-report'
import { mondoRunIsFatal } from './mondo-validation'

test('unchanged is a successful check without a new capture', () => {
  const record = mondoCheckRecord('Fixture firm', '30d', 'UNCHANGED', '2026-10-28T12:00:00Z')
  assert.equal(record.successfulCheck, true)
  assert.equal(record.snapshotWritten, false)
  assert.equal(record.dryRun, false)
  assert.equal(record.checkedAt, '2026-10-28T12:00:00Z')
  assert.equal('collected_at' in record, false)
})

test('omissions and rejected rows never claim successful checks', () => {
  for (const outcome of ['NOT_LISTED', 'MISSING_REQUIRED_METRICS', 'SOURCE_ROW_INCONSISTENCY', 'VALIDATION_FAILED'] as const) {
    const record = mondoCheckRecord('Fixture firm', '24h', outcome)
    assert.equal(record.successfulCheck, false)
    assert.equal(record.snapshotWritten, false)
  }
  assert.equal(mondoCheckRecord('Fixture firm', 'all', 'WOULD_INSERT').snapshotWritten, false)
  assert.equal(mondoCheckRecord('Fixture firm', 'all', 'WOULD_INSERT', undefined, true).dryRun, true)
  assert.equal(mondoCheckRecord('Fixture firm', 'all', 'INSERTED').snapshotWritten, true)
})

test('an unchanged run reports source freshness uncertainty and gaps without changing fatal policy', () => {
  const summary = { startedAt: 'start', finishedAt: 'end', periodsSucceeded: 4, periodFailures: 0, blocked: 0, snapshotsPrepared: 8, snapshotsWouldInsert: 0, writes: 0, unchanged: 8, notListed: 1, missingRequiredMetrics: 2, validationFailures: 0, sourceValidationWarnings: 0 }
  const before = structuredClone(summary)
  const report = formatMondoRunReport(summary)
  assert.equal(report.warnings.length, 2)
  assert.match(report.markdown, /unchanged: 8; snapshots written: 0/)
  assert.match(report.markdown, /does not establish that upstream data is recent/)
  assert.match(report.markdown, /missingRequiredMetrics=2/)
  assert.deepEqual(summary, before)
  assert.equal(mondoRunIsFatal(summary), false)
  assert.equal(mondoRunIsFatal({ ...summary, blocked: 1 }), true)
  assert.equal(formatMondoRunReport({ ...summary, snapshotsWouldInsert: 1 }).warnings.length, 1)
})

test('a changed complete run does not get a no-change warning', () => {
  const report = formatMondoRunReport({ startedAt: 'start', finishedAt: 'end', periodsSucceeded: 4, periodFailures: 0, blocked: 0, snapshotsPrepared: 8, snapshotsWouldInsert: 0, writes: 1, unchanged: 7, notListed: 0, missingRequiredMetrics: 0, validationFailures: 0, sourceValidationWarnings: 0 })
  assert.deepEqual(report.warnings, [])
})
