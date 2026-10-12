import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const migrationPath = path.join(process.cwd(), 'supabase/migrations/202610110001_broker_exchange_detail_translations.sql')
const sql = fs.readFileSync(migrationPath, 'utf8')

test('3D.1 registra solo los recursos y campos especializados', () => {
  assert.match(sql, /'broker_detail_translation','regulation_summary','rich_text'/)
  assert.match(sql, /'exchange_detail_translation','product_summary','text'/)
  assert.match(sql, /'exchange_detail_translation','regulation_summary','rich_text'/)
  assert.doesNotMatch(sql, /broker_detail_translations[\s\S]{0,300}short_description/i)
  assert.doesNotMatch(sql, /exchange_detail_translations[\s\S]{0,300}seo_title/i)
})

test('3D.1 encadena adaptadores anteriores y restringe helpers SECURITY DEFINER', () => {
  assert.match(sql, /translation_read_value_before_platform_details/)
  assert.match(sql, /translation_write_value_before_platform_details/)
  assert.match(sql, /return public\.translation_read_value_before_platform_details/)
  assert.match(sql, /perform public\.translation_write_value_before_platform_details/)
  for (const signature of [
    'translation_read_value_before_platform_details\\(text,text,text,text\\)',
    'translation_write_value_before_platform_details\\(text,text,text,text,jsonb,uuid\\)',
    'translation_read_value_before_challenges\\(text,text,text,text\\)',
    'translation_write_value_before_challenges\\(text,text,text,text,jsonb,uuid\\)',
  ]) assert.match(sql, new RegExp(`revoke all on function public\\.${signature} from public,anon,authenticated`, 'i'))
})

test('3D.1 separa INSERT UPDATE DELETE, inicializa metadata y crea cero jobs', () => {
  assert.match(sql, /translation_platform_detail_source_insert_trigger\(\)/)
  assert.match(sql, /translation_platform_detail_source_update_trigger\(\)/)
  assert.match(sql, /translation_platform_detail_source_delete_trigger\(\)/)
  assert.match(sql, /translation_register_source_change_internal/)
  assert.match(sql, /translation_invalidate_source_internal/)
  assert.doesNotMatch(sql, /insert into public\.translation_jobs/i)
  assert.match(sql, /La inicialización 3D\.1 no debe crear translation_jobs/)
})

test('3D.1 exige platforms.update y expone lectura administrativa por platforms.view', () => {
  assert.match(sql, /p_resource_type in \('broker_detail_translation','exchange_detail_translation'\) then 'platforms\.update'/)
  assert.match(sql, /has_admin_permission\(''platforms\.view''\)/)
  assert.match(sql, /resource_type in \('platform_translation','broker_detail_translation','exchange_detail_translation'\)/)
})
