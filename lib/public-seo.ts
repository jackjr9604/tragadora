import 'server-only'

import type { Metadata } from 'next'
import { getActivePublicLanguages } from '@/lib/site-content'
import { publicSeoLanguageUrls, publicSeoUrl } from '@/lib/public-seo-policy'

export { publicSeoLanguageUrls, publicSeoUrl } from '@/lib/public-seo-policy'

export async function publicSeoMetadata({ path, language, title, description }: { path: string; language: string; title: string; description?: string | null }): Promise<Metadata> {
  const registered = await getActivePublicLanguages()
  const alternateUrls = publicSeoLanguageUrls(path, registered)
  const canonical = publicSeoUrl(path, language, alternateUrls.defaultLanguage)
  const otherLocales = registered.filter((item) => item.code !== language).map((item) => item.code)
  return {
    title: { absolute: title.includes('Tradagora') ? title : `${title} | Tradagora` },
    description: description || undefined,
    alternates: { canonical, languages: alternateUrls.languages },
    openGraph: {
      type: 'website',
      siteName: 'Tradagora',
      url: canonical,
      title,
      description: description || undefined,
      locale: language,
      alternateLocale: otherLocales,
    },
  }
}
