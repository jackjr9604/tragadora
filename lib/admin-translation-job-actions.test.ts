import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { translationJobActionEligibility } from './admin-translation-job-actions'

const safe = { error_code: null, error_recoverable: false, error_category: null, lease_expires_at: null, editorial_state_exists: true, editorial_lock_version: 4, workflow_status: 'none', publication_status: 'unpublished', is_protected: false, source_is_current: true }

test('solo ofrece reintento para un terminal recuperable y editorialmente seguro', () => {
  assert.equal(translationJobActionEligibility({ ...safe, status: 'failed', error_recoverable: true, error_category: 'recoverable_connectivity' }).canRetry, true)
  assert.equal(translationJobActionEligibility({ ...safe, status: 'failed', error_code: 'lease_expired', error_category: 'lease_expired' }).canRetry, true)
  assert.equal(translationJobActionEligibility({ ...safe, status: 'cancelled', error_code: 'admin_cancelled' }).canRetry, true)
  assert.equal(translationJobActionEligibility({ ...safe, status: 'failed', error_recoverable: false, error_category: 'protected_content_validation' }).canRetry, false)
  assert.equal(translationJobActionEligibility({ ...safe, status: 'failed', error_recoverable: true, error_category: 'recoverable_connectivity', is_protected: true }).canRetry, false)
})

test('cancelación local respeta estados y lease vigente', () => {
  assert.equal(translationJobActionEligibility({ ...safe, status: 'queued' }).canCancel, true)
  assert.equal(translationJobActionEligibility({ ...safe, status: 'retry_wait' }).canCancel, true)
  assert.equal(translationJobActionEligibility({ ...safe, status: 'running', lease_expires_at: new Date(Date.now() + 60_000).toISOString() }).canCancel, false)
  assert.equal(translationJobActionEligibility({ ...safe, status: 'running', lease_expires_at: new Date(Date.now() - 60_000).toISOString() }).canCancel, true)
  assert.equal(translationJobActionEligibility({ ...safe, status: 'succeeded' }).canCancel, false)
})

test('la migración limita RPC, conserva generaciones y audita sin contenido', () => {
  const sql = readFileSync('supabase/migrations/202610160002_translation_job_admin_actions.sql', 'utf8')
  assert.match(sql, /translation_admin_retry_job/)
  assert.match(sql, /translation_admin_cancel_job/)
  assert.match(sql, /translation_request_ai_draft/)
  assert.match(sql, /translation_assert_admin_permission/)
  assert.match(sql, /admin_audit_log/)
  assert.match(sql, /auth\.role\(\)<>'authenticated'/)
  assert.match(sql, /grant execute[\s\S]*to authenticated/)
  assert.doesNotMatch(sql, /grant execute[\s\S]*to anon/)
})
