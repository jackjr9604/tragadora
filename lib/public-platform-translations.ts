import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePlatformTranslations, type PlatformTranslation, type PlatformTranslationRow, type TranslationFieldState } from '@/lib/public-platform-translation-policy'
import { getPublicTranslationStates } from './public-translation-states'
import { getPublicTranslationLanguageContext } from './public-translation-languages'
import { createPublicTranslationCache, type PublicTranslationStateRow } from './public-translation-cache'

export type { PlatformTranslation } from '@/lib/public-platform-translation-policy'

const getCachedPlatformTranslationRows = createPublicTranslationCache<PlatformTranslationRow>({
  async loadTranslations(scope) {
    const languageOrder = [...new Set([scope.effectiveLanguage, scope.defaultLanguage, 'es'].filter(Boolean) as string[])]
    const result = await createAdminClient().from('platform_translations').select('platform_id, language, short_description, description, pros, cons, seo_title, seo_description').in('platform_id', [...scope.resourceIds]).in('language', languageOrder)
    if (result.error) throw result.error
    return (result.data ?? []) as PlatformTranslationRow[]
  },
  async loadStates(scope) {
    const languageOrder = [...new Set([scope.effectiveLanguage, scope.defaultLanguage, 'es'].filter(Boolean) as string[])]
    const result = await getPublicTranslationStates({ resourceTypes: ['platform_translation'], resourceIds: [...scope.resourceIds], targetLanguages: languageOrder })
    if (result.error) throw result.error
    return (result.data ?? []) as PublicTranslationStateRow[]
  },
})

export async function getPublicPlatformTranslations(platformIds: string[], requestedLanguage: string) {
  const ids = [...new Set(platformIds.filter(Boolean))]
  if (!ids.length) return new Map<string, PlatformTranslation>()
  const { languages, defaultLanguage } = await getPublicTranslationLanguageContext()
  const effectiveLanguage = languages.some((language) => language.code === requestedLanguage) ? requestedLanguage : defaultLanguage
  try {
    const rows = await getCachedPlatformTranslationRows({ resourceType: 'platform_translation', resourceIds: ids, effectiveLanguage, defaultLanguage })
    return resolvePlatformTranslations({ platformIds: ids, requestedLanguage, defaultLanguage, languages, translations: [...rows.translations], states: [...rows.states] as TranslationFieldState[] })
  } catch {
    return new Map(ids.map((id) => [id, { shortDescription: null, description: null, pros: [], cons: [], seoTitle: null, seoDescription: null }]))
  }
}
