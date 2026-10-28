import assert from 'node:assert/strict'
import test from 'node:test'
import { sourceDisposition, settleSourceCleanup, collectorRunFailed } from './official-source-policy.ts'

const lucid = { name: 'Lucid Trading - Arbitrum', config: null }
test('aísla únicamente Lucid legacy sin collector', () => {
  assert.equal(sourceDisposition(lucid, 'lucid-trading'), 'quarantined')
  assert.equal(sourceDisposition(lucid, 'other'), 'collect')
  assert.equal(sourceDisposition({ ...lucid, name: 'New source' }, 'lucid-trading'), 'collect')
  assert.equal(sourceDisposition({ ...lucid, config: { collector: {} } }, 'lucid-trading'), 'collect')
  assert.equal(sourceDisposition({ ...lucid, config: { collector: { enabled: true } } }, 'lucid-trading'), 'collect')
})
test('respeta deshabilitación explícita sin tratar config malformada como deshabilitada', () => {
  assert.equal(sourceDisposition({ ...lucid, config: { collector: { enabled: false } } }, 'lucid-trading'), 'disabled')
  assert.equal(sourceDisposition({ ...lucid, config: { collector: false } }, 'lucid-trading'), 'collect')
})
test('fallos de cierre y estado no impiden procesar la siguiente fuente', async () => {
  const calls: string[] = []
  for (const name of ['broken', 'healthy']) {
    const errors = await settleSourceCleanup(
      async () => { calls.push(`close:${name}`); if (name === 'broken') throw new Error('close failed') },
      async () => { calls.push(`status:${name}`); if (name === 'broken') throw new Error('status failed') },
    )
    assert.deepEqual(errors, name === 'broken' ? ['close failed', 'status failed'] : [])
  }
  assert.deepEqual(calls, ['close:broken', 'status:broken', 'close:healthy', 'status:healthy'])
})

test('no oculta ausencia de cobertura ni fallos parciales', () => {
  assert.equal(collectorRunFailed({ eligible: 1, succeeded: 2, failed: 0 }), false)
  assert.equal(collectorRunFailed({ eligible: 0, succeeded: 0, failed: 0 }), true)
  assert.equal(collectorRunFailed({ eligible: 1, succeeded: 0, failed: 0 }), true)
  assert.equal(collectorRunFailed({ eligible: 2, succeeded: 2, failed: 1 }), true)
})
