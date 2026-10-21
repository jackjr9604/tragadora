import { SITE_URL } from '@/lib/site-url'

type LanguageEntry = { code: string; isDefault: boolean }

export function publicSeoUrl(path: string, language: string, defaultLanguage: string) {
  const url = new URL(path, SITE_URL)
  if (language !== defaultLanguage) url.searchParams.set('lang', language)
  return url.toString()
}

export function publicSeoLanguageUrls(path: string, languages: LanguageEntry[]) {
  const defaultLanguage = languages.find((item) => item.isDefault)?.code ?? 'es'
  const entries = languages.map((item) => [item.code, publicSeoUrl(path, item.code, defaultLanguage)] as const)
  return {
    defaultLanguage,
    languages: Object.fromEntries([...entries, ['x-default', publicSeoUrl(path, defaultLanguage, defaultLanguage)]]),
  }
}
