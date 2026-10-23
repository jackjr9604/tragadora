import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { publicTranslationLanguageContext } from './public-translation-languages-policy'

const resolverFiles = [
  'public-platform-translations.ts',
  'public-offer-translations.ts',
  'public-challenge-translations.ts',
  'public-platform-detail-translations.ts',
  'public-tool-translations.ts',
  'public-community-translations.ts',
  'public-giveaway-translations.ts',
  'public-blog-translations.ts',
]

test('adapta ES EN PT del registro público sin perder el idioma predeterminado', () => {
  const context = publicTranslationLanguageContext([
    { code: 'es', name: 'Español', nativeName: 'Español', isDefault: true },
    { code: 'en', name: 'Inglés', nativeName: 'English', isDefault: false },
    { code: 'pt', name: 'Portugués', nativeName: 'Português', isDefault: false },
  ])
  assert.equal(context.defaultLanguage, 'es')
  assert.deepEqual(context.languages.map((language) => language.code), ['es', 'en', 'pt'])
  assert.ok(context.languages.every((language) => language.is_active && language.publication_status === 'published'))
})

test('el fallback seguro del registro conserva únicamente ES', () => {
  const context = publicTranslationLanguageContext([
    { code: 'es', name: 'Español', nativeName: 'Español', isDefault: true },
  ])
  assert.deepEqual(context.languages, [{ code: 'es', is_active: true, is_default: true, publication_status: 'published' }])
  assert.equal(context.defaultLanguage, 'es')
})

test('todos los resolvedores reutilizan el registro cacheado y no consultan languages directamente', () => {
  for (const file of resolverFiles) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.match(source, /getPublicTranslationLanguageContext\(\)/, file)
    assert.doesNotMatch(source, /from\(['"]languages['"]\)/, file)
  }

  const registry = readFileSync(new URL('site-content.ts', import.meta.url), 'utf8')
  assert.match(registry, /\.eq\('is_active', true\)/)
  assert.match(registry, /\.eq\('publication_status', 'published'\)/)
  assert.match(registry, /\.eq\('ui_catalog_available', true\)/)
  assert.match(registry, /if \(error\) throw new Error\(error\.message\)/)
  assert.match(registry, /const getCachedActivePublicLanguages = unstable_cache\(/)
  assert.match(registry, /return await getCachedActivePublicLanguages\(\)/)
  assert.match(registry, /catch \{\s*return FALLBACK_PUBLIC_LANGUAGES/)
  assert.match(registry, /\['public-languages-v1'\]/)
  assert.match(registry, /revalidate: 300/)
})

test('todas las mutaciones administrativas invalidan el registro solo después de una RPC exitosa', () => {
  const actions = readFileSync(new URL('../app/admin/content-center/language-actions.ts', import.meta.url), 'utf8')
  for (const rpc of ['translation_admin_create_language', 'translation_admin_update_language', 'translation_admin_set_language_state', 'translation_admin_delete_language']) {
    assert.match(actions, new RegExp(`rpc\\('${rpc}'`))
  }
  const errorGuard = actions.indexOf('if(result.error)return fail')
  const invalidation = actions.indexOf("updateTag('public-languages')")
  assert.ok(errorGuard >= 0 && invalidation > errorGuard)
})
