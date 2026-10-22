import assert from 'node:assert/strict'
import test from 'node:test'

import nextConfig from './next.config'

test('configura encabezados globales de seguridad con CSP solo de reporte', async () => {
  const entries = await nextConfig.headers?.()
  assert.ok(entries?.length)
  assert.equal(entries?.[0]?.source, '/:path*')
  const headers = new Map(entries?.[0]?.headers.map(({ key, value }) => [key, value]))

  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff')
  assert.equal(headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin')
  assert.equal(headers.get('X-Frame-Options'), 'DENY')
  assert.equal(headers.get('Strict-Transport-Security'), 'max-age=31536000')
  assert.match(headers.get('Permissions-Policy') ?? '', /camera=\(\)/)
  assert.match(headers.get('Permissions-Policy') ?? '', /clipboard-write=\(self\)/)

  const csp = headers.get('Content-Security-Policy-Report-Only') ?? ''
  assert.match(csp, /default-src 'self'/)
  assert.match(csp, /frame-ancestors 'none'/)
  assert.match(csp, /object-src 'none'/)
  assert.match(csp, /form-action 'self'/)
  assert.match(csp, /img-src 'self' data: blob: https:/)
  assert.equal(headers.has('Content-Security-Policy'), false)
})

test('no incorpora secretos ni endpoints de servidor a la CSP del navegador', async () => {
  const entries = await nextConfig.headers?.()
  const serialized = JSON.stringify(entries)
  assert.doesNotMatch(serialized, /service_role|ETHERSCAN|LIBRETRANSLATE|SMTP|IMAP/i)
})
