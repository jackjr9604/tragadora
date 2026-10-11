import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveOfferTranslations, selectCanonicalOfferRows, type OfferSourceText, type OfferTranslationRow } from './public-offer-translation-policy'
import type { TranslationFieldState } from './public-platform-translation-policy'

const offer: OfferSourceText = { id: 'offer-1', language: 'es', title: 'Título ES', description: 'Descripción ES', free_account_label: 'Cuenta gratis', hot_badge: 'Exclusiva', short_highlight: 'Beneficio ES' }
const en: OfferTranslationRow = { offer_id: offer.id, language: 'en', title: 'EN title', description: 'EN description', free_account_label: 'Free account', hot_badge: 'Exclusive', short_highlight: 'EN benefit' }
const languages = [
  { code: 'es', is_active: true, is_default: true, publication_status: 'published' },
  { code: 'en', is_active: true, is_default: false, publication_status: 'published' },
  { code: 'pt', is_active: true, is_default: false, publication_status: 'published' },
]
const state = (field: string, overrides: Partial<TranslationFieldState> = {}): TranslationFieldState => ({ resource_id: offer.id, field_name: field, target_language: 'en', source_hash: 'new', translated_source_hash: 'new', source_revision: 2, translated_revision: 2, status: 'reviewed', is_protected: true, ...overrides })

test('resuelve los cinco textos sin duplicar la identidad de la oferta', () => {
  const states = Object.keys(en).filter((key) => !['offer_id', 'language'].includes(key)).map((field) => state(field))
  const result = resolveOfferTranslations({ offers: [offer], requestedLanguage: 'en', defaultLanguage: 'es', languages, translations: [en], states })
  assert.equal(result.size, 1)
  assert.deepEqual(result.get(offer.id), { title: 'EN title', description: 'EN description', freeAccountLabel: 'Free account', hotBadge: 'Exclusive', shortHighlight: 'EN benefit' })
})

test('hace fallback por campo y nunca publica stale', () => {
  const result = resolveOfferTranslations({ offers: [offer], requestedLanguage: 'en', defaultLanguage: 'es', languages, translations: [en], states: [state('title'), state('description', { status: 'stale' })] })
  assert.equal(result.get(offer.id)?.title, 'EN title')
  assert.equal(result.get(offer.id)?.description, 'Descripción ES')
  assert.equal(result.get(offer.id)?.hotBadge, 'Exclusiva')
})

test('respeta protección manual y publicación del idioma', () => {
  const imported = state('title', { status: 'imported_unreviewed', is_protected: true, source_revision: 1, translated_revision: 1 })
  assert.equal(resolveOfferTranslations({ offers: [offer], requestedLanguage: 'en', defaultLanguage: 'es', languages, translations: [en], states: [imported] }).get(offer.id)?.title, 'EN title')
  const unpublished = languages.map((item) => item.code === 'en' ? { ...item, publication_status: 'review' } : item)
  assert.equal(resolveOfferTranslations({ offers: [offer], requestedLanguage: 'en', defaultLanguage: 'es', languages: unpublished, translations: [en], states: [imported] }).get(offer.id)?.title, 'Título ES')
})

test('respeta EN o PT como idioma fuente de una oferta legacy', () => {
  const englishSource: OfferSourceText = { ...offer, id: 'offer-en', language: 'en', title: 'Original EN', description: 'Original description' }
  const spanishTranslation: OfferTranslationRow = { offer_id: englishSource.id, language: 'es', title: 'Traducción ES', description: null, free_account_label: null, hot_badge: null, short_highlight: null }
  const spanishState = { ...state('title'), resource_id: englishSource.id, target_language: 'es' }
  assert.equal(resolveOfferTranslations({ offers: [englishSource], requestedLanguage: 'en', defaultLanguage: 'es', languages, translations: [spanishTranslation], states: [spanishState] }).get(englishSource.id)?.title, 'Original EN')
  assert.equal(resolveOfferTranslations({ offers: [englishSource], requestedLanguage: 'es', defaultLanguage: 'es', languages, translations: [spanishTranslation], states: [spanishState] }).get(englishSource.id)?.title, 'Traducción ES')

  const portugueseSource: OfferSourceText = { ...offer, id: 'offer-pt', language: 'pt', title: 'Original PT' }
  assert.equal(resolveOfferTranslations({ offers: [portugueseSource], requestedLanguage: 'pt', defaultLanguage: 'es', languages, translations: [], states: [] }).get(portugueseSource.id)?.title, 'Original PT')
  assert.equal(resolveOfferTranslations({ offers: [portugueseSource], requestedLanguage: 'en', defaultLanguage: 'es', languages, translations: [], states: [] }).get(portugueseSource.id)?.title, 'Original PT')
})

test('colapsa copias lingüísticas legacy sin mezclar promociones comerciales', () => {
  const commercial = { platform_id: 'p1', challenge_id: null, discount_type: 'percentage', discount_value: 20, promo_code: 'SAVE20', country_code: null, starts_at: null, expires_at: null }
  const rows = [
    { ...commercial, id: 'en-copy', language: 'en' },
    { ...commercial, id: 'es-source', language: 'es' },
    { ...commercial, id: 'other', promo_code: 'OTHER', language: 'es' },
  ]
  const selected = selectCanonicalOfferRows(rows, 'en')
  assert.deepEqual(selected.map((row) => row.id), ['es-source', 'other'])
})
