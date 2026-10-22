import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./route.ts', import.meta.url), 'utf8')

test('GET está deshabilitado sin consultar Etherscan ni Supabase', () => {
  const getHandler = source.slice(
    source.indexOf('export async function GET'),
    source.indexOf('/*\n * POST')
  )
  assert.match(getHandler, /status:\s*405/)
  assert.match(getHandler, /Allow:\s*'POST'/)
  assert.doesNotMatch(getHandler, /fetch\(|createAdminClient|getFundingPipsPayouts/)
})

test('POST rechaza acceso anónimo o inválido antes de acceder a servicios', () => {
  const authorization = source.indexOf("request.headers.get('authorization')")
  const rejection = source.indexOf("error: 'Unauthorized'")
  const adminClient = source.indexOf('createAdminClient()', rejection)
  const externalCall = source.indexOf('getFundingPipsPayouts(', rejection)
  assert.ok(authorization >= 0)
  assert.ok(rejection > authorization)
  assert.ok(adminClient > rejection)
  assert.ok(externalCall > rejection)
  assert.match(source, /!process\.env\.CRON_SECRET\s*\|\|\s*authorization\s*!==\s*expected/)
})

test('la sincronización autorizada conserva timeout y errores públicos saneados', () => {
  const publicErrorResponse = source.slice(
    source.indexOf('function errorResponse'),
    source.indexOf('function getErrorMessage')
  )
  assert.match(source, /AbortSignal\.timeout\(\s*ETHERSCAN_TIMEOUT_MS\s*\)/)
  assert.match(publicErrorResponse, /No fue posible completar la sincronización\./)
  assert.doesNotMatch(publicErrorResponse, /getErrorMessage/)
})
