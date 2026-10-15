import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { normalizeTranslationJobFilters, toRpcDateRange } from './admin-translation-jobs-policy'

test('normaliza filtros combinables y limita paginación de trabajos', () => {
  assert.deepEqual(normalizeTranslationJobFilters({
    page: '2', pageSize: '50', status: 'failed', module: 'blog_post_translation', resource: 'post-1',
    sourceLanguage: 'ES', targetLanguage: 'pt-BR', provider: 'LibreTranslate', error: 'translation_failed',
    from: '2026-10-01', to: '2026-10-15', sort: 'updated_desc',
  }), {
    page: 2, pageSize: 50, status: 'failed', resourceType: 'blog_post_translation', resourceId: 'post-1',
    sourceLanguage: 'es', targetLanguage: 'pt-br', provider: 'libretranslate', errorCode: 'translation_failed',
    createdFrom: '2026-10-01', createdTo: '2026-10-15', sort: 'updated_desc',
  })
  const invalid = normalizeTranslationJobFilters({ page: '-1', pageSize: '100', status: 'invented', module: 'unknown', provider: 'bad value', from: 'today' })
  assert.equal(invalid.page, 1)
  assert.equal(invalid.pageSize, 25)
  assert.equal(invalid.status, undefined)
  assert.equal(invalid.resourceType, undefined)
  assert.equal(invalid.provider, undefined)
})

test('rango de fechas usa inicio UTC y hasta exclusivo del día siguiente', () => {
  assert.deepEqual(toRpcDateRange({ createdFrom: '2026-10-01', createdTo: '2026-10-15' }), {
    from: '2026-10-01T00:00:00.000Z', to: '2026-10-16T00:00:00.000Z',
  })
})

test('la pestaña usa las tres RPC y autoriza módulos solo en servidor', () => {
  const source = readFileSync('lib/admin-content-center.ts', 'utf8')
  const page = readFileSync('app/admin/content-center/jobs/page.tsx', 'utf8')
  for (const rpc of ['translation_admin_jobs_inventory', 'translation_admin_jobs_summary', 'translation_admin_worker_status']) assert.match(source, new RegExp(`rpc\\('${rpc}'`))
  assert.match(source, /const allowed = allowedTranslationResources\(permissions\)/)
  assert.match(source, /p_allowed_resource_types: allowed/)
  assert.doesNotMatch(page, /getRecentTranslationJobs/)
  assert.match(page, /returnTo=/)
  assert.match(page, /Worker nunca conectado/)
  assert.match(page, /Worker desconectado/)
  assert.match(page, /Worker con problemas/)
  assert.match(page, /Worker disponible/)
})

test('worker envía heartbeat periódico dentro del umbral y no cambia la cola', () => {
  const worker = readFileSync('scripts/translation-worker.ts', 'utf8')
  assert.match(worker, /TRANSLATION_WORKER_HEARTBEAT_MS', 45_000, 15_000, 60_000/)
  assert.match(worker, /setInterval\(\(\) => \{ void sendHeartbeat\(\) \}, config\.heartbeatMs\)/)
  assert.match(worker, /status: 'stopping'/)
  assert.match(worker, /if \(!readiness\.ready\)[\s\S]*await sendHeartbeat\(\)[\s\S]*continue/)
})
