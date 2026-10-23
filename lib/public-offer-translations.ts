import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolveOfferTranslations, type OfferSourceText, type OfferTranslationRow } from './public-offer-translation-policy'
import type { TranslationFieldState } from './public-platform-translation-policy'
import { getPublicTranslationStates } from './public-translation-states'
import { getPublicTranslationLanguageContext } from './public-translation-languages'

export async function getPublicOfferTranslations(offers: OfferSourceText[], requestedLanguage: string) {
  if (!offers.length) return new Map()
  const db = createAdminClient()
  const ids = offers.map((offer) => offer.id)
  const { languages, defaultLanguage } = await getPublicTranslationLanguageContext()
  const [translationsResult, statesResult] = await Promise.all([
    db.from('offer_translations').select('offer_id, language, title, description, free_account_label, hot_badge, short_highlight').in('offer_id', ids),
    getPublicTranslationStates({ resourceTypes: ['offer_translation'], resourceIds: ids }),
  ])
  // Compatibilidad antes de aplicar la migración: nunca rompe las ofertas actuales.
  if (translationsResult.error || statesResult.error) {
    return new Map(offers.map((offer) => [offer.id, { title: offer.title, description: offer.description, freeAccountLabel: offer.free_account_label, hotBadge: offer.hot_badge, shortHighlight: offer.short_highlight }]))
  }
  return resolveOfferTranslations({ offers, requestedLanguage, defaultLanguage, languages, translations: translationsResult.data as OfferTranslationRow[], states: statesResult.data as TranslationFieldState[] })
}
