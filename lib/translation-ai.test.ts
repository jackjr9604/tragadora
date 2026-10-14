import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { protectAiValue, restoreAndValidateAiValue } from './translation/ai-content'
import { isLocalLibreTranslateUrl, MockLocalTranslationProvider, translateLocally } from './translation/ai-provider'

test('preserva el caso real de encabezado y párrafo sin convertir # ni colapsar saltos', () => {
  const source = '# Profit Split\n\nEl profit split representa qué porcentaje de una ganancia elegible corresponde al trader.'
  const protectedValue = protectAiValue(source)
  const output = [
    protectedValue.value[0],
    protectedValue.value[1]
      .replace('El ', 'The ')
      .replace(' representa qué porcentaje de una ganancia elegible corresponde al trader.', ' represents what percentage of an eligible profit corresponds to the trader.'),
  ]
  assert.equal(restoreAndValidateAiValue(output, protectedValue), '# Profit Split\n\nThe profit split represents what percentage of an eligible profit corresponds to the trader.')
})

test('preserva listas, citas, tablas, enlaces, imágenes, HTML y bloques de código', () => {
  const source = [
    '> Nota importante',
    '',
    '- Primer punto',
    '- [ ] Tarea pendiente',
    '',
    '| Nombre | Estado |',
    '| :--- | ---: |',
    '| FTMO | Activo |',
    '',
    'Consulta [la guía](https://tradagora.com/guia) y ![Logo](https://tradagora.com/logo.png).',
    '',
    '<strong>Atención</strong>',
    '',
    '```ts',
    'const url = "https://tradagora.com"',
    '```',
  ].join('\n')
  const protectedValue = protectAiValue(source)
  const restored = restoreAndValidateAiValue(protectedValue.value, protectedValue)
  assert.equal(restored, source)
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

test('conserva forma y cardinalidad de arrays de campos', () => {
  const protectedValue = protectAiValue(['Profit Split alto', 'Payout rápido'])
  const restored = restoreAndValidateAiValue(protectedValue.value, protectedValue)
  assert.deepEqual(restored, ['Profit Split alto', 'Payout rápido'])
  assert.throws(() => restoreAndValidateAiValue(['solo uno'], protectedValue), /lista incompatible/)
})

test('traduce etiquetas de enlaces e imágenes pero restaura exactamente URLs, código y variables', () => {
  const source = 'Visita [la guía](https://tradagora.com/go/ftmo), usa `npm run build` y ${ACCOUNT_ID}.'
  const protectedValue = protectAiValue(source)
  const output = protectedValue.value.map((value) => value
    .replace('>Visita<', '>Visit<')
    .replace('>la guía<', '>the guide<')
    .replace('>, usa<', '>, use<')
    .replace('>y<', '>and<')
    .replace('>y <span', '>and <span'))
  assert.equal(restoreAndValidateAiValue(output, protectedValue), 'Visit [the guide](https://tradagora.com/go/ftmo), use `npm run build` y ${ACCOUNT_ID}.')
})

test('rechaza estructura Markdown añadida, eliminada o alterada', () => {
  const source = '# Título\n\nTexto normal.'
  const protectedValue = protectAiValue(source)
  const output = [protectedValue.value[0], protectedValue.value[1].replace('>Texto normal.<', '># Altered text.<')]
  assert.throws(() => restoreAndValidateAiValue(output, protectedValue), /estructura Markdown/)
})

test('acepta reserialización HTML inocua del contenedor de fragmento', () => {
  const source = 'Visita https://tradagora.com'
  const protectedValue = protectAiValue(source)
  const serialized = protectedValue.value.map((value) => value.replace(/<div data-trgd-segment="([^"]+)">/, '<div class="translated" data-trgd-segment="$1">'))
  assert.equal(restoreAndValidateAiValue(serialized, protectedValue), source)
})

test('rechaza fragmentos perdidos, duplicados, alterados o con contenido activo', () => {
  const protectedValue = protectAiValue('Visita https://tradagora.com y usa {{code}}')
  const [value] = protectedValue.value
  assert.throws(() => restoreAndValidateAiValue([], protectedValue), /lista incompatible/)
  assert.throws(() => restoreAndValidateAiValue([`${value}${value}`], protectedValue), /alteró, perdió o duplicó/)
  assert.throws(() => restoreAndValidateAiValue([value.replace('data-trgd-segment', 'data-broken-segment')], protectedValue), /alteró, perdió o duplicó/)
  assert.throws(() => restoreAndValidateAiValue([value.replace('</div>', '<script>alert(1)</script></div>')], protectedValue), /contenido inseguro/)
})

test('rechaza marcadores inline perdidos, duplicados o alterados', () => {
  const source = 'Visita https://tradagora.com con {{code}}'
  const protectedValue = protectAiValue(source)
  const [value] = protectedValue.value
  assert.throws(() => restoreAndValidateAiValue([value.replace(/<span[\s\S]*?<\/span>/, '')], protectedValue), /alteró código/)
  assert.throws(() => restoreAndValidateAiValue([value.replace(/(<span[\s\S]*?<\/span>)/, '$1$1')], protectedValue), /alteró código/)
  assert.throws(() => restoreAndValidateAiValue([value.replace('data-trgd-token', 'data-unknown-token')], protectedValue), /alteró código/)
})

test('evita colisiones con texto que ya contiene el namespace de fragmentos', () => {
  const source = 'TRGDSEGMENT: visita https://tradagora.com'
  const protectedValue = protectAiValue(source)
  assert.equal(protectedValue.markerNamespace, 'TRGDSEGMENTX')
  assert.equal(restoreAndValidateAiValue(protectedValue.value, protectedValue), source)
})

test('LibreTranslate recibe HTML para preservar contenedores y nodos translate=no', () => {
  const provider = readFileSync('lib/translation/ai-provider.ts', 'utf8')
  assert.match(provider, /format:\s*'html'/)
  assert.doesNotMatch(provider, /format:\s*'text'/)
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
  const worker = readFileSync('scripts/translation-worker.ts', 'utf8')
  for (const source of [provider, worker]) {
    assert.doesNotMatch(source, /OPENAI_API_KEY|TRANSLATION_PROVIDER|api\.openai\.com|anthropic|deepl/i)
  }
  assert.equal(existsSync('lib/content-translation.ts'), false)
  assert.match(worker, /translation_claim_ai_jobs/)
  assert.match(worker, /translation_complete_ai_job/)
  assert.match(worker, /estimated_cost_usd:\s*0/)
})
