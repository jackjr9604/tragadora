import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  PUBLIC_TRANSLATION_CACHE_TAG,
  PUBLIC_TRANSLATION_CACHE_TTL_SECONDS,
  createPublicTranslationRowsLoader,
  normalizePublicTranslationCacheScope,
  publicTranslationCacheKey,
  publicTranslationCacheTags,
  publicTranslationLanguageTag,
  publicTranslationResourceTag,
  type PublicTranslationCacheFactory,
  type PublicTranslationStateRow,
} from './public-translation-cache-policy'

const state = (resourceId: string, language: string): PublicTranslationStateRow => ({
  resource_type: 'blog_post_translation', resource_id: resourceId, field_name: 'title', target_language: language,
  source_hash: 'source', translated_source_hash: 'source', source_revision: 1, translated_revision: 1,
  status: 'reviewed', is_protected: false, publication_status: 'published',
})

test('normaliza idiomas e IDs de forma ordenada y deduplicada', () => {
  const scope = normalizePublicTranslationCacheScope({
    resourceType: 'blog_post_translation', resourceIds: [' b ', 'a', 'b', '', ' a '],
    effectiveLanguage: ' EN ', defaultLanguage: ' ES ',
  })
  assert.deepEqual(scope, {
    resourceType: 'blog_post_translation', resourceIds: ['a', 'b'], effectiveLanguage: 'en', defaultLanguage: 'es',
  })
})

test('conjuntos equivalentes producen la misma clave y separan idioma, tipo y recurso', () => {
  const normalized = (resourceType: 'blog_post_translation' | 'tool_translation', ids: string[], language = 'en') =>
    normalizePublicTranslationCacheScope({ resourceType, resourceIds: ids, effectiveLanguage: language, defaultLanguage: 'es' })
  assert.deepEqual(publicTranslationCacheKey(normalized('blog_post_translation', ['b', 'a', 'a'])), publicTranslationCacheKey(normalized('blog_post_translation', ['a', 'b'])))
  assert.notDeepEqual(publicTranslationCacheKey(normalized('blog_post_translation', ['a'], 'en')), publicTranslationCacheKey(normalized('blog_post_translation', ['a'], 'pt')))
  assert.notDeepEqual(publicTranslationCacheKey(normalized('blog_post_translation', ['a'])), publicTranslationCacheKey(normalized('tool_translation', ['a'])))
  assert.notDeepEqual(publicTranslationCacheKey(normalized('blog_post_translation', ['a'])), publicTranslationCacheKey(normalized('blog_post_translation', ['b'])))
})

test('genera TTL y tags centralizados sin usar los tags como identidad', async () => {
  let captured: { keyParts: string[]; revalidate: number; tags: string[] } | undefined
  const cacheFactory: PublicTranslationCacheFactory = (loader, keyParts, options) => {
    captured = { keyParts, ...options }
    return loader
  }
  const load = createPublicTranslationRowsLoader({
    cacheFactory,
    loadTranslations: async () => [{ title: 'English' }],
    loadStates: async () => [state('a', 'en')],
  })
  await load({ resourceType: 'blog_post_translation', resourceIds: ['a'], effectiveLanguage: 'en', defaultLanguage: 'es' })
  assert.equal(captured?.revalidate, PUBLIC_TRANSLATION_CACHE_TTL_SECONDS)
  assert.deepEqual(captured?.tags, [PUBLIC_TRANSLATION_CACHE_TAG, `${PUBLIC_TRANSLATION_CACHE_TAG}:blog_post_translation`, `${PUBLIC_TRANSLATION_CACHE_TAG}:blog_post_translation:en`])
  assert.ok(captured?.keyParts.some((part) => part === 'ids:["a"]'))
})

test('devuelve solo filas crudas y no aplica políticas ni fallbacks', async () => {
  const translation = { blog_post_id: 'a', language: 'en', title: 'Draft value' }
  const draft = { ...state('a', 'en'), status: 'machine_translated', publication_status: 'unpublished' }
  const load = createPublicTranslationRowsLoader({ cacheFactory: passthroughCache, loadTranslations: async () => [translation], loadStates: async () => [draft] })
  const result = await load({ resourceType: 'blog_post_translation', resourceIds: ['a'], effectiveLanguage: 'en' })
  assert.deepEqual(result, { translations: [translation], states: [draft] })
})

