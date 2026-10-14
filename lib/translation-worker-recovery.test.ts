import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync('supabase/migrations/202610140004_translation_worker_availability_recovery.sql','utf8')
const worker = readFileSync('scripts/translation-worker.ts','utf8')

test('compatibilidad usa WHERE y las RPC quedan limitadas a service_role', () => {
  assert.match(sql,/update public\.languages[\s\S]*where code is not null/i)
  for (const fn of ['translation_claim_ready_ai_jobs','translation_release_ai_job_provider_unavailable','translation_recover_local_provider_jobs']) {
    assert.match(sql,new RegExp(`revoke all on function public\\.${fn}`,'i'))
    assert.match(sql,new RegExp(`grant execute on function public\\.${fn}[^;]+service_role`,'i'))
  }
})

test('la recuperación exige identidad vigente y no toca protegidos borradores ni publicaciones', () => {
  assert.match(sql,/error_code='local_provider_unavailable'/i)
  assert.match(sql,/s\.source_hash=j\.source_hash and s\.source_revision=j\.source_revision/i)
  assert.match(sql,/s\.lock_version=\(j\.metadata->>'expected_lock_version'\)::bigint/i)
  assert.match(sql,/not s\.is_protected and s\.workflow_status='none' and s\.publication_status<>'published'/i)
  assert.match(sql,/not exists\([\s\S]*active\.status in \('queued','running','retry_wait'\)/i)
})

test('el worker comprueba disponibilidad antes del claim y devuelve outages sin consumir intentos', () => {
  const preparation = worker.indexOf('prepareLocalTranslationWorker')
  const claim = worker.indexOf("translation_claim_ready_ai_jobs")
  assert.ok(preparation>=0&&claim>preparation)
  assert.match(worker,/translation_release_ai_job_provider_unavailable/)
  assert.doesNotMatch(worker,/p_error_code:\s*retry \? 'local_provider_unavailable'/)
})
