import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync('supabase/migrations/202610240001_admin_platform_transactional_writes.sql', 'utf8')
const actions = readFileSync('app/admin/platform-actions.ts', 'utf8')
const precheck = readFileSync('scripts/sql/admin-platform-transactional-writes-precheck.sql', 'utf8')
const postcheck = readFileSync('scripts/sql/admin-platform-transactional-writes-postcheck.sql', 'utf8')

test('RPC transaccionales tienen seguridad y permisos mínimos', () => {
  for (const name of ['admin_save_prop_firm', 'admin_save_broker', 'admin_save_exchange', 'admin_delete_platform']) {
    assert.match(migration, new RegExp(`create or replace function public\\.${name}\\(`))
    assert.match(migration, new RegExp(`revoke all on function public\\.${name}\\([\\s\\S]*?from public,anon,authenticated,service_role`))
    assert.match(migration, new RegExp(`grant execute on function public\\.${name}\\([\\s\\S]*?to authenticated`))
  }
  assert.match(migration, /security definer/)
  assert.match(migration, /set search_path\s*=\s*pg_catalog,\s*public/)
  assert.match(migration, /for update/g)
  assert.doesNotMatch(migration, /translation_jobs\s*\([^)]*insert/i)
})

test('Server Actions solo escriben mediante RPC y revalidan después', () => {
  assert.doesNotMatch(actions, /\.from\(/)
  for (const rpc of ['admin_save_prop_firm', 'admin_save_broker', 'admin_save_exchange', 'admin_delete_platform']) assert.match(actions, new RegExp(`['"]${rpc}['"]`))
  assert.match(actions, /if \(result\.error\)[\s\S]*firstRow\(result\.data\)[\s\S]*finish\(row/)
})

test('precheck y postcheck son estrictamente de lectura', () => {
  for (const sql of [precheck, postcheck]) {
    assert.match(sql, /begin transaction read only/i)
    assert.doesNotMatch(sql, /\b(insert|update|delete|truncate|alter|create|drop)\b/i)
  }
})
