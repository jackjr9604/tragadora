import type { MetadataRoute } from 'next'
import { publicSeoLanguageUrls, publicSeoUrl } from '@/lib/public-seo-policy'

type LanguageEntry = { code: string; isDefault: boolean }

export function publicSitemapEntries(paths: string[], languages: LanguageEntry[]): MetadataRoute.Sitemap {
  const alternates = paths.map((path) => [path, publicSeoLanguageUrls(path, languages)] as const)
  return alternates.flatMap(([path, urls]) => languages.map((language) => ({
    url: publicSeoUrl(path, language.code, urls.defaultLanguage),
    changeFrequency: path === '/' ? 'daily' as const : 'weekly' as const,
    priority: path === '/' ? 1 : 0.8,
    alternates: { languages: urls.languages },
  })))
}
