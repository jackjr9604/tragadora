import assert from 'node:assert/strict'
import test from 'node:test'
import { assertMondoHeaders, mondoRunIsFatal, SourceRowInconsistencyError, validateMondoMetric } from './mondo-validation'

test('acepta una fila sana y el redondeo normal', () => {
  assert.doesNotThrow(() => validateMondoMetric({ amount: 10_000, payoutCount: 6, largestPayout: 3_000, averagePayout: 1_667 }))
  assert.doesNotThrow(() => validateMondoMetric({ amount: 100, payoutCount: 3, largestPayout: 40, averagePayout: 34 }))
})

test('clasifica un promedio inconsistente como SOURCE_ROW_INCONSISTENCY', () => {
  assert.throws(
    () => validateMondoMetric({ amount: 10_000, payoutCount: 10, largestPayout: 2_000, averagePayout: 2_000 }),
    SourceRowInconsistencyError,
  )
})

test('un warning de fuente no vuelve fatal una ejecución con snapshots procesables', () => {
  assert.equal(mondoRunIsFatal({ periodFailures: 0, blocked: 0, snapshotsPrepared: 1 }), false)
  assert.equal(mondoRunIsFatal({ periodFailures: 1, blocked: 0, snapshotsPrepared: 1 }), true)
  assert.equal(mondoRunIsFatal({ periodFailures: 0, blocked: 1, snapshotsPrepared: 1 }), true)
  assert.equal(mondoRunIsFatal({ periodFailures: 0, blocked: 0, snapshotsPrepared: 0 }), true)
})

test('los headers exactos pasan y un cambio de DOM falla', () => {
  assert.doesNotThrow(() => assertMondoHeaders(['Firm', 'Trust Pilot', 'Total Paid', '# Payouts', 'Largest', 'Average', 'Avg. Time']))
  assert.throws(() => assertMondoHeaders(['Firm', 'Trustpilot', 'Total Paid', '# Payouts', 'Largest', 'Average', 'Avg. Time']), /DOM_HEADERS_CHANGED/)
})
