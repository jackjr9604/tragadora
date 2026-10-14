import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql = readFileSync(join(process.cwd(), 'supabase/migrations/202610130002_translation_resource_admin.sql'), 'utf8')

test('inventario 3E.4 agrupa y pagina recursos en PostgreSQL', () => {
  assert.match(sql, /create or replace function public\.translation_admin_resource_inventory/)
  assert.match(sql, /select distinct s\.resource_type,s\.resource_id/)
  assert.match(sql, /group by s\.resource_type,s\.resource_id/)
  assert.match(sql, /count\(\*\) over\(\) as total_count/)
  assert.match(sql, /offset \(p_page-1\)\*p_page_size limit p_page_size/)
})

test('inventario 3E.4 es solo lectura y exclusivo de service_role', () => {
  assert.doesNotMatch(sql, /insert into public\.translation_jobs/i)
  assert.doesNotMatch(sql, /update public\.translation_field_state/i)
  assert.match(sql, /auth\.role\(\) <> 'service_role'/)
  assert.match(sql, /revoke all on function public\.translation_admin_resource_inventory[\s\S]+from public,anon,authenticated/)
  assert.match(sql, /grant execute on function public\.translation_admin_resource_inventory[\s\S]+to service_role/)
})

test('inventario 3E.4 cubre los 14 recursos registrados', () => {
  const resources = ['site_content','platform_translation','broker_detail_translation','exchange_detail_translation','offer_translation','challenge_phase_translation','challenge_variant_translation','challenge_variant_phase_translation','account_plan_translation','challenge_reward_translation','tool_translation','community_translation','giveaway_translation','blog_post_translation']
  for (const resource of resources) assert.match(sql, new RegExp(`'${resource}'`))
})
