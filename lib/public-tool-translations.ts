import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolveToolTranslations, type ToolSource, type ToolTranslationRow } from './public-tool-translation-policy'
import type { TranslationFieldState, TranslationLanguage } from './public-platform-translation-policy'
import { getPublicTranslationStates } from './public-translation-states'

export async function getPublicToolTranslations(tools: ToolSource[], requestedLanguage: string) {
  if (!tools.length) return new Map()
  const db = createAdminClient()
  const languagesResult = await db.from('languages').select('code, is_active, is_default, publication_status').eq('is_active', true)
  if (languagesResult.error) return new Map()
  const languages = (languagesResult.data ?? []) as TranslationLanguage[]
  const defaultLanguage = languages.find((item) => item.is_default)?.code ?? 'es'
  const effectiveLanguage = languages.find((item) => item.code === requestedLanguage && item.is_active && item.publication_status === 'published')?.code ?? defaultLanguage
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
