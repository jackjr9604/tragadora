import assert from 'node:assert/strict'
import test from 'node:test'
import { isLocalProviderUnavailable, normalizeLanguageCodes, prepareLocalTranslationWorker, reportTranslationWorkerHeartbeat, type WorkerRpcClient } from './translation/worker-runtime'

function client(responses: Record<string, { data: unknown; error: { message: string } | null }>) {
  const calls: string[] = []
  const value: WorkerRpcClient = { rpc(name) { calls.push(name); return Promise.resolve(responses[name] ?? { data: null, error: null }) } }
  return { value, calls }
}

test('servidor local apagado no toca Supabase ni reclama trabajos', async () => {
  const rpc = client({})
  const result = await prepareLocalTranslationWorker({ client: rpc.value,
    provider: { async supportedLanguages() { throw new TypeError('fetch failed ECONNREFUSED') } }, recoveryLimit: 50 })
  assert.equal(result.ready, false)
  assert.deepEqual(rpc.calls, [])
})

test('reconexión registra idiomas y recupera fallos antes de reclamar', async () => {
  const rpc = client({
    translation_worker_report_languages: { data: null, error: null },
    translation_recover_local_provider_jobs: { data: [{ id: 'legacy-1' }], error: null },
  })
  const result = await prepareLocalTranslationWorker({ client: rpc.value,
    provider: { async supportedLanguages() { return ['PT', 'es', 'en', 'es', 'inválido'] } }, recoveryLimit: 50 })
  assert.deepEqual(result, { ready: true, supportedCodes: ['en', 'es', 'pt'], recoveredJobs: 1 })
  assert.deepEqual(rpc.calls, ['translation_worker_report_languages', 'translation_recover_local_provider_jobs'])
})

test('un error de compatibilidad o recuperación bloquea el claim', async () => {
  const rpc = client({ translation_worker_report_languages: { data: null, error: { message: 'UPDATE requires a WHERE clause' } } })
  const result = await prepareLocalTranslationWorker({ client: rpc.value,
    provider: { async supportedLanguages() { return ['es', 'en'] } }, recoveryLimit: 50 })
  assert.equal(result.ready, false)
  assert.deepEqual(rpc.calls, ['translation_worker_report_languages'])
})

test('normaliza idiomas y clasifica únicamente indisponibilidad local como recuperable', () => {
  assert.deepEqual(normalizeLanguageCodes(['ES', 'pt-BR', ' pt-br ', 'bad value']), ['es', 'pt-br'])
  assert.equal(isLocalProviderUnavailable(new Error('LibreTranslate fetch ECONNREFUSED')), true)
  assert.equal(isLocalProviderUnavailable(new Error('La traducción alteró Markdown protegido')), false)
})

test('heartbeat informa ready, degraded y stopping sin reclamar ni modificar trabajos', async () => {
  const calls: { name: string; params: Record<string, unknown> }[] = []
  const rpc: WorkerRpcClient = { rpc(name, params) { calls.push({ name, params }); return Promise.resolve({ data: null, error: null }) } }
  for (const status of ['ready', 'degraded', 'stopping'] as const) {
    const result = await reportTranslationWorkerHeartbeat({ client: rpc, workerId: 'windows-test', status,
      supportedCodes: ['PT', 'es', 'en', 'es'], startedAt: '2026-10-15T12:00:00.000Z',
      providerCheckedAt: '2026-10-15T12:00:01.000Z', lastErrorCode: status === 'degraded' ? 'local_provider_unavailable' : null })
    assert.deepEqual(result, { ok: true })
  }
  assert.deepEqual(calls.map((call) => call.name), Array(3).fill('translation_worker_heartbeat'))
  assert.deepEqual(calls[0].params.p_supported_languages, ['en', 'es', 'pt'])
  assert.deepEqual(calls.map((call) => call.params.p_status), ['ready', 'degraded', 'stopping'])
})

test('fallo del heartbeat se devuelve saneado y no lanza ni toca la cola', async () => {
  const rpc: WorkerRpcClient = { rpc() { return Promise.resolve({ data: null, error: { message: 'fetch https://127.0.0.1:5000 token=secret' } }) } }
  const result = await reportTranslationWorkerHeartbeat({ client: rpc, workerId: 'windows-test', status: 'degraded', supportedCodes: [],
    startedAt: '2026-10-15T12:00:00.000Z', providerCheckedAt: null, lastErrorCode: 'local_provider_unavailable' })
  assert.equal(result.ok, false)
  if (!result.ok) assert.doesNotMatch(result.error, /127\.0\.0\.1|secret/)
})
