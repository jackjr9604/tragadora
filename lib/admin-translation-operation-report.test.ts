import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isConflictReason, summarizeBulkOperation, type BulkOperationReportItem } from './admin-translation-operation-report'

const item = (category:BulkOperationReportItem['category'],stateId:string):BulkOperationReportItem => ({stateId,fieldName:'title',language:'en',outcome:category,category,message:'Mensaje seguro'})

test('el resumen separa éxitos, omitidos, conflictos y errores sin declarar éxito parcial',()=>{
  const summary=summarizeBulkOperation(5,[item('success','1'),item('success','2'),item('skipped','3'),item('conflict','4'),item('error','5')])
  assert.deepEqual(summary,{selected:5,succeeded:2,skipped:1,conflicts:1,errors:1,complete:false})
  assert.equal(summarizeBulkOperation(2,[item('success','1'),item('success','2')]).complete,true)
})

test('solo obsolescencia, versión y concurrencia se clasifican como conflictos',()=>{
  assert.equal(isConflictReason('concurrent_change'),true)
  assert.equal(isConflictReason('source_changed'),true)
  assert.equal(isConflictReason('invalid_version'),true)
  assert.equal(isConflictReason('not_in_review'),false)
})

test('el reporte compartido persiste solo resultados saneados durante la sesión',()=>{
  const component=readFileSync('components/admin/translations/TranslationOperationReport.tsx','utf8')
  assert.match(component,/sessionStorage/)
  assert.match(component,/resultados parciales/)
  assert.match(component,/Seleccionados/)
  assert.match(component,/Conflictos/)
  assert.doesNotMatch(component,/localStorage|last_error|source|draft|content/)
})

test('las operaciones masivas conservan auditoría por elemento y lotes persistentes',()=>{
  const review=readFileSync('supabase/migrations/202610180001_translation_bulk_review_actions.sql','utf8')
  const publication=readFileSync('supabase/migrations/202610180002_translation_bulk_publication_actions.sql','utf8')
  const batches=readFileSync('supabase/migrations/202610160003_translation_bulk_batches.sql','utf8')+readFileSync('supabase/migrations/202610160004_translation_batch_processing.sql','utf8')
  for(const [sql,action] of [[review,'translation.approve'],[review,'translation.reject'],[publication,'translation.publish'],[batches,'translation_batch.create'],[batches,'translation_batch.enqueue']] as const){assert.match(sql,/admin_audit_log/);assert.match(sql,new RegExp(action.replace('.','\\.')))}
})
