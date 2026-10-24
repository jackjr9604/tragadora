import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolveToolTranslations, type ToolSource, type ToolTranslationRow } from './public-tool-translation-policy'
import type { TranslationFieldState } from './public-platform-translation-policy'
import { getPublicTranslationStates } from './public-translation-states'
import { getPublicTranslationLanguageContext } from './public-translation-languages'
import { createPublicTranslationCache, type PublicTranslationStateRow } from './public-translation-cache'

const getCachedToolTranslationRows = createPublicTranslationCache<ToolTranslationRow>({
  async loadTranslations(scope) {
    const result = await createAdminClient().from('tool_translations').select('tool_id, language, name, short_description, category_label, badge, price_label, availability, promo_label, seo_title, seo_description').in('tool_id', [...scope.resourceIds]).eq('language', scope.effectiveLanguage)
    if (result.error) throw result.error
    return (result.data ?? []) as ToolTranslationRow[]
  },
  async loadStates(scope) {
    const result = await getPublicTranslationStates({ resourceTypes: ['tool_translation'], resourceIds: [...scope.resourceIds], targetLanguages: [scope.effectiveLanguage] })
    if (result.error) throw result.error
    return (result.data ?? []) as PublicTranslationStateRow[]
  },
})

export async function getPublicToolTranslations(tools: ToolSource[], requestedLanguage: string) {
  if (!tools.length) return new Map()
  const { languages, defaultLanguage } = await getPublicTranslationLanguageContext()
  const effectiveLanguage = languages.find((item) => item.code === requestedLanguage)?.code ?? defaultLanguage
  if (effectiveLanguage === defaultLanguage) return new Map()
  const ids = tools.map((tool) => tool.id)
  try {
    const rows = await getCachedToolTranslationRows({ resourceType: 'tool_translation', resourceIds: ids, effectiveLanguage, defaultLanguage })
    return resolveToolTranslations({ tools, requestedLanguage, defaultLanguage, languages, translations: [...rows.translations], states: [...rows.states] as TranslationFieldState[] })
  } catch {
    // Fallback outside the cached loader: transient failures are never cached.
    return new Map()
  }
}
