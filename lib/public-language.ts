export type PublicLanguage = string

export type PublicLanguageOption = {
  code: string
  name: string
  nativeName: string
  isDefault: boolean
}

export const PUBLIC_LANGUAGE_COOKIE = 'tradagora_language'
export const PUBLIC_LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function normalizedLanguage(value: string | string[] | undefined) {
  const candidate = (Array.isArray(value) ? value[0] : value)?.trim().toLowerCase()
  return candidate && /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(candidate) ? candidate : null
}

export function languageUrl(currentUrl: string, language: PublicLanguage) {
  const url = new URL(currentUrl)
  url.searchParams.set('lang', language)
  return `${url.pathname}?${url.searchParams.toString()}${url.hash}`
}

export function persistPublicLanguage(language: PublicLanguage) {
  document.cookie = `${PUBLIC_LANGUAGE_COOKIE}=${encodeURIComponent(language)}; Path=/; Max-Age=${PUBLIC_LANGUAGE_COOKIE_MAX_AGE}; SameSite=Lax`
}

export function visibleBrandText(value: string) {
  return value.replace(/Tragadora/gi, 'Tradagora')
}
