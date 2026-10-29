import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const sql=readFileSync('supabase/migrations/202610290002_translation_initial_load_publication.sql','utf8')
test('publicación temporal reutiliza las tres transiciones y revalida snapshots',()=>{
  for(const fn of ['translation_submit_review','translation_approve_draft','translation_publish_draft','translation_editor_assert_source','translation_validate_editor_value'])assert.match(sql,new RegExp(fn))
  assert.match(sql,/draft_source_hash=s\.source_hash/);assert.match(sql,/draft_source_revision=s\.source_revision/);assert.match(sql,/for update of s skip locked/i)
})
test('solo publica grupos aplicados sin QA destructiva y con actor super_admin',()=>{
  assert.match(sql,/g\.status='applied'/);assert.match(sql,/qa_codes[\s\S]*commercial_sensitive[\s\S]*translation_unchanged/);assert.match(sql,/role='super_admin'/);assert.match(sql,/translation\.initial_load\.publish/)
})
test('la RPC temporal solo es ejecutable por service_role',()=>{
  assert.match(sql,/security definer[\s\S]*set search_path=pg_catalog,public/i);assert.match(sql,/revoke all[\s\S]*public,anon,authenticated,service_role/i);assert.match(sql,/grant execute[\s\S]*to service_role/i)
})
test('los fallos de revalidación se ponen en cuarentena para no bloquear lotes posteriores',()=>{
  const quarantine=readFileSync('supabase/migrations/202610290005_translation_initial_load_inline_quarantine.sql','utf8')
  const runner=readFileSync('scripts/publish-translation-initial-load.ts','utf8')
  assert.match(quarantine,/status='error'/);assert.match(quarantine,/initial_load_publish_revalidation_failed/);assert.match(quarantine,/translation\.initial_load\.publish_skipped/)
  assert.match(quarantine,/quarantined_count/);assert.doesNotMatch(runner,/translation_initial_load_quarantine_publish_failures/);assert.match(runner,/quarantined===0/)
})
