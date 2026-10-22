import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

import {
  affiliateVisitorHash,
  sanitizeAffiliateCountry,
  sanitizeAffiliateSourcePage,
  trustedProxyIp,
} from './affiliate-tracking'

test('crea un seudónimo diario estable sin conservar la IP', () => {
  const headers = new Headers({
    'x-forwarded-for': '203.0.113.8, 10.0.0.2',
    'user-agent': 'Browser test',
  })
  const request = new Request('https://tradagora.com/go/demo', { headers })
  const secret = 'local-test-secret-with-at-least-32-bytes'
  const first = affiliateVisitorHash(request, secret, new Date('2026-10-21T10:00:00Z'), true)
  const repeated = affiliateVisitorHash(request, secret, new Date('2026-10-21T23:59:00Z'), true)
  const nextDay = affiliateVisitorHash(request, secret, new Date('2026-10-22T00:00:00Z'), true)
  assert.match(first ?? '', /^[0-9a-f]{64}$/)
  assert.equal(first, repeated)
  assert.notEqual(first, nextDay)
  assert.doesNotMatch(first ?? '', /203\.0\.113\.8/)
})

test('omite tracking si falta secreto o una IP válida del proxy', () => {
  const request = new Request('https://tradagora.com/go/demo', {
    headers: { 'x-forwarded-for': 'not-an-ip' },
  })
  assert.equal(affiliateVisitorHash(request, 'x'.repeat(32), new Date(), true), null)
  assert.equal(affiliateVisitorHash(new Request('https://tradagora.com/go/demo'), 'x'.repeat(32), new Date(), true), null)
  assert.equal(affiliateVisitorHash(new Request('https://tradagora.com/go/demo', { headers: { 'x-real-ip': '203.0.113.4' } }), '', new Date(), true), null)
})

test('exige secreto fuerte y proxy Vercel explícitamente confiable', () => {
  const request = new Request('https://tradagora.com/go/demo', {
    headers: { 'x-vercel-forwarded-for': '203.0.113.4' },
  })
  assert.equal(affiliateVisitorHash(request, 'short-secret', new Date(), true), null)
  assert.equal(affiliateVisitorHash(request, 'x'.repeat(32), new Date(), false), null)
  assert.match(affiliateVisitorHash(request, 'x'.repeat(32), new Date(), true) ?? '', /^[0-9a-f]{64}$/)
})

test('acepta como clave HMAC un Base64 que representa 32 bytes aleatorios', () => {
  const request = new Request('https://tradagora.com/go/demo', {
    headers: { 'x-vercel-forwarded-for': '203.0.113.5' },
  })
  const base64Secret = Buffer.alloc(32, 0xa5).toString('base64')
  assert.equal(base64Secret.length, 44)
  assert.match(affiliateVisitorHash(request, base64Secret, new Date(), true) ?? '', /^[0-9a-f]{64}$/)
})

test('normaliza país y sanea referer sin credenciales, query ni fragmento', () => {
  assert.equal(sanitizeAffiliateCountry(' co '), 'CO')
  assert.equal(sanitizeAffiliateCountry('COL'), null)
  assert.equal(sanitizeAffiliateSourcePage('https://user:pass@example.com/path?q=secret#section'), 'https://example.com/path')
  assert.equal(sanitizeAffiliateSourcePage('javascript:alert(1)'), null)
  assert.equal(sanitizeAffiliateSourcePage('not a url'), null)
})

test('solo toma la primera IP válida de encabezados de proxy conocidos', () => {
  assert.equal(trustedProxyIp(new Headers({ 'x-vercel-forwarded-for': '198.51.100.7, 10.0.0.1' }), true), '198.51.100.7')
  assert.equal(trustedProxyIp(new Headers({ 'x-forwarded-for': 'bad, 198.51.100.7' }), true), null)
  assert.equal(trustedProxyIp(new Headers({ 'x-vercel-forwarded-for': '198.51.100.7' }), false), null)
})

test('la ruta usa RPC atómica y nunca bloquea la redirección por tracking', () => {
  const route = readFileSync(new URL('../app/go/[slug]/route.ts', import.meta.url), 'utf8')
  assert.match(route, /rpc\('affiliate_record_click'/)
  assert.doesNotMatch(route, /from\('affiliate_clicks'\)\.insert/)
  assert.match(route, /try\s*\{[\s\S]*affiliate_record_click[\s\S]*\}\s*catch\s*\{[\s\S]*tracking nunca debe impedir/)
  assert.match(route, /return NextResponse\.redirect\(affiliateLink\.url\)/)
})

test('la migración limita, deduplica y restringe la RPC a service_role', () => {
  const sql = readFileSync(new URL('../supabase/migrations/202610210001_affiliate_click_abuse_protection.sql', import.meta.url), 'utf8')
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /interval '30 minutes'/)
  assert.match(sql, /v_rate_count > 60/)
  assert.match(sql, /enable row level security/g)
  assert.match(sql, /revoke all on function[\s\S]*from public, anon, authenticated/)
  assert.match(sql, /grant execute on function[\s\S]*to service_role/)
  assert.match(sql, /revoke insert on public\.affiliate_clicks from public, anon, authenticated, service_role/)
  assert.doesNotMatch(sql, /inet|ip_address/i)
})

test('el postcheck de despliegue es estrictamente de solo lectura', () => {
  const sql = readFileSync(new URL('../scripts/sql/affiliate-click-abuse-postcheck.sql', import.meta.url), 'utf8')
    .replace(/^\s*--.*$/gm, '')
  assert.doesNotMatch(sql, /^\s*(insert|update|delete|merge|truncate|create|alter|drop|grant|revoke|call)\b/im)
  assert.match(sql, /has_function_privilege\('anon'/)
  assert.match(sql, /has_function_privilege\('authenticated'/)
  assert.match(sql, /has_function_privilege\('service_role'/)
})
