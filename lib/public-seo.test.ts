import assert from 'node:assert/strict'
import test from 'node:test'
import { publicSeoLanguageUrls, publicSeoUrl } from './public-seo-policy'

const languages = [
  { code: 'es', isDefault: true },
  { code: 'en', isDefault: false },
  { code: 'pt', isDefault: false },
]

test('canonicaliza el idioma predeterminado sin query y conserva variantes publicadas', () => {
  assert.equal(publicSeoUrl('/blog/demo', 'es', 'es'), 'https://www.tradagora.com/blog/demo')
  assert.equal(publicSeoUrl('/blog/demo', 'en', 'es'), 'https://www.tradagora.com/blog/demo?lang=en')
  assert.deepEqual(publicSeoLanguageUrls('/blog/demo', languages), {
    defaultLanguage: 'es',
    languages: {
      es: 'https://www.tradagora.com/blog/demo',
      en: 'https://www.tradagora.com/blog/demo?lang=en',
      pt: 'https://www.tradagora.com/blog/demo?lang=pt',
      'x-default': 'https://www.tradagora.com/blog/demo',
    },
  })
})

test('respeta un idioma predeterminado dinámico', () => {
  const dynamic = [{ code: 'es', isDefault: false }, { code: 'pt', isDefault: true }]
  assert.equal(publicSeoLanguageUrls('/ofertas', dynamic).languages.pt, 'https://www.tradagora.com/ofertas')
  assert.equal(publicSeoLanguageUrls('/ofertas', dynamic).languages.es, 'https://www.tradagora.com/ofertas?lang=es')
})
