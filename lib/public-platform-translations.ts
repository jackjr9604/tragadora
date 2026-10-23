import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePlatformTranslations, type PlatformTranslation, type PlatformTranslationRow, type TranslationFieldState } from '@/lib/public-platform-translation-policy'
import { getPublicTranslationStates } from './public-translation-states'
import { getPublicTranslationLanguageContext } from './public-translation-languages'

export type { PlatformTranslation } from '@/lib/public-platform-translation-policy'

export async function getPublicPlatformTranslations(platformIds: string[], requestedLanguage: string) {
  const ids = [...new Set(platformIds.filter(Boolean))]
  if (!ids.length) return new Map<string, PlatformTranslation>()
  const db = createAdminClient()
  const { languages, defaultLanguage } = await getPublicTranslationLanguageContext()
  const effectiveLanguage = languages.some((language) => language.code === requestedLanguage) ? requestedLanguage : defaultLanguage
  const languageOrder = [...new Set([effectiveLanguage, defaultLanguage, 'es'])]
  const [translationsResult, statesResult] = await Promise.all([
    db.from('platform_translations').select('platform_id, language, short_description, description, pros, cons, seo_title, seo_description').in('platform_id', ids).in('language', languageOrder),
    getPublicTranslationStates({ resourceTypes: ['platform_translation'], resourceIds: ids, targetLanguages: languageOrder }),
  ])
  const error = translationsResult.error ?? statesResult.error
  if (error) throw new Error(error.message)
  return resolvePlatformTranslations({ platformIds: ids, requestedLanguage, defaultLanguage, languages, translations: (translationsResult.data ?? []) as PlatformTranslationRow[], states: (statesResult.data ?? []) as TranslationFieldState[] })
}
