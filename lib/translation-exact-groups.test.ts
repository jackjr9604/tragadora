import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isNonTranslatableExactField } from './admin-translation-exact-group-policy'

const migration=readFileSync('supabase/migrations/202610270003_translation_exact_group_proposals.sql','utf8')
const actions=readFileSync('app/admin/content-center/translations/groups/actions.ts','utf8')
const page=readFileSync('app/admin/content-center/translations/groups/page.tsx','utf8')
const detail=readFileSync('app/admin/content-center/translations/groups/[resourceType]/[fieldName]/[sourceHash]/[targetLanguage]/page.tsx','utf8')

test('agrupa únicamente por identidad exacta sin normalizar textos comerciales',()=>{
  assert.match(migration,/group by s\.resource_type,s\.field_name,s\.source_hash,s\.target_language/i)
  assert.doesNotMatch(migration,/lower\s*\(.*source|regexp_replace\s*\(.*source/i)
  assert.match(migration,/translation_field_state_exact_group_idx/)
  assert.match(page,/Propuestas exactas agrupadas/)
})

test('la propuesta común produce borradores individuales y nunca publica',()=>{
  assert.match(migration,/workflow_status='draft'/)
  assert.match(migration,/translation_method='libretranslate'/)
  assert.match(migration,/translation_validate_editor_value/)
  assert.doesNotMatch(migration,/translation_publish_draft\s*\(/)
  assert.match(actions,/translation_admin_apply_exact_group_proposal/)
  assert.match(detail,/Revisión humana sensible obligatoria/)
})

test('revalida permisos, fuente, versión, protección y publicación por registro',()=>{
  assert.match(migration,/translation_assert_admin_permission\(current\.resource_type\)/)
  assert.match(migration,/current\.lock_version<>selected\.expected_lock_version/)
  assert.match(migration,/translation_editor_assert_source\(current\)/)
  assert.match(migration,/current\.is_protected or current\.publication_status='published'/)
  assert.match(migration,/order by \(value->>'state_id'\)::uuid/)
  assert.match(migration,/admin_audit_log/)
})

test('las RPC de lectura y mutación tienen privilegios mínimos',()=>{
  assert.match(migration,/translation_admin_exact_group_inventory[\s\S]*auth\.role\(\)<>'service_role'/)
  assert.match(migration,/grant execute on function public\.translation_admin_exact_group_inventory[\s\S]*to service_role/)
  assert.match(migration,/grant execute on function public\.translation_admin_apply_exact_group_proposal[\s\S]*to authenticated/)
  assert.match(migration,/revoke all on function public\.translation_admin_apply_exact_group_proposal[\s\S]*anon,authenticated,service_role/)
})

test('identificadores, códigos y marcas quedan fuera de la generación agrupada',()=>{
  for(const field of ['slug','coupon_code','platform_id','brand','product_name'])assert.equal(isNonTranslatableExactField(field),true)
  for(const field of ['payout_frequency','description','profit_target'])assert.equal(isNonTranslatableExactField(field),false)
  assert.match(actions,/isNonTranslatableExactField/)
  assert.match(migration,/identificador o marca/)
})
