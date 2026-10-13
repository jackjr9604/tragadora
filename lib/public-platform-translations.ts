import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePlatformTranslations, type PlatformTranslation, type PlatformTranslationRow, type TranslationFieldState, type TranslationLanguage } from '@/lib/public-platform-translation-policy'
import { getPublicTranslationStates } from './public-translation-states'

export type { PlatformTranslation } from '@/lib/public-platform-translation-policy'

export async function getPublicPlatformTranslations(platformIds: string[], requestedLanguage: string) {
  const ids = [...new Set(platformIds.filter(Boolean))]
  if (!ids.length) return new Map<string, PlatformTranslation>()
  const db = createAdminClient()
  const languagesResult = await db.from('languages').select('code, is_active, is_default, publication_status').eq('is_active', true)
  if (languagesResult.error) throw new Error(languagesResult.error.message)
  const languages = (languagesResult.data ?? []) as TranslationLanguage[]
  const defaultLanguage = languages.find((item) => item.is_default)?.code ?? 'es'
  const languageOrder = [...new Set([requestedLanguage, defaultLanguage, 'es'])]
  const [translationsResult, statesResult] = await Promise.all([
    db.from('platform_translations').select('platform_id, language, short_description, description, pros, cons, seo_title, seo_description').in('platform_id', ids).in('language', languageOrder),
    getPublicTranslationStates({ resourceTypes: ['platform_translation'], resourceIds: ids, targetLanguages: languageOrder }),
  ])
  const error = translationsResult.error ?? statesResult.error
  if (error) throw new Error(error.message)
  return resolvePlatformTranslations({ platformIds: ids, requestedLanguage, defaultLanguage, languages, translations: (translationsResult.data ?? []) as PlatformTranslationRow[], states: (statesResult.data ?? []) as TranslationFieldState[] })
}
