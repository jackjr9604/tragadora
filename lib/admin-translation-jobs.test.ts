import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { normalizeTranslationJobFilters, safeTranslationJobsReturn, toRpcDateRange } from './admin-translation-jobs-policy'

test('normaliza filtros combinables y limita paginación de trabajos', () => {
  assert.deepEqual(normalizeTranslationJobFilters({
    page: '2', pageSize: '50', status: 'failed', module: 'blog_post_translation', resource: 'post-1',
    sourceLanguage: 'ES', targetLanguage: 'pt-BR', provider: 'LibreTranslate', error: 'translation_failed',
    from: '2026-10-01', to: '2026-10-15', sort: 'updated_desc', metricsPeriod: '7d',
  }), {
    page: 2, pageSize: 50, status: 'failed', resourceType: 'blog_post_translation', resourceId: 'post-1',
    sourceLanguage: 'es', targetLanguage: 'pt-br', provider: 'libretranslate', errorCode: 'translation_failed',
    createdFrom: '2026-10-01', createdTo: '2026-10-15', sort: 'updated_desc', metricsPeriod: '7d',
  })
  const invalid = normalizeTranslationJobFilters({ page: '-1', pageSize: '100', status: 'invented', module: 'unknown', provider: 'bad value', from: 'today' })
  assert.equal(invalid.page, 1)
  assert.equal(invalid.pageSize, 25)
  assert.equal(invalid.status, undefined)
  assert.equal(invalid.resourceType, undefined)
  assert.equal(invalid.provider, undefined)
  assert.equal(invalid.metricsPeriod, '24h')
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

test('detalle seguro clasifica errores sin exponer last_error ni worker interno', () => {
  const sql = readFileSync('supabase/migrations/202610150002_translation_job_safe_detail.sql', 'utf8')
  for (const category of ['recoverable_connectivity','lease_expired','source_unavailable','editorial_conflict','protected_content_validation','unknown']) assert.match(sql,new RegExp(category))
  assert.match(sql,/translation_admin_jobs_validate_filters/)
  assert.match(sql,/j\.resource_type=any\(p_allowed_resource_types\)/)
  assert.match(sql,/j\.metadata->>'engine'='3e3'/)
  assert.match(sql,/expected_lock_version/)
  assert.match(sql,/active\.status in \('queued','running','retry_wait'\)/)
  assert.match(sql,/revoke all on function public\.translation_admin_job_detail\(uuid,text\[\]\) from public,anon,authenticated/i)
  const returns = sql.match(/returns table\(([\s\S]*?)\)\nlanguage/i)?.[1] ?? ''
  assert.doesNotMatch(returns,/last_error|locked_by|worker_id|metadata/i)
  const body = sql.match(/as \$\$([\s\S]*?)\$\$;/i)?.[1] ?? ''
  assert.doesNotMatch(body,/\b(insert into|update|delete from)\s+public\./i)
})

test('detalle conserva regreso únicamente al inventario de trabajos', () => {
  assert.equal(safeTranslationJobsReturn('/admin/content-center/jobs?status=failed&page=2'),'/admin/content-center/jobs?status=failed&page=2')
  assert.equal(safeTranslationJobsReturn(encodeURIComponent('/admin/content-center/jobs?module=blog_post_translation')),'/admin/content-center/jobs?module=blog_post_translation')
  assert.equal(safeTranslationJobsReturn('/admin/content-center/translations'),'/admin/content-center/jobs')
  assert.equal(safeTranslationJobsReturn('https://evil.test/admin/content-center/jobs'),'/admin/content-center/jobs')
})

test('listado enlaza el detalle y la ruta separa trabajo técnico de publicación', () => {
  const list = readFileSync('app/admin/content-center/jobs/page.tsx','utf8')
  const detail = readFileSync('app/admin/content-center/jobs/[jobId]/page.tsx','utf8')
  assert.match(list,/Ver detalle/)
  assert.match(detail,/Estado técnico ≠ publicación/)
  assert.match(detail,/Línea temporal disponible/)
  assert.doesNotMatch(detail,/last_error|locked_by|worker_id/)
})

test('worker envía heartbeat periódico dentro del umbral y no cambia la cola', () => {
  const worker = readFileSync('scripts/translation-worker.ts', 'utf8')
  assert.match(worker, /TRANSLATION_WORKER_HEARTBEAT_MS', 45_000, 15_000, 60_000/)
  assert.match(worker, /setInterval\(\(\) => \{ void sendHeartbeat\(\) \}, config\.heartbeatMs\)/)
  assert.match(worker, /status: 'stopping'/)
  assert.match(worker, /if \(!readiness\.ready\)[\s\S]*await sendHeartbeat\(\)[\s\S]*continue/)
})
