import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveBlogTranslations, type BlogSource, type BlogTranslationRow } from './public-blog-translation-policy'
import type { TranslationFieldState, TranslationLanguage } from './public-platform-translation-policy'
import { getPublicTranslationStates } from './public-translation-states'

export async function getPublicBlogTranslations(posts: BlogSource[], requestedLanguage: string) {
  if (!posts.length) return new Map()
  const db = createAdminClient()
  const languagesResult = await db.from('languages').select('code,is_active,is_default,publication_status').eq('is_active', true)
  if (languagesResult.error) return new Map()
  const languages = (languagesResult.data ?? []) as TranslationLanguage[]
  const defaultLanguage = languages.find((item) => item.is_default)?.code ?? 'es'
  const effectiveLanguage = languages.find((item) => item.code === requestedLanguage && item.is_active && item.publication_status === 'published')?.code ?? defaultLanguage
  if (effectiveLanguage === defaultLanguage) return new Map()
  const ids = posts.map((item) => item.id)
  const [translationsResult, statesResult] = await Promise.all([
    db.from('blog_post_translations').select('blog_post_id,language,title,excerpt,body_markdown,category,tags').in('blog_post_id', ids).eq('language', effectiveLanguage),
    getPublicTranslationStates({ resourceTypes: ['blog_post_translation'], resourceIds: ids, targetLanguages: [effectiveLanguage] }),
  ])
  // Compatibilidad antes de aplicar 3D.5: cualquier ausencia conserva el contenido fuente.
  if (translationsResult.error || statesResult.error) return new Map()
  return resolveBlogTranslations({ posts, requestedLanguage, defaultLanguage, languages, translations: (translationsResult.data ?? []) as BlogTranslationRow[], states: (statesResult.data ?? []) as TranslationFieldState[] })
}
