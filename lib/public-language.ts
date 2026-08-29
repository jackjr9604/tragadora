export type PublicLanguage = string

export type PublicLanguageOption = {
  code: string
  name: string
  nativeName: string
  isDefault: boolean
}

export function resolvePublicLanguage(value: string | string[] | undefined): PublicLanguage {
  const candidate = (Array.isArray(value) ? value[0] : value)?.trim().toLowerCase()
  return candidate && /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(candidate)
    ? candidate
    : 'es'
}

export function languageUrl(currentUrl: string, language: PublicLanguage) {
  const url = new URL(currentUrl)
  url.searchParams.set('lang', language)
  return `${url.pathname}?${url.searchParams.toString()}${url.hash}`
}
