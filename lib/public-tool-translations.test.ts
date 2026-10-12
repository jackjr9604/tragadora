import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveToolTranslations, type ToolSource, type ToolTranslationRow } from './public-tool-translation-policy'
import type { TranslationFieldState } from './public-platform-translation-policy'

const languages = [
  { code: 'es', is_active: true, is_default: true, publication_status: 'published' },
  { code: 'en', is_active: true, is_default: false, publication_status: 'published' },
  { code: 'pt', is_active: true, is_default: false, publication_status: 'published' },
]
const tools: ToolSource[] = [
  { id: 'internal', name: 'Calculadora de drawdown', short_description: 'Calcula riesgo', category: 'risk', badge: 'Propia', price_label: 'Gratis', availability: 'Web', promo_label: null, tool_type: 'internal', is_ours: true },
  { id: 'external', name: 'TradingView', short_description: 'Gráficos', category: 'charts', badge: null, price_label: 'Desde 10 USD', availability: 'Web', promo_label: 'Prueba', tool_type: 'external', is_ours: false },
]
const translations: ToolTranslationRow[] = [
  { tool_id: 'internal', language: 'en', name: 'Drawdown calculator', short_description: 'Calculate risk', category_label: 'Risk', badge: 'Our tool', price_label: 'Free', availability: 'Web', promo_label: null, seo_title: 'Drawdown calculator', seo_description: 'Estimate drawdown' },
  { tool_id: 'external', language: 'en', name: 'Should not replace brand', short_description: 'Charts', category_label: 'Charting', badge: null, price_label: 'From USD 10', availability: 'Web', promo_label: 'Trial', seo_title: 'TradingView charts', seo_description: 'Review TradingView' },
]
const state = (id: string, field: string, overrides: Partial<TranslationFieldState> = {}): TranslationFieldState => ({
  resource_type: 'tool_translation', resource_id: id, field_name: field, target_language: 'en', source_hash: 'same', translated_source_hash: 'same', source_revision: 1, translated_revision: 1, status: 'reviewed', is_protected: true, ...overrides,
})
const states = translations.flatMap((row) => Object.entries(row).filter(([field, value]) => !['tool_id', 'language'].includes(field) && value).map(([field]) => state(row.tool_id, field)))

test('resuelve campos ES/EN/PT y preserva marcas externas', () => {
  const en = resolveToolTranslations({ tools, requestedLanguage: 'en', defaultLanguage: 'es', languages, translations, states })
  assert.equal(en.get('internal')?.name, 'Drawdown calculator')
  assert.equal(en.get('internal')?.category_label, 'Risk')
  assert.equal(en.get('external')?.name, undefined)
  assert.equal(en.get('external')?.short_description, 'Charts')
  assert.equal(resolveToolTranslations({ tools, requestedLanguage: 'es', defaultLanguage: 'es', languages, translations, states }).size, 0)
})

test('rechaza stale, revisiones antiguas e idiomas no publicados', () => {
  const stale = states.map((item) => item.resource_id === 'internal' && item.field_name === 'short_description' ? { ...item, status: 'stale' } : item)
  assert.equal(resolveToolTranslations({ tools, requestedLanguage: 'en', defaultLanguage: 'es', languages, translations, states: stale }).get('internal')?.short_description, undefined)
  const old = states.map((item) => item.resource_id === 'internal' && item.field_name === 'name' ? { ...item, translated_revision: 0 } : item)
  assert.equal(resolveToolTranslations({ tools, requestedLanguage: 'en', defaultLanguage: 'es', languages, translations, states: old }).get('internal')?.name, undefined)
  const unpublished = languages.map((item) => item.code === 'en' ? { ...item, publication_status: 'review' } : item)
  assert.equal(resolveToolTranslations({ tools, requestedLanguage: 'en', defaultLanguage: 'es', languages: unpublished, translations, states }).size, 0)
})

test('solo publica importadas protegidas y vigentes', () => {
  const imported = states.map((item) => item.resource_id === 'internal' && item.field_name === 'name' ? { ...item, status: 'imported_unreviewed' } : item)
  assert.equal(resolveToolTranslations({ tools, requestedLanguage: 'en', defaultLanguage: 'es', languages, translations, states: imported }).get('internal')?.name, 'Drawdown calculator')
  const unprotected = imported.map((item) => item.resource_id === 'internal' && item.field_name === 'name' ? { ...item, is_protected: false } : item)
  assert.equal(resolveToolTranslations({ tools, requestedLanguage: 'en', defaultLanguage: 'es', languages, translations, states: unprotected }).get('internal')?.name, undefined)
})
