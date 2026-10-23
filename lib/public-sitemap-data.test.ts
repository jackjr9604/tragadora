import assert from 'node:assert/strict'
import test from 'node:test'
import {
  dynamicPublicPathsFromRows,
  resilientPublicSitemapData,
  safeSitemapRows,
  type SitemapPlatformRow,
  type SitemapSlugRow,
} from './public-sitemap-data'
import { publicSitemapEntries } from './public-sitemap-policy'

test('conserva las fuentes correctas cuando una consulta falla', async () => {
  const warnings: string[] = []
  const [platforms, posts, tools] = await Promise.all([
    safeSitemapRows<SitemapPlatformRow>('platforms', async () => ({ data: [{ slug: 'firma-demo', type: 'prop_firm' }], error: null }), { warn: (message) => warnings.push(message) }),
    safeSitemapRows<SitemapSlugRow>('blog_posts', async () => ({ data: null, error: new Error('database unavailable') }), { warn: (message) => warnings.push(message) }),
    safeSitemapRows<SitemapSlugRow>('tools', async () => ({ data: [{ slug: 'drawdown' }], error: null }), { warn: (message) => warnings.push(message) }),
  ])

  assert.deepEqual(dynamicPublicPathsFromRows({ platforms, posts, tools }), [
    '/prop-firms/firma-demo',
    '/payouts/firma-demo',
    '/calculadoras/drawdown',
  ])
  assert.deepEqual(warnings, ['sitemap_source_failed:blog_posts'])
})

test('trata resultados vacíos como válidos y omite registros incompletos o desconocidos', () => {
  assert.deepEqual(dynamicPublicPathsFromRows({
    platforms: [
      { slug: 'broker-demo', type: 'broker' },
      { slug: 'exchange-demo', type: 'exchange' },
      { slug: 'privada', type: 'unknown' },
      { slug: null, type: 'prop_firm' },
    ],
    posts: [],
    tools: [{ slug: 'Ruta Inválida' }],
  }), ['/brokers/broker-demo', '/exchanges/exchange-demo'])
})

test('genera las rutas públicas normales sin duplicarlas', () => {
  assert.deepEqual(dynamicPublicPathsFromRows({
    platforms: [
      { slug: 'firma-demo', type: 'prop_firm' },
      { slug: 'broker-demo', type: 'broker' },
      { slug: 'exchange-demo', type: 'exchange' },
    ],
    posts: [{ slug: 'guia-demo' }, { slug: 'guia-demo' }],
    tools: [{ slug: 'profit-split' }],
  }), [
    '/prop-firms/firma-demo',
    '/payouts/firma-demo',
    '/brokers/broker-demo',
    '/exchanges/exchange-demo',
    '/blog/guia-demo',
    '/calculadoras/profit-split',
  ])
})

test('aísla excepciones y timeouts sin bloquear otras fuentes', async () => {
  const warnings: string[] = []
  const rejected = await safeSitemapRows<SitemapSlugRow>('rejected', async (): Promise<{ data: SitemapSlugRow[] | null; error: unknown }> => {
    throw new Error('connection failed')
  }, { warn: (message) => warnings.push(message) })
  const timedOut = await safeSitemapRows<SitemapSlugRow>('slow', (signal) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve({ data: [{ slug: 'late' }], error: null }), 100)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason)
    }, { once: true })
  }), { timeoutMs: 5, warn: (message) => warnings.push(message) })

  assert.deepEqual(rejected, [])
  assert.deepEqual(timedOut, [])
  assert.deepEqual(warnings, ['sitemap_source_failed:rejected', 'sitemap_source_failed:slow'])
})

test('un timeout no cancela ni elimina los resultados de otras fuentes', async () => {
  const startedAt = Date.now()
  const [platforms, posts, tools] = await Promise.all([
    safeSitemapRows<SitemapPlatformRow>('platforms', async () => ({
      data: [{ slug: 'firma-vigente', type: 'prop_firm' }],
      error: null,
    })),
    safeSitemapRows<SitemapSlugRow>('blog_posts', (signal) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve({ data: [{ slug: 'demasiado-tarde' }], error: null }), 1_000)
      signal.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(signal.reason)
      }, { once: true })
    }), { timeoutMs: 5, warn: () => undefined }),
    safeSitemapRows<SitemapSlugRow>('tools', async () => ({
      data: [{ slug: 'herramienta-vigente' }],
      error: null,
    })),
  ])

  assert.ok(Date.now() - startedAt < 500)
  assert.deepEqual(dynamicPublicPathsFromRows({ platforms, posts, tools }), [
    '/prop-firms/firma-vigente',
    '/payouts/firma-vigente',
    '/calculadoras/herramienta-vigente',
  ])
})

test('un error al inicializar fuentes conserva rutas estáticas e idiomas publicados', async () => {
  const warnings: string[] = []
  const data = await resilientPublicSitemapData({
    staticPaths: ['/', '/blog'],
    loadLanguages: async () => [
      { code: 'es', name: 'Español', nativeName: 'Español', isDefault: true },
      { code: 'en', name: 'English', nativeName: 'English', isDefault: false },
    ],
    loadDynamicPaths: async () => { throw new Error('client initialization failed') },
    warn: (message) => warnings.push(message),
  })
  const rows = publicSitemapEntries(data.paths, data.languages)

  assert.deepEqual(rows.map((row) => row.url), [
    'https://www.tradagora.com/',
    'https://www.tradagora.com/?lang=en',
    'https://www.tradagora.com/blog',
    'https://www.tradagora.com/blog?lang=en',
  ])
  assert.deepEqual(warnings, ['sitemap_dynamic_sources_unavailable'])
})

test('un fallo de idiomas usa solo ES y elimina rutas duplicadas', async () => {
  const data = await resilientPublicSitemapData({
    staticPaths: ['/calculadoras/drawdown'],
    loadLanguages: async () => { throw new Error('languages unavailable') },
    loadDynamicPaths: async () => ['/calculadoras/drawdown'],
    warn: () => undefined,
  })
  const rows = publicSitemapEntries(data.paths, data.languages)

  assert.deepEqual(rows.map((row) => row.url), [
    'https://www.tradagora.com/calculadoras/drawdown',
  ])
  assert.deepEqual(rows[0].alternates?.languages, {
    es: 'https://www.tradagora.com/calculadoras/drawdown',
    'x-default': 'https://www.tradagora.com/calculadoras/drawdown',
  })
})
