import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const actions=readFileSync('app/admin/content-center/translations/bulk-actions.ts','utf8')
const picker=readFileSync('components/admin/translations/TranslationBulkSelection.tsx','utf8')
const list=readFileSync('app/admin/content-center/translations/batches/page.tsx','utf8')
const detail=readFileSync('app/admin/content-center/translations/batches/[batchId]/page.tsx','utf8')
const inventory=readFileSync('app/admin/translations/page.tsx','utf8')

test('selección masiva persiste recursos entre filtros y limita el alcance',()=>{
  assert.match(picker,/sessionStorage/)
  assert.match(picker,/slice\(0,25\)/)
  assert.match(actions,/rows\.length>100/)
  assert.match(inventory,/TranslationBulkCheckbox/)
})

test('preview y creación revalidan permisos y usan exclusivamente las RPC existentes',()=>{
  assert.match(actions,/getCurrentAdminPermissions/)
  assert.match(actions,/updatePermission/)
  for(const rpc of ['translation_admin_bulk_preview','translation_admin_create_batch','translation_admin_enqueue_batch','translation_admin_batch_detail'])assert.match(actions,new RegExp(rpc))
  assert.doesNotMatch(actions,/createAdminClient|service_role|translation_jobs.*(?:insert|update)/i)
  assert.match(actions,/TRANSLATION_LOCAL_QUEUE_ENABLED/)
})

test('lotes y detalle son paginados, enlazan jobs y reanudan con lock_version',()=>{
  assert.match(list,/normalizeBatchPageSize/)
  assert.match(detail,/TranslationBatchResume/)
  assert.match(detail,/content-center\/jobs/)
  assert.match(detail,/safeResult/)
  assert.match(actions,/p_expected_lock_version:lock/)
})

test('la interfaz conserva aprobación humana y no modifica worker ni publicación',()=>{
  const combined=[actions,picker,list,detail].join('\n')
  assert.doesNotMatch(combined,/translation_(?:complete|claim|fail)_ai_job/)
  assert.doesNotMatch(combined,/publication_status\s*[:=]\s*['"]published/)
  assert.match(picker,/No publica contenido/)
})
