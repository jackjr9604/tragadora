import {
  isPublishableTranslationState,
  type TranslationFieldState,
  type TranslationLanguage,
} from './public-platform-translation-policy'

export type BrokerDetailTranslation = { regulationSummary: string | null }
export type ExchangeDetailTranslation = { productSummary: string | null; regulationSummary: string | null }

export type PlatformDetailTranslationRow = {
  resource_type: 'broker_detail_translation' | 'exchange_detail_translation'
  platform_id: string
  language: string
  product_summary?: string | null
  regulation_summary: string | null
}

export function resolvePlatformDetailTranslations(input: {
  platformIds: string[]
  requestedLanguage: string
  defaultLanguage: string
  languages: TranslationLanguage[]
  translations: PlatformDetailTranslationRow[]
  states: TranslationFieldState[]
}) {
  const published = new Set(input.languages
    .filter((language) => language.is_active && language.publication_status === 'published')
    .map((language) => language.code))
  const language = published.has(input.requestedLanguage) ? input.requestedLanguage : input.defaultLanguage
  const rows = new Map(input.translations.map((row) => [
    `${row.resource_type}:${row.platform_id}:${row.language}`,
    row,
  ]))
  const states = new Map(input.states.map((state) => [
    `${state.resource_type ?? ''}:${state.resource_id}:${state.target_language}:${state.field_name}`,
    state,
  ]))
  const brokers = new Map<string, BrokerDetailTranslation>()
  const exchanges = new Map<string, ExchangeDetailTranslation>()

  for (const platformId of input.platformIds) {
    const broker = rows.get(`broker_detail_translation:${platformId}:${language}`)
    const exchange = rows.get(`exchange_detail_translation:${platformId}:${language}`)
    brokers.set(platformId, {
      regulationSummary: resolveField(broker?.regulation_summary, states.get(`broker_detail_translation:${platformId}:${language}:regulation_summary`), language, input.defaultLanguage),
    })
    exchanges.set(platformId, {
      productSummary: resolveField(exchange?.product_summary, states.get(`exchange_detail_translation:${platformId}:${language}:product_summary`), language, input.defaultLanguage),
      regulationSummary: resolveField(exchange?.regulation_summary, states.get(`exchange_detail_translation:${platformId}:${language}:regulation_summary`), language, input.defaultLanguage),
    })
  }
  return { brokers, exchanges }
}

function resolveField(value: string | null | undefined, state: TranslationFieldState | undefined, language: string, defaultLanguage: string) {
  if (language === defaultLanguage || typeof value !== 'string' || !value.trim()) return null
  return isPublishableTranslationState(state) ? value.trim() : null
}
