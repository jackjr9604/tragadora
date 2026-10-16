import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const migration=readFileSync('supabase/migrations/202610160003_translation_bulk_batches.sql','utf8')
const postgres=readFileSync('scripts/sql/translation-bulk-batches-postgres-test.sql','utf8')

test('3E.8.4A persiste lotes sin crear jobs ni almacenar contenido',()=>{
  assert.match(migration,/create table if not exists public\.translation_batches/i)
  assert.match(migration,/create table if not exists public\.translation_batch_items/i)
  assert.match(migration,/unique\(created_by,idempotency_key\)/i)
  assert.doesNotMatch(migration,/insert into public\.translation_jobs/i)
  for(const forbidden of ['source_value','draft_value','translated_value']){
    const tables=migration.match(/create table if not exists public\.translation_batches[\s\S]*?\n\);[\s\S]*?create table if not exists public\.translation_batch_items[\s\S]*?\n\);/i)?.[0]??''
    assert.doesNotMatch(tables,new RegExp(`\\b${forbidden}\\b`,'i'))
  }
})

test('preview y creacion validan permisos, snapshots, limites y cuotas',()=>{
  assert.match(migration,/translation_admin_bulk_preview/)
  assert.match(migration,/translation_admin_create_batch/)
  assert.match(migration,/translation_assert_admin_permission\(s\.resource_type\)/)
  assert.match(migration,/jsonb_array_length\(p_selection\) not between 1 and 200/)
  assert.match(migration,/p_page_size not between 1 and 100/)
  assert.match(migration,/public\.translation_hash\(source_value\)<>s\.source_hash/)
  assert.match(migration,/s\.lock_version<>p_expected_lock_version/)
  assert.match(migration,/s\.is_protected/)
  assert.match(migration,/s\.publication_status='published'/)
  assert.match(migration,/s\.workflow_status<>'none'/)
  assert.match(migration,/daily_requests_remaining/)
  assert.match(migration,/daily_characters_remaining/)
})

test('RLS y privilegios mantienen las tablas cerradas y RPC autenticadas',()=>{
  assert.match(migration,/alter table public\.translation_batches enable row level security/)
  assert.match(migration,/revoke all on public\.translation_batches,public\.translation_batch_items from public,anon,authenticated/)
  assert.match(migration,/revoke all on function public\.translation_admin_bulk_preview[\s\S]*service_role/)
  assert.match(migration,/grant execute on function public\.translation_admin_bulk_preview[\s\S]*to authenticated/)
  assert.match(postgres,/has_table_privilege\('authenticated'/)
  assert.match(postgres,/Concurrencia creo lotes duplicados/)
})