test('aísla llamadas concurrentes por clave', async () => {
  const cacheFactory = fulfilledValueCache()
  const load = createPublicTranslationRowsLoader({
    cacheFactory,
    loadTranslations: async (scope) => [{ id: scope.resourceIds[0], language: scope.effectiveLanguage }],
    loadStates: async (scope) => [state(scope.resourceIds[0], scope.effectiveLanguage)],
  })
  const [english, portuguese, other] = await Promise.all([
    load({ resourceType: 'blog_post_translation', resourceIds: ['a'], effectiveLanguage: 'en' }),
    load({ resourceType: 'blog_post_translation', resourceIds: ['a'], effectiveLanguage: 'pt' }),
    load({ resourceType: 'blog_post_translation', resourceIds: ['b'], effectiveLanguage: 'en' }),
  ])
  assert.deepEqual(english.translations, [{ id: 'a', language: 'en' }])
  assert.deepEqual(portuguese.translations, [{ id: 'a', language: 'pt' }])
  assert.deepEqual(other.translations, [{ id: 'b', language: 'en' }])
})

test('una entrada caliente evita repetir las dos consultas y otras claves permanecen aisladas', async () => {
  let translationQueries = 0, stateQueries = 0
  const load = createPublicTranslationRowsLoader({
    cacheFactory: fulfilledValueCache(),
    loadTranslations: async (scope) => { translationQueries++; return [{ id: scope.resourceIds[0], language: scope.effectiveLanguage }] },
    loadStates: async (scope) => { stateQueries++; return [state(scope.resourceIds[0], scope.effectiveLanguage)] },
  })
  const scope = { resourceType: 'blog_post_translation' as const, resourceIds: ['article-a'], effectiveLanguage: 'en' }
  await load(scope)
  await load({ ...scope, resourceIds: ['article-a', 'article-a'] })
  assert.deepEqual({ translationQueries, stateQueries }, { translationQueries: 1, stateQueries: 1 })
  await load({ ...scope, effectiveLanguage: 'pt' })
  await load({ ...scope, resourceIds: ['article-b'] })
  assert.deepEqual({ translationQueries, stateQueries }, { translationQueries: 3, stateQueries: 3 })
})

test('no consulta ni crea entradas para conjuntos vacíos', async () => {
  let calls = 0
  const load = createPublicTranslationRowsLoader({
    cacheFactory: passthroughCache,
    loadTranslations: async () => { calls++; return [] },
    loadStates: async () => { calls++; return [] },
  })
  assert.deepEqual(await load({ resourceType: 'tool_translation', resourceIds: [], effectiveLanguage: 'en' }), { translations: [], states: [] })
  assert.equal(calls, 0)
})

test('propaga errores y permite reintentar sin cachear un fallback vacío', async () => {
  let calls = 0
  const load = createPublicTranslationRowsLoader({
    cacheFactory: fulfilledValueCache(),
    loadTranslations: async () => {
      calls++
      if (calls === 1) throw new Error('temporary database failure')
      return [{ title: 'Recovered' }]
    },
    loadStates: async () => [state('a', 'en')],
  })
  const scope = { resourceType: 'blog_post_translation' as const, resourceIds: ['a'], effectiveLanguage: 'en' }
  await assert.rejects(load(scope), /temporary database failure/)
  assert.deepEqual((await load(scope)).translations, [{ title: 'Recovered' }])
  assert.equal(calls, 2)
})

test('el adaptador de Next usa unstable_cache y no mantiene mapas globales', () => {
  const source = readFileSync(new URL('public-translation-cache.ts', import.meta.url), 'utf8')
  assert.match(source, /unstable_cache\(loader, keyParts, options\)/)
  assert.match(source, /import 'server-only'/)
  assert.doesNotMatch(source, /new Map|cookies\(|headers\(|createAdminClient|createClient/)
  assert.deepEqual(publicTranslationCacheTags(normalizePublicTranslationCacheScope({ resourceType: 'offer_translation', resourceIds: ['x'], effectiveLanguage: 'pt' })), ['public-translations', 'public-translations:offer_translation', 'public-translations:offer_translation:pt'])
})

test('los tags públicos de invalidación coinciden exactamente con los tags del cargador', () => {
  const scope = normalizePublicTranslationCacheScope({ resourceType: 'blog_post_translation', resourceIds: ['one'], effectiveLanguage: 'EN' })
  assert.equal(publicTranslationResourceTag(scope.resourceType), publicTranslationCacheTags(scope)[1])
  assert.equal(publicTranslationLanguageTag(scope.resourceType, scope.effectiveLanguage), publicTranslationCacheTags(scope)[2])
})

const passthroughCache: PublicTranslationCacheFactory = (loader) => loader

function fulfilledValueCache(): PublicTranslationCacheFactory {
  const values = new Map<string, unknown>()
  const pending = new Map<string, Promise<unknown>>()
  return <Value>(loader: () => Promise<Value>, keyParts: string[]) => async () => {
    const key = JSON.stringify(keyParts)
    if (values.has(key)) return values.get(key) as Value
    if (pending.has(key)) return pending.get(key) as Promise<Value>
    const current = loader().then((value) => { values.set(key, value); pending.delete(key); return value }, (error) => { pending.delete(key); throw error })
    pending.set(key, current)
    return current
  }
}
