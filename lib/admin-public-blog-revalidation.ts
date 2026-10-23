import 'server-only'

import { updateTag } from 'next/cache'
import { PUBLIC_BLOG_SOURCE_CACHE_TAG } from './public-blog-cache'
import { publicTranslationLanguageTag, publicTranslationResourceTag } from './public-translation-cache-policy'

const BLOG_RESOURCE_TYPE = 'blog_post_translation' as const

export function invalidatePublicBlogTranslations(language?: string) {
  updateTag(language
    ? publicTranslationLanguageTag(BLOG_RESOURCE_TYPE, language)
    : publicTranslationResourceTag(BLOG_RESOURCE_TYPE))
}

export function invalidatePublicBlogSource() {
  // Invalidar primero la política editorial evita servir una traducción ya stale
  // incluso si una segunda invalidación excepcional fallara tras el commit SQL.
  invalidatePublicBlogTranslations()
  updateTag(PUBLIC_BLOG_SOURCE_CACHE_TAG)
}
