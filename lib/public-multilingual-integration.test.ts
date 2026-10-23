import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const publicPages = [
  'app/page.tsx', 'app/prop-firms/page.tsx', 'app/prop-firms/[slug]/page.tsx',
  'app/brokers/page.tsx', 'app/brokers/[slug]/page.tsx', 'app/exchanges/page.tsx',
  'app/exchanges/[slug]/page.tsx', 'app/ofertas/page.tsx', 'app/comparador/page.tsx',
  'app/payouts/page.tsx', 'app/payouts/[slug]/page.tsx', 'app/herramientas/page.tsx',
  'app/herramientas/[slug]/page.tsx', 'app/calculadoras/page.tsx',
  'app/calculadoras/[slug]/page.tsx', 'app/comunidades/page.tsx', 'app/blog/page.tsx',
  'app/blog/[slug]/page.tsx', 'app/giveaway/page.tsx',
]

test('todas las rutas públicas resuelven idioma y generan SEO localizado', () => {
  for (const file of publicPages) {
    const source = readFileSync(join(root, file), 'utf8')
    assert.match(source, /resolvePublicLanguage/, `${file} no resuelve el idioma público`)
    assert.match(source, /generateMetadata/, `${file} no genera metadata por idioma`)
  }
})

test('el contenido público declara el idioma resuelto y el selector conserva query y cookie', () => {
  const layout = readFileSync(join(root, 'app/layout.tsx'), 'utf8')
  const proxy = readFileSync(join(root, 'proxy.ts'), 'utf8')
  const shell = readFileSync(join(root, 'components/public/PublicPageShell.tsx'), 'utf8')
  const navbar = readFileSync(join(root, 'components/public/PublicNavbar.tsx'), 'utf8')
  assert.match(layout, /const language = await resolvePublicLanguage\(requestHeaders\.get\(PUBLIC_LANGUAGE_REQUEST_HEADER\)/)
  assert.match(layout, /<html[\s\S]*lang=\{language\}/)
  assert.match(proxy, /requestHeaders\.set\(PUBLIC_LANGUAGE_REQUEST_HEADER, requested\)/)
  assert.match(proxy, /requestHeaders\.delete\(PUBLIC_LANGUAGE_REQUEST_HEADER\)/)
  assert.match(proxy, /hasPublicUiCatalog\(requested\)/)
  assert.match(shell, /<main lang=\{activeLanguage\}/)
  assert.match(navbar, /persistPublicLanguage\(next\)/)
  assert.match(navbar, /languageUrl\(window\.location\.href, next\)/)
})

test('el sitemap incluye rutas dinámicas y variantes lingüísticas publicadas', () => {
  const sitemap = readFileSync(join(root, 'app/sitemap.ts'), 'utf8')
  assert.match(sitemap, /getActivePublicLanguages/)
  assert.match(sitemap, /publicSitemapEntries/)
  for (const table of ['platforms', 'blog_posts', 'tools']) assert.match(sitemap, new RegExp(`from\\('${table}'\\)`))
})

test('un fallo del registro de idiomas no reactiva idiomas secundarios', () => {
  const source = readFileSync(join(root, 'lib/site-content.ts'), 'utf8')
  const fallback = source.match(/const FALLBACK_PUBLIC_LANGUAGES[\s\S]*?\n\]/)?.[0] ?? ''
  assert.match(fallback, /code: 'es'/)
  assert.doesNotMatch(fallback, /code: 'en'|code: 'pt'/)
  assert.match(source, /if \(error\) throw new Error\(error\.message\)/)
  assert.match(source, /catch \{\s*return FALLBACK_PUBLIC_LANGUAGES/)
})
