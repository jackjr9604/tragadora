import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync('supabase/migrations/202610110002_tool_translations.sql', 'utf8')

test('3D.2 usa tools.update/view y protege helpers SECURITY DEFINER', () => {
  assert.match(sql, /p_resource_type='tool_translation' then 'tools\.update'/)
  assert.match(sql, /has_admin_permission\('tools\.view'\)/)
  assert.match(sql, /revoke all on function public\.translation_read_value_before_tools/)
  assert.match(sql, /revoke all on function public\.translation_write_value_before_tools/)
  assert.match(sql, /revoke all on function public\.translation_write_tool_value/)
})

test('3D.2 no crea traducciones ni jobs y conserva identidad estable', () => {
  assert.match(sql, /primary key\(tool_id,language\)/)
  assert.match(sql, /La inicialización 3D\.2 no debe crear translation_jobs/)
  assert.match(sql, /La inicialización 3D\.2 no debe crear traducciones/)
})

test('name solo es traducible para herramientas propias o internas', () => {
  assert.match(sql, /tool_type='internal' or is_ours/)
  assert.match(sql, /Los nombres comerciales externos no son traducibles/)
})
