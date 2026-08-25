export const publicLanguages = ['es', 'en', 'pt'] as const
export type PublicLanguage = typeof publicLanguages[number]

export function resolvePublicLanguage(value: string | string[] | undefined): PublicLanguage {
  const candidate = Array.isArray(value) ? value[0] : value
  return publicLanguages.includes(candidate as PublicLanguage) ? candidate as PublicLanguage : 'es'
}

export function languageUrl(currentUrl: string, language: PublicLanguage) {
  const url = new URL(currentUrl)
  url.searchParams.set('lang', language)
  return `${url.pathname}?${url.searchParams.toString()}${url.hash}`
}
