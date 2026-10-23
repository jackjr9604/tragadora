import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolveToolTranslations, type ToolSource, type ToolTranslationRow } from './public-tool-translation-policy'
import type { TranslationFieldState } from './public-platform-translation-policy'
import { getPublicTranslationStates } from './public-translation-states'
import { getPublicTranslationLanguageContext } from './public-translation-languages'

export async function getPublicToolTranslations(tools: ToolSource[], requestedLanguage: string) {
  if (!tools.length) return new Map()
  const db = createAdminClient()
  const { languages, defaultLanguage } = await getPublicTranslationLanguageContext()
  const effectiveLanguage = languages.find((item) => item.code === requestedLanguage)?.code ?? defaultLanguage
  if (effectiveLanguage === defaultLanguage) return new Map()
  const ids = tools.map((tool) => tool.id)
  const [translationsResult, statesResult] = await Promise.all([
    db.from('tool_translations').select('tool_id, language, name, short_description, category_label, badge, price_label, availability, promo_label, seo_title, seo_description').in('tool_id', ids).eq('language', effectiveLanguage),
    getPublicTranslationStates({ resourceTypes: ['tool_translation'], resourceIds: ids, targetLanguages: [effectiveLanguage] }),
  ])
  // Compatibilidad antes de aplicar 3D.2: cualquier ausencia conserva el texto fuente.
  if (translationsResult.error || statesResult.error) return new Map()
  return resolveToolTranslations({ tools, requestedLanguage, defaultLanguage, languages, translations: (translationsResult.data ?? []) as ToolTranslationRow[], states: (statesResult.data ?? []) as TranslationFieldState[] })
}
