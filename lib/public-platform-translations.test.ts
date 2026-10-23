import assert from 'node:assert/strict'
import test from 'node:test'
import { isPublishableTranslationState, resolvePlatformTranslations, type PlatformTranslationRow, type TranslationFieldState } from './public-platform-translation-policy'

const base: PlatformTranslationRow = { platform_id: 'p1', language: 'es', short_description: 'Corta ES', description: 'Larga ES', pros: ['Pro ES'], cons: ['Contra ES'], seo_title: 'SEO ES', seo_description: 'SEO desc ES' }
const english: PlatformTranslationRow = { platform_id: 'p1', language: 'en', short_description: 'Short EN', description: 'Long EN', pros: ['Pro EN'], cons: ['Con EN'], seo_title: 'SEO EN', seo_description: 'SEO desc EN' }
const portuguese: PlatformTranslationRow = { platform_id: 'p1', language: 'pt', short_description: 'Curta PT', description: 'Longa PT', pros: ['Pró PT'], cons: ['Contra PT'], seo_title: 'SEO PT', seo_description: 'Descrição SEO PT' }
const languages = [
  { code: 'es', is_active: true, is_default: true, publication_status: 'published' },
  { code: 'en', is_active: true, is_default: false, publication_status: 'published' },
  { code: 'pt', is_active: true, is_default: false, publication_status: 'published' },
]

function state(field: string, overrides: Partial<TranslationFieldState> = {}): TranslationFieldState {
  return { resource_id: 'p1', field_name: field, target_language: 'en', source_hash: 'a', translated_source_hash: 'a', source_revision: 1, translated_revision: 1, status: 'reviewed', is_protected: true, ...overrides }
}

test('resuelve cada campo vigente en el idioma solicitado', () => {
  const states = Object.keys(english).filter((field) => !['platform_id', 'language'].includes(field)).map((field) => state(field))
  const value = resolvePlatformTranslations({ platformIds: ['p1'], requestedLanguage: 'en', defaultLanguage: 'es', languages, translations: [base, english], states }).get('p1')
  assert.equal(value?.shortDescription, 'Short EN')
  assert.equal(value?.description, 'Long EN')
  assert.deepEqual(value?.pros, ['Pro EN'])
  assert.deepEqual(value?.cons, ['Con EN'])
  assert.equal(value?.seoTitle, 'SEO EN')
})

test('resuelve portugués publicado sin condicionales específicos por idioma', () => {
  const states = Object.keys(portuguese)
    .filter((field) => !['platform_id', 'language'].includes(field))
    .map((field) => state(field, { target_language: 'pt' }))
  const value = resolvePlatformTranslations({ platformIds: ['p1'], requestedLanguage: 'pt', defaultLanguage: 'es', languages, translations: [base, portuguese], states }).get('p1')
  assert.equal(value?.shortDescription, 'Curta PT')
  assert.equal(value?.description, 'Longa PT')
  assert.deepEqual(value?.pros, ['Pró PT'])
  assert.deepEqual(value?.cons, ['Contra PT'])
  assert.equal(value?.seoDescription, 'Descrição SEO PT')
})

test('hace fallback por campo cuando falta traducción o está stale', () => {
  const value = resolvePlatformTranslations({ platformIds: ['p1'], requestedLanguage: 'en', defaultLanguage: 'es', languages, translations: [base, english], states: [state('short_description'), state('description', { status: 'stale' })] }).get('p1')
  assert.equal(value?.shortDescription, 'Short EN')
  assert.equal(value?.description, 'Larga ES')
  assert.deepEqual(value?.pros, ['Pro ES'])
})

test('acepta importadas protegidas y rechaza importadas desprotegidas o revisiones antiguas', () => {
  assert.equal(isPublishableTranslationState(state('description', { status: 'imported_unreviewed', is_protected: true })), true)
  assert.equal(isPublishableTranslationState(state('description', { status: 'imported_unreviewed', is_protected: false })), false)
  assert.equal(isPublishableTranslationState(state('description', { translated_revision: 1, source_revision: 2 })), false)
  assert.equal(isPublishableTranslationState(state('description', { translated_source_hash: 'old' })), false)
  assert.equal(isPublishableTranslationState(state('description', { publication_status: 'unpublished' })), false)
  assert.equal(isPublishableTranslationState(state('description', { publication_status: 'published' })), true)
  assert.equal(isPublishableTranslationState(state('description', { status: 'machine_translated', publication_status: 'published' })), false)
})

test('un idioma no publicado o inactivo cae al idioma base', () => {
  const value = resolvePlatformTranslations({ platformIds: ['p1'], requestedLanguage: 'pt', defaultLanguage: 'es', languages: languages.map((item) => item.code === 'pt' ? { ...item, publication_status: 'review' } : item), translations: [base], states: [] }).get('p1')
  assert.equal(value?.description, 'Larga ES')
  const inactive = resolvePlatformTranslations({ platformIds: ['p1'], requestedLanguage: 'pt', defaultLanguage: 'es', languages: languages.map((item) => item.code === 'pt' ? { ...item, is_active: false } : item), translations: [base, portuguese], states: [] }).get('p1')
  assert.equal(inactive?.description, 'Larga ES')
})
