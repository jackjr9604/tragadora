import assert from 'node:assert/strict'
import test from 'node:test'
import { publicSitemapEntries } from './public-sitemap-policy'

test('incluye cada ruta en cada idioma y sus hreflang', () => {
  const rows = publicSitemapEntries(['/blog/demo'], [
    { code: 'es', isDefault: true }, { code: 'en', isDefault: false }, { code: 'pt', isDefault: false },
  ])
  assert.equal(rows.length, 3)
  assert.deepEqual(rows.map((row) => row.url), [
    'https://www.tradagora.com/blog/demo',
    'https://www.tradagora.com/blog/demo?lang=en',
    'https://www.tradagora.com/blog/demo?lang=pt',
  ])
  assert.equal(rows[1].alternates?.languages?.es, 'https://www.tradagora.com/blog/demo')
  assert.equal(rows[1].alternates?.languages?.en, 'https://www.tradagora.com/blog/demo?lang=en')
})
