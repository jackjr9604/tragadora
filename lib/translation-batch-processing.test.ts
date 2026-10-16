import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const sql=readFileSync('supabase/migrations/202610160004_translation_batch_processing.sql','utf8')
const pg=readFileSync('scripts/sql/translation-batch-processing-postgres-test.sql','utf8')

test('3E.8.4B encola por porciones sin modificar worker ni workflow',()=>{
  assert.match(sql,/translation_admin_enqueue_batch/)
  assert.match(sql,/p_limit not between 1 and 50/)
  assert.match(sql,/translation_request_ai_draft\(/)
  assert.doesNotMatch(sql,/create or replace function public\.translation_(claim|complete|fail)_ai_job/i)
  assert.doesNotMatch(sql,/update public\.translation_field_state set/i)
})

test('seguimiento persiste jobs, contadores y resultados seguros',()=>{
  assert.match(sql,/add column if not exists result_code text/)
  assert.match(sql,/create trigger translation_batch_job_sync/)
  assert.match(sql,/translation_batch_refresh/)
  assert.doesNotMatch(sql,/last_error/)
  assert.match(sql,/content_validation_failed/)
})

test('RPC paginadas y mutacion quedan autenticadas y helpers cerrados',()=>{
  for(const fn of ['translation_admin_enqueue_batch','translation_admin_batches_inventory','translation_admin_batch_detail']){
    assert.match(sql,new RegExp(`revoke all on function public\\.${fn}[\\s\\S]*service_role`,'i'))
    assert.match(sql,new RegExp(`grant execute on function public\\.${fn}[\\s\\S]*to authenticated`,'i'))
  }
  assert.match(sql,/p_page_size not in \(25,50,100\)/)
  assert.match(pg,/reanudacion no fue idempotente/i)
  assert.match(pg,/cuota consumio elementos pendientes/i)
})
