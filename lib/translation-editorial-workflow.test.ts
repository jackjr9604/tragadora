import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { canRunTranslationAction, parseTranslationEditorValue } from './admin-translation-editor-policy'

const sql = readFileSync(path.join(process.cwd(), 'supabase', 'migrations', '202610120003_translation_editorial_workflow.sql'), 'utf8')

test('separa borrador y publicación sin modificar el valor funcional al guardar', () => {
  const save = sql.slice(sql.indexOf('create or replace function public.translation_save_draft'), sql.indexOf('create or replace function public.translation_submit_review'))
  assert.match(save, /draft_value=p_value/)
  assert.doesNotMatch(save, /translation_write_value/)
  assert.match(sql, /publication_status in \('unpublished','published'\)/)
  assert.match(sql, /workflow_status in \('none','draft','in_review','approved'\)/)
})

test('publicar exige aprobación, copia el borrador y protege el valor manual', () => {
  const publish = sql.slice(sql.indexOf('create or replace function public.translation_publish_draft'), sql.indexOf('create or replace function public.translation_withdraw_publication'))
  assert.match(publish, /workflow_status <> 'approved'/)
  assert.match(publish, /translation_write_value[\s\S]*state_row\.draft_value/)
  assert.match(publish, /publication_status='published'/)
  assert.match(publish, /is_protected=true,protection_reason='manual'/)
})

test('todas las mutaciones validan permiso, versión y fuente', () => {
  for (const name of ['translation_save_draft','translation_submit_review','translation_approve_draft','translation_publish_draft']) {
    const start = sql.indexOf(`create or replace function public.${name}`)
    const end = sql.indexOf('create or replace function public.', start + 1)
    const body = sql.slice(start, end)
    assert.match(body, /translation_assert_admin_permission/)
    assert.match(body, /translation_editor_assert_version/)
    assert.match(body, /translation_editor_assert_source/)
  }
  assert.match(sql, /lock_version=lock_version\+1/g)
  assert.match(sql, /using errcode='40001'/)
})

test('stale retira publicación y no se crean jobs', () => {
  assert.match(sql, /new\.status in \('missing','stale','error'\)/)
  assert.match(sql, /new\.publication_status:='unpublished'/)
  assert.doesNotMatch(sql, /insert into public\.translation_jobs/i)
  assert.match(sql, /3E\.2 no debe crear translation_jobs/)
})

test('las RPC editoriales son autenticadas y las RPC legacy dejan de omitir el flujo', () => {
  for (const name of ['translation_save_draft','translation_submit_review','translation_approve_draft','translation_publish_draft','translation_withdraw_publication']) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${name}`))
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}`))
  }
  assert.match(sql, /revoke execute on function public\.translation_save_manual[\s\S]*from authenticated/)
  assert.match(sql, /revoke execute on function public\.translation_approve[\s\S]*from authenticated/)
})

test('las escrituras directas sobre tablas mixtas retiran la publicación', () => {
  assert.match(sql, /translation_site_content_target_guard/)
  assert.match(sql, /translation_platform_target_guard/)
  assert.match(sql, /translation_editor_publish_state/)
  assert.match(sql, /publication_status='unpublished'/)
  assert.match(sql, /revoke all on function public\.translation_invalidate_direct_target_edit/)
})

test('normaliza texto y arrays sin aceptar borradores vacíos', () => {
  assert.equal(parseTranslationEditorValue(' Texto ', 'text'), 'Texto')
  assert.deepEqual(parseTranslationEditorValue('Uno\n\n Dos ', 'text_array'), ['Uno', 'Dos'])
  assert.throws(() => parseTranslationEditorValue('   ', 'text'))
  assert.equal(canRunTranslationAction('submit_review', 'draft', 'unpublished'), true)
  assert.equal(canRunTranslationAction('publish', 'in_review', 'unpublished'), false)
  assert.equal(canRunTranslationAction('withdraw', 'none', 'published'), true)
})
