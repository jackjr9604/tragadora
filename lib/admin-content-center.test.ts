import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { bucketCount, normalizeContentCenterParams, type ContentCenterSummary } from './admin-content-center-policy'

test('normaliza vistas, bandejas y filtros del Centro', () => {
  assert.deepEqual(normalizeContentCenterParams({ view: 'translations', bucket: 'in_review', page: '2', pageSize: '50', module: 'blog_post_translation', language: 'pt', q: ' artículo ' }), {
    view: 'translations', bucket: 'in_review', page: 2, pageSize: 50, resourceType: 'blog_post_translation', language: 'pt', query: 'artículo', selected: undefined,
  })
  assert.equal(normalizeContentCenterParams({ view: 'invalid', bucket: 'invented', page: '-1' }).view, 'summary')
  assert.equal(normalizeContentCenterParams({ view: 'invalid', bucket: 'invented', page: '-1' }).bucket, undefined)
})

test('las bandejas leen contadores globales explícitos', () => {
  const summary: ContentCenterSummary = { resources: 9, fields: 20, pending: 7, draft: 6, in_review: 5, approved: 4, published: 3, partial: 2, stale: 1, error: 8, queued_jobs: 0, running_jobs: 0, retry_jobs: 0, failed_jobs: 0 }
  assert.equal(bucketCount(summary, 'pending'), 7)
  assert.equal(bucketCount(summary, 'partial'), 2)
  assert.equal(bucketCount(summary, 'error'), 8)
})

test('la migración restringe los read models a service_role y cubre todas las bandejas', () => {
  const sql = readFileSync('supabase/migrations/202610140001_content_center_read_models.sql', 'utf8')
  assert.match(sql, /auth\.role\(\)\s*<>\s*'service_role'/i)
  assert.match(sql, /revoke all on function public\.translation_admin_content_center_inventory[\s\S]*from public,anon,authenticated/i)
  for (const bucket of ['pending','draft','in_review','approved','published','partial','stale','error']) assert.match(sql, new RegExp(`p_bucket='${bucket}'`))
  assert.match(sql, /count\(\*\) over\(\)/i)
  assert.match(sql, /coalesce\(sum\(g\.total\),0\)::bigint/i)
})
