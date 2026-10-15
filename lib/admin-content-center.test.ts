import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { bucketCount, normalizeContentCenterParams, type ContentCenterSummary } from './admin-content-center-policy'
import { safeContentCenterReturn } from './admin-content-center-navigation'
import { CONTENT_CENTER_VIEW_PERMISSIONS, permissionsForAdminPath } from './admin-permissions'

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

test('el Centro usa rutas canónicas y conserva compatibilidad sin entradas laterales duplicadas', () => {
  const layout = readFileSync('app/admin/layout.tsx', 'utf8')
  const navigation = readFileSync('components/admin/AdminShellNavigation.tsx', 'utf8')
  const editor = readFileSync('components/admin/content/PageContentEditor.tsx', 'utf8')
  const proxy = readFileSync('proxy.ts', 'utf8')
  assert.match(layout, /Centro de contenido/)
  assert.doesNotMatch(layout, /label: 'Traducciones'/)
  assert.doesNotMatch(navigation, /'\/admin\/translations'/)
  assert.match(editor, /\/admin\/content-center\/translations/)
  assert.match(proxy, /target\.pathname = '\/admin\/content-center\/translations'/)
})

test('el acceso al Centro admite permisos traducibles pero restringe Contenido e Idiomas', () => {
  assert.ok(CONTENT_CENTER_VIEW_PERMISSIONS.includes('platforms.view'))
  assert.ok(CONTENT_CENTER_VIEW_PERMISSIONS.includes('blog.view'))
  assert.deepEqual(permissionsForAdminPath('/admin/content-center/content/home'), ['content.view'])
  assert.deepEqual(permissionsForAdminPath('/admin/content-center/languages'), ['content.view'])
  assert.equal(permissionsForAdminPath('/admin/content-center/translations').length, CONTENT_CENTER_VIEW_PERMISSIONS.length)
})

test('returnTo solo acepta rutas internas del Centro', () => {
  assert.equal(safeContentCenterReturn(encodeURIComponent('/admin/content-center/review?q=blog')), '/admin/content-center/review?q=blog')
  assert.equal(safeContentCenterReturn(encodeURIComponent('/admin/users')), '/admin/content-center/translations')
  assert.equal(safeContentCenterReturn(encodeURIComponent('//evil.test')), '/admin/content-center/translations')
})

test('la ruta canónica de traducciones conserva las ocho bandejas editoriales', () => {
  const page = readFileSync('app/admin/content-center/translations/page.tsx', 'utf8')
  const buckets = readFileSync('components/admin/content/ContentCenterBucketView.tsx', 'utf8')
  assert.match(page, /ContentCenterBucketView/)
  assert.match(page, /showEditorialBuckets/)
  assert.match(page, /if \(bucket\)/)
  assert.match(buckets, /CONTENT_CENTER_BUCKETS\.map/)
  assert.match(buckets, /name="bucket"/)
  assert.match(buckets, /returnTo=\$\{encodeURIComponent\(returnTo\)\}/)
  assert.match(buckets, /estados editoriales/)
  assert.match(buckets, /\/admin\/content-center\/jobs/)
})

test('la vista general conserva filtros detallados además de las bandejas', () => {
  const inventory = readFileSync('app/admin/translations/page.tsx', 'utf8')
  assert.match(inventory, /ContentCenterBucketTabs/)
  assert.match(inventory, /name="status"/)
  assert.match(inventory, /name="protection"/)
  assert.match(inventory, /name="sort"/)
})
