import { isPublishableTranslationState, type TranslationFieldState, type TranslationLanguage } from './public-platform-translation-policy'

export const offerTranslationFields = ['title', 'description', 'free_account_label', 'hot_badge', 'short_highlight'] as const
export type OfferTranslationField = (typeof offerTranslationFields)[number]

export type OfferSourceText = {
  id: string
  language: string | null
  title: string
  description: string | null
  free_account_label: string | null
  hot_badge: string | null
  short_highlight: string | null
}

export type OfferTranslationRow = {
  offer_id: string
  language: string
  title: string | null
  description: string | null
  free_account_label: string | null
  hot_badge: string | null
  short_highlight: string | null
}

export type ResolvedOfferText = {
  title: string
  description: string | null
  freeAccountLabel: string | null
  hotBadge: string | null
  shortHighlight: string | null
}

export type OfferIdentityRow = {
  platform_id: string; challenge_id: string | null; discount_type: string;
  discount_value: number | string | null; promo_code: string | null; country_code: string | null;
  starts_at: string | null; expires_at: string | null; language: string | null;
  affiliate_link_id?: string | null; includes_free_account?: boolean; is_featured?: boolean;
}

export function selectCanonicalOfferRows<T extends OfferIdentityRow>(rows: T[], requestedLanguage: string, defaultLanguage = 'es') {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const key = [row.platform_id, row.challenge_id, row.affiliate_link_id, row.discount_type, row.discount_value, row.promo_code, row.country_code, row.starts_at, row.expires_at, row.includes_free_account, row.is_featured]
      .map((value) => value ?? '').join('\u001f')
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return [...groups.values()].map((group) =>
    group.find((row) => !row.language)
      ?? group.find((row) => row.language === defaultLanguage)
      ?? group.find((row) => row.language === requestedLanguage)
      ?? group[0]
  )
}

const outputKeys: Record<OfferTranslationField, keyof ResolvedOfferText> = {
  title: 'title', description: 'description', free_account_label: 'freeAccountLabel',
  hot_badge: 'hotBadge', short_highlight: 'shortHighlight',
}

function present(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function resolveOfferTranslations(input: {
  offers: OfferSourceText[]
  requestedLanguage: string
  defaultLanguage: string
  languages: TranslationLanguage[]
  translations: OfferTranslationRow[]
  states: TranslationFieldState[]
}) {
  const language = input.languages.find((item) => item.code === input.requestedLanguage && item.is_active && item.publication_status === 'published')?.code
  const requested = language ?? input.defaultLanguage
  const translationMap = new Map(input.translations.map((row) => [`${row.offer_id}:${row.language}`, row]))
  const stateMap = new Map(input.states.map((row) => [`${row.resource_id}:${row.target_language}:${row.field_name}`, row]))
  const result = new Map<string, ResolvedOfferText>()

  for (const offer of input.offers) {
    const sourceLanguage = input.languages.find((item) => item.code === offer.language && item.is_active)?.code
      ?? input.defaultLanguage
    const resolved: ResolvedOfferText = {
      title: offer.title, description: offer.description, freeAccountLabel: offer.free_account_label,
      hotBadge: offer.hot_badge, shortHighlight: offer.short_highlight,
    }
    if (requested !== sourceLanguage) {
      const translation = translationMap.get(`${offer.id}:${requested}`)
      for (const field of offerTranslationFields) {
        const value = translation?.[field]
        const state = stateMap.get(`${offer.id}:${requested}:${field}`)
        if (present(value) && isPublishableTranslationState(state)) {
          resolved[outputKeys[field]] = value
        }
      }
    }
    result.set(offer.id, resolved)
  }
  return result
}
