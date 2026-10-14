import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql=readFileSync('supabase/migrations/202610140005_translation_worker_legacy_connectivity_recovery.sql','utf8')

test('3E.7 legacy recupera solo la firma exacta de conectividad local',()=>{
  assert.match(sql,/j\.requested_provider='libretranslate'/i)
  assert.match(sql,/j\.error_code='local_provider_unavailable'/i)
  assert.match(sql,/j\.error_code='translation_failed' and j\.last_error='fetch failed'/i)
  assert.doesNotMatch(sql,/like\s+'%fetch%'/i)
})

test('conserva todas las protecciones editoriales y de identidad',()=>{
  assert.match(sql,/s\.source_hash=j\.source_hash and s\.source_revision=j\.source_revision/i)
  assert.match(sql,/s\.lock_version=\(j\.metadata->>'expected_lock_version'\)::bigint/i)
  assert.match(sql,/not s\.is_protected and s\.workflow_status='none' and s\.publication_status<>'published'/i)
  assert.match(sql,/active\.status in \('queued','running','retry_wait'\)/i)
  assert.match(sql,/for update of j skip locked/i)
})

test('no contiene patrones que recuperen fallos de validación protegida',()=>{
  assert.doesNotMatch(sql,/Markdown|enlaces|código|variables protegidas/i)
  assert.match(sql,/status='failed'/i)
  assert.match(sql,/revoke all on function public\.translation_recover_local_provider_jobs\(integer\) from public,anon,authenticated/i)
})
