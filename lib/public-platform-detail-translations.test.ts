import assert from 'node:assert/strict'
import test from 'node:test'
import { resolvePlatformDetailTranslations, type PlatformDetailTranslationRow } from './public-platform-detail-translation-policy'
import type { TranslationFieldState } from './public-platform-translation-policy'

const languages = [
  { code: 'es', is_active: true, is_default: true, publication_status: 'published' },
  { code: 'en', is_active: true, is_default: false, publication_status: 'published' },
  { code: 'pt', is_active: true, is_default: false, publication_status: 'published' },
]
const translations: PlatformDetailTranslationRow[] = [
  { resource_type: 'broker_detail_translation', platform_id: 'broker-1', language: 'en', regulation_summary: 'Regulated in two jurisdictions' },
  { resource_type: 'exchange_detail_translation', platform_id: 'exchange-1', language: 'en', product_summary: 'Spot and futures', regulation_summary: 'Licensed exchange' },
  { resource_type: 'broker_detail_translation', platform_id: 'broker-1', language: 'pt', regulation_summary: 'Regulado em duas jurisdições' },
]
const state = (resourceType: string, resourceId: string, field: string, language = 'en', overrides: Partial<TranslationFieldState> = {}): TranslationFieldState => ({
  resource_type: resourceType, resource_id: resourceId, field_name: field, target_language: language,
  source_hash: 'current', translated_source_hash: 'current', source_revision: 2, translated_revision: 2,
  status: 'reviewed', is_protected: true, ...overrides,
})
const states = [
  state('broker_detail_translation', 'broker-1', 'regulation_summary'),
  state('exchange_detail_translation', 'exchange-1', 'product_summary'),
  state('exchange_detail_translation', 'exchange-1', 'regulation_summary'),
  state('broker_detail_translation', 'broker-1', 'regulation_summary', 'pt'),
]

test('resuelve ES/EN/PT por campo sin mezclar recursos', () => {
  const en = resolvePlatformDetailTranslations({ platformIds: ['broker-1', 'exchange-1'], requestedLanguage: 'en', defaultLanguage: 'es', languages, translations, states })
  assert.equal(en.brokers.get('broker-1')?.regulationSummary, 'Regulated in two jurisdictions')
  assert.equal(en.exchanges.get('exchange-1')?.productSummary, 'Spot and futures')
  assert.equal(en.exchanges.get('broker-1')?.productSummary, null)
  const pt = resolvePlatformDetailTranslations({ platformIds: ['broker-1'], requestedLanguage: 'pt', defaultLanguage: 'es', languages, translations, states })
  assert.equal(pt.brokers.get('broker-1')?.regulationSummary, 'Regulado em duas jurisdições')
})

test('rechaza stale, revisiones antiguas e idiomas no publicados con fallback nulo', () => {
  const stale = states.map((item) => item.resource_type === 'exchange_detail_translation' && item.field_name === 'product_summary' ? { ...item, status: 'stale' } : item)
  const result = resolvePlatformDetailTranslations({ platformIds: ['exchange-1'], requestedLanguage: 'en', defaultLanguage: 'es', languages, translations, states: stale })
  assert.equal(result.exchanges.get('exchange-1')?.productSummary, null)
  assert.equal(result.exchanges.get('exchange-1')?.regulationSummary, 'Licensed exchange')
  const old = states.map((item) => item.resource_type === 'broker_detail_translation' && item.target_language === 'en' ? { ...item, translated_revision: 1 } : item)
  assert.equal(resolvePlatformDetailTranslations({ platformIds: ['broker-1'], requestedLanguage: 'en', defaultLanguage: 'es', languages, translations, states: old }).brokers.get('broker-1')?.regulationSummary, null)
  const unpublished = languages.map((item) => item.code === 'en' ? { ...item, publication_status: 'review' } : item)
  assert.equal(resolvePlatformDetailTranslations({ platformIds: ['broker-1'], requestedLanguage: 'en', defaultLanguage: 'es', languages: unpublished, translations, states }).brokers.get('broker-1')?.regulationSummary, null)
})

test('acepta importadas solo cuando están protegidas y vigentes', () => {
  const imported = states.map((item) => item.resource_type === 'broker_detail_translation' && item.target_language === 'en' ? { ...item, status: 'imported_unreviewed' } : item)
  assert.equal(resolvePlatformDetailTranslations({ platformIds: ['broker-1'], requestedLanguage: 'en', defaultLanguage: 'es', languages, translations, states: imported }).brokers.get('broker-1')?.regulationSummary, 'Regulated in two jurisdictions')
  const unprotected = imported.map((item) => item.resource_type === 'broker_detail_translation' && item.target_language === 'en' ? { ...item, is_protected: false } : item)
  assert.equal(resolvePlatformDetailTranslations({ platformIds: ['broker-1'], requestedLanguage: 'en', defaultLanguage: 'es', languages, translations, states: unprotected }).brokers.get('broker-1')?.regulationSummary, null)
})
