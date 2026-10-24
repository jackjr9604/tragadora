import 'server-only'

import { updateTag } from 'next/cache'
import { invalidatePublicTranslations } from './admin-public-translation-revalidation'
import { PUBLIC_BLOG_SOURCE_CACHE_TAG } from './public-blog-cache'
export function invalidatePublicBlogTranslations(language?: string) {
  invalidatePublicTranslations('blog_post_translation', language)
}

export function invalidatePublicBlogSource() {
  // Invalidar primero la política editorial evita servir una traducción ya stale
  // incluso si una segunda invalidación excepcional fallara tras el commit SQL.
  invalidatePublicBlogTranslations()
  updateTag(PUBLIC_BLOG_SOURCE_CACHE_TAG)
}
