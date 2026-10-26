import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolveOfferTranslations, type OfferSourceText, type OfferTranslationRow } from './public-offer-translation-policy'
import type { TranslationFieldState } from './public-platform-translation-policy'
import { createPublicTranslationCache } from './public-translation-cache'
import { getPublicTranslationStates } from './public-translation-states'
import { getPublicTranslationLanguageContext } from './public-translation-languages'

const getCachedOfferTranslationRows = createPublicTranslationCache<OfferTranslationRow>({
  async loadTranslations(scope) {
    const result = await createAdminClient()
      .from('offer_translations')
      .select('offer_id, language, title, description, free_account_label, hot_badge, short_highlight')
      .in('offer_id', scope.resourceIds)
      .eq('language', scope.effectiveLanguage)
    if (result.error) throw result.error
    return (result.data ?? []) as OfferTranslationRow[]
  },
  async loadStates(scope) {
    const result = await getPublicTranslationStates({
      resourceTypes: ['offer_translation'],
      resourceIds: [...scope.resourceIds],
      targetLanguages: [scope.effectiveLanguage],
    })
    if (result.error) throw result.error
    return (result.data ?? []).map((state) => ({ ...state, resource_type: state.resource_type ?? 'offer_translation' }))
  },
})

export async function getPublicOfferTranslations(offers: OfferSourceText[], requestedLanguage: string) {
  if (!offers.length) return new Map()
  const ids = offers.map((offer) => offer.id)
  const { languages, defaultLanguage } = await getPublicTranslationLanguageContext()
  const effectiveLanguage = languages.some((language) => language.code === requestedLanguage)
    ? requestedLanguage
    : defaultLanguage
  try {
    const rows = await getCachedOfferTranslationRows({
      resourceType: 'offer_translation',
      resourceIds: ids,
      effectiveLanguage,
      defaultLanguage,
    })
    return resolveOfferTranslations({
      offers,
      requestedLanguage: effectiveLanguage,
      defaultLanguage,
      languages,
      translations: [...rows.translations],
      states: [...rows.states] as TranslationFieldState[],
    })
  } catch {
    // El fallback se decide fuera del cargador para que un fallo transitorio no
    // se almacene como una respuesta vacía válida durante el TTL.
    return resolveOfferTranslations({ offers, requestedLanguage: defaultLanguage, defaultLanguage, languages, translations: [], states: [] })
  }
}
