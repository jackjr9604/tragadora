import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { protectAiValue, restoreAndValidateAiValue } from './translation/ai-content'
import { isLocalLibreTranslateUrl, MockLocalTranslationProvider, translateLocally } from './translation/ai-provider'

test('el proveedor simulado preserva Markdown, código, URLs, variables y términos técnicos', () => {
  const source = '# Título\n\nVisita [Tradagora](https://tradagora.com/go/ftmo) con `const x = 1` y {{name}}.\n```ts\nconsole.log("CFD")\n```'
  const protectedValue = protectAiValue(source)
  const translated = `${protectedValue.value} translated`
  const restored = restoreAndValidateAiValue(translated, protectedValue)
  assert.equal(typeof restored, 'string')
  assert.match(restored as string, /https:\/\/tradagora\.com\/go\/ftmo/)
  assert.match(restored as string, /`const x = 1`/)
  assert.match(restored as string, /\{\{name\}\}/)
  assert.match(restored as string, /console\.log\("CFD"\)/)
})

test('mock genera un borrador validable con costo cero', async () => {
  const result = await translateLocally({ value: 'Texto con {{name}}', sourceLanguage: 'es', targetLanguage: 'en' }, new MockLocalTranslationProvider(), 1000)
  assert.equal(result.provider, 'mock')
  assert.equal(result.usage.estimatedCostUsd, 0)
  assert.match(result.value as string, /\{\{name\}\}/)
})

test('LibreTranslate solo acepta loopback o redes privadas sin credenciales embebidas', () => {
  assert.equal(isLocalLibreTranslateUrl('http://127.0.0.1:5000'), true)
  assert.equal(isLocalLibreTranslateUrl('http://192.168.1.20:5000'), true)
  assert.equal(isLocalLibreTranslateUrl('https://translate.example.com'), false)
  assert.equal(isLocalLibreTranslateUrl('http://user:pass@localhost:5000'), false)
})

test('conserva forma y cardinalidad de arrays', () => {
  const protectedValue = protectAiValue(['Profit Split alto', 'Payout rápido'])
  const restored = restoreAndValidateAiValue(protectedValue.value, protectedValue)
  assert.deepEqual(restored, ['Profit Split alto', 'Payout rápido'])
  assert.throws(() => restoreAndValidateAiValue(['solo uno'], protectedValue), /lista incompatible/)
})

test('rechaza respuestas que pierden marcadores protegidos', () => {
  const protectedValue = protectAiValue('Visita https://tradagora.com y usa {{code}}')
  assert.throws(() => restoreAndValidateAiValue('Visit the site', protectedValue), /alteró código/)
})

test('la migración guarda borradores y restringe RPC sensibles', () => {
  const sql = readFileSync('supabase/migrations/202610130001_translation_ai_draft_engine.sql', 'utf8')
  assert.match(sql, /create or replace function public\.translation_request_ai_draft/)
  assert.match(sql, /draft_value=p_draft_value/)
  assert.doesNotMatch(sql, /translation_write_value\(/)
  assert.match(sql, /grant execute on function public\.translation_request_ai_draft[\s\S]*to authenticated/)
  assert.match(sql, /grant execute on function public\.translation_complete_ai_job[\s\S]*to service_role/)
  assert.match(sql, /requested_provider='libretranslate'/)
  assert.doesNotMatch(sql, /openai/i)
  assert.match(sql, /estimated_cost_usd=0/)
  assert.match(sql, /grant execute on function public\.translation_claim_ai_jobs\(text,integer,integer\) to service_role/)
  assert.match(sql, /grant execute on function public\.translation_read_ai_job_source\(uuid,text\) to service_role/)
  assert.doesNotMatch(sql, /grant execute on function public\.translation_claim_ai_jobs[^;]+authenticated/)
  assert.doesNotMatch(sql, /grant execute on function public\.translation_read_ai_job_source[^;]+authenticated/)
  assert.match(sql, /revoke execute on function public\.translation_request_regeneration[\s\S]*from authenticated/)
  assert.match(sql, /and lock_version=\(job_row\.metadata->>'expected_lock_version'\)::bigint/)
  const failStart = sql.indexOf('create or replace function public.translation_fail_ai_job')
  const failSql = sql.slice(failStart)
  assert.ok(failSql.indexOf('for update of s') < failSql.indexOf('where id=p_job_id for update'), 'fail debe bloquear state antes de job')
})

test('el motor operativo no contiene proveedores comerciales reactivables por entorno', () => {
  const provider = readFileSync('lib/translation/ai-provider.ts', 'utf8')
  const legacy = readFileSync('lib/content-translation.ts', 'utf8')
  const worker = readFileSync('scripts/translation-worker.ts', 'utf8')
  for (const source of [provider, legacy, worker]) {
    assert.doesNotMatch(source, /OPENAI_API_KEY|TRANSLATION_PROVIDER|api\.openai\.com|anthropic|deepl/i)
  }
  assert.match(worker, /translation_claim_ai_jobs/)
  assert.match(worker, /translation_complete_ai_job/)
  assert.match(worker, /estimated_cost_usd:\s*0/)
})
