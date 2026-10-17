import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { assertLocalE2eEnvironment } from './assert-local-environment'

const KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'LIBRETRANSLATE_URL',
  'TRANSLATION_LOCAL_QUEUE_ENABLED',
  'PLAYWRIGHT_BROWSERS_PATH',
] as const

function withEnvironment(values: Partial<Record<(typeof KEYS)[number], string>>, run: () => void) {
  const before = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]))
  Object.assign(process.env, values)
  try { run() } finally {
    for (const key of KEYS) {
      if (before[key] === undefined) delete process.env[key]
      else process.env[key] = before[key]
    }
  }
}

test('acepta exclusivamente endpoints locales y un Chromium existente', () => {
  const browsers = mkdtempSync(join(tmpdir(), 'tradagora-playwright-'))
  try {
    withEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-publishable-key-for-tests',
      SUPABASE_SERVICE_ROLE_KEY: 'local-service-role-key-for-tests',
      LIBRETRANSLATE_URL: 'http://localhost:5000',
      TRANSLATION_LOCAL_QUEUE_ENABLED: 'true',
      PLAYWRIGHT_BROWSERS_PATH: browsers,
    }, () => assert.equal(assertLocalE2eEnvironment().supabaseOrigin, 'http://127.0.0.1:54321'))
  } finally { rmSync(browsers, { recursive: true, force: true }) }
})

test('rechaza cualquier Supabase remoto aunque las demas variables sean validas', () => {
  const browsers = mkdtempSync(join(tmpdir(), 'tradagora-playwright-'))
  try {
    withEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-publishable-key-for-tests',
      SUPABASE_SERVICE_ROLE_KEY: 'local-service-role-key-for-tests',
      LIBRETRANSLATE_URL: 'http://localhost:5000',
      TRANSLATION_LOCAL_QUEUE_ENABLED: 'true',
      PLAYWRIGHT_BROWSERS_PATH: browsers,
    }, () => assert.throws(assertLocalE2eEnvironment, /localhost\/loopback/))
  } finally { rmSync(browsers, { recursive: true, force: true }) }
})

test('baseline y SQL destructivo exigen el proyecto E2E local aislado', () => {
  const root = resolve(import.meta.dirname, '..', '..')
  const builder = readFileSync(join(root, 'scripts/e2e/build-local-supabase-baseline.ps1'), 'utf8')
  assert.match(builder, /OutputRoot debe permanecer dentro de scripts\/e2e\/\.local-supabase/)
  assert.match(builder, /tradagora_local_e2e_guard/)
  for (const file of ['translation-bulk-local-e2e.sql', 'translation-bulk-local-recovery.sql']) {
    const sql = readFileSync(join(root, 'scripts/e2e', file), 'utf8')
    assert.match(sql, /to_regclass\('public\.tradagora_local_e2e_guard'\)/)
    assert.match(sql, /ABORTADO: esta prueba solo puede ejecutarse sobre el baseline E2E local/)
  }
})
