import assert from 'node:assert/strict'
import { chromium, type Page } from 'playwright'
import { assertLocalE2eEnvironment } from './assert-local-environment'

const baseUrl = 'http://localhost:3001'
const canonicalBaseUrl = 'http://127.0.0.1:3001'
const routes = ['/', '/prop-firms', '/comparador', '/ofertas', '/payouts', '/brokers', '/exchanges', '/herramientas', '/calculadoras', '/comunidades', '/blog', '/giveaway']

async function openPublic(page: Page, path: string, language: 'en' | 'pt') {
  const response = await page.goto(`${baseUrl}${path}?lang=${language}`, { waitUntil: 'networkidle' })
  assert.ok(response && response.status() < 400, `${path} (${language}) respondió ${response?.status()}`)
  assert.equal(await page.locator('main.tradagora-shell').getAttribute('lang'), language)
  assert.equal(await page.locator('html').getAttribute('lang'), language)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, `${path} (${language}) tiene scroll horizontal`)
}

async function main() {
  const safe = assertLocalE2eEnvironment()
  assert.equal(safe.supabaseOrigin, 'http://127.0.0.1:54321')
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    const runtimeErrors: string[] = []
    page.on('pageerror', (error) => runtimeErrors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error') runtimeErrors.push(message.text()) })

    for (const language of ['en', 'pt'] as const) for (const route of routes) await openPublic(page, route, language)

    for (const language of ['es', 'en', 'pt'] as const) {
      const query = language === 'es' ? '' : `?lang=${language}`
      const html = await (await fetch(`${baseUrl}/blog${query}`)).text()
      assert.match(html, new RegExp(`<html[^>]+lang=["']${language}["']`), `HTML inicial no declara ${language}`)
    }

    await page.goto(`${baseUrl}/blog/e2e-review-two?lang=en`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { level: 1, name: 'Approved title en' }).waitFor()
    await page.getByText('Contenido local.').waitFor()
    assert.equal(await page.getAttribute('link[rel="canonical"]', 'href'), `${canonicalBaseUrl}/blog/e2e-review-two?lang=en`)
    assert.equal(await page.getAttribute('link[rel="alternate"][hreflang="es"]', 'href'), `${canonicalBaseUrl}/blog/e2e-review-two`)
    assert.equal(await page.getAttribute('link[rel="alternate"][hreflang="pt"]', 'href'), `${canonicalBaseUrl}/blog/e2e-review-two?lang=pt`)

    await page.goto(`${baseUrl}/blog/e2e-review-two?lang=pt`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { level: 1, name: 'Fuente sintética dos' }).waitFor()
    assert.equal(await page.getByRole('heading', { level: 1, name: 'Approved title en' }).count(), 0)

    await page.goto(`${baseUrl}/blog`, { waitUntil: 'networkidle' })
    await page.getByLabel('Idioma').first().selectOption('en')
    await page.waitForURL(/(?:\?|&)lang=en(?:&|$)/)
    assert.match((await context.cookies()).find((cookie) => cookie.name === 'tradagora_language')?.value ?? '', /^en$/)

    await page.setViewportSize({ width: 390, height: 844 })
    await openPublic(page, '/blog', 'pt')
    assert.deepEqual(runtimeErrors, [])
    console.log('Public multilingual smoke passed: ES/EN/PT routing, published-only fallback, SEO alternates, persistence, desktop and mobile.')
  } finally {
    await browser.close()
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
