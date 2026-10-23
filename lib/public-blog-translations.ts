import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveBlogTranslations, type BlogSource, type BlogTranslationRow } from './public-blog-translation-policy'
import type { TranslationFieldState } from './public-platform-translation-policy'
import { getPublicTranslationStates } from './public-translation-states'
import { getPublicTranslationLanguageContext } from './public-translation-languages'
import { createPublicTranslationCache, type PublicTranslationStateRow } from './public-translation-cache'

const getCachedBlogTranslationRows = createPublicTranslationCache<BlogTranslationRow>({
  async loadTranslations(scope) {
    const result = await createAdminClient()
      .from('blog_post_translations')
      .select('blog_post_id,language,title,excerpt,body_markdown,category,tags')
      .in('blog_post_id', [...scope.resourceIds])
      .eq('language', scope.effectiveLanguage)
    if (result.error) throw result.error
    return (result.data ?? []) as BlogTranslationRow[]
  },
  async loadStates(scope) {
    const result = await getPublicTranslationStates({
      resourceTypes: ['blog_post_translation'],
      resourceIds: [...scope.resourceIds],
      targetLanguages: [scope.effectiveLanguage],
    })
    if (result.error) throw result.error
    return (result.data ?? []) as PublicTranslationStateRow[]
  },
})

export async function getPublicBlogTranslations(posts: BlogSource[], requestedLanguage: string) {
  if (!posts.length) return new Map()
  const { languages, defaultLanguage } = await getPublicTranslationLanguageContext()
  const effectiveLanguage = languages.find((item) => item.code === requestedLanguage)?.code ?? defaultLanguage
  if (effectiveLanguage === defaultLanguage) return new Map()
  const ids = posts.map((item) => item.id)
  try {
    const rows = await getCachedBlogTranslationRows({ resourceType: 'blog_post_translation', resourceIds: ids, effectiveLanguage, defaultLanguage })
    return resolveBlogTranslations({ posts, requestedLanguage, defaultLanguage, languages, translations: [...rows.translations], states: [...rows.states] as TranslationFieldState[] })
  } catch {
    // El fallback se aplica fuera del cargador: los errores transitorios nunca se cachean como vacío.
    return new Map()
  }
}
