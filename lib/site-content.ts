import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { PublicLanguageOption } from '@/lib/public-language'

export type SiteLanguage = string
export type SiteContent = Record<string, string>
export type PageSectionContent = Record<string, string | boolean | number>
export type PageContent = Record<string, PageSectionContent>

export async function getSiteContent(
  language: SiteLanguage = 'es'
): Promise<SiteContent> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('site_content')
    .select('key, value, language')
    .in('language', language === 'es' ? ['global', 'es'] : ['global', 'es', language])

  const rows = data ?? []
  const fallback = rows.filter((row) => row.language === 'es')
  const localized = rows.filter((row) => row.language === language)
  const global = rows.filter((row) => row.language === 'global')

  const content = fallback.reduce<SiteContent>((result, row) => {
    if (row.value?.trim()) result[row.key] = row.value
    return result
  }, {})

  for (const row of localized) {
    if (row.value?.trim()) content[row.key] = row.value
  }

  for (const row of global) {
    if (row.value?.trim()) content[row.key] = row.value
  }

  return content
}

export async function getActivePublicLanguages(): Promise<PublicLanguageOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('languages')
    .select('code, name, native_name, is_default')
    .eq('is_active', true)
    .order('sort_order')
    .order('name')

  if (error || !data?.length) {
    return [
      { code: 'es', name: 'Español', nativeName: 'Español', isDefault: true },
      { code: 'en', name: 'English', nativeName: 'English', isDefault: false },
      { code: 'pt', name: 'Portuguese', nativeName: 'Português', isDefault: false },
    ]
  }

  return data.map((language) => ({
    code: language.code,
    name: language.name,
    nativeName: language.native_name,
    isDefault: language.is_default,
  }))
}

export function contentValue(
  content: SiteContent,
  key: string,
  fallback: string
) {
  return content[key]?.trim() || fallback
}

export async function getPageContent(
  page: string,
  language: SiteLanguage = 'es'
): Promise<PageContent> {
  const content = await getSiteContent(language)
  const pageContent: PageContent = {}

  for (const [key, value] of Object.entries(content)) {
    const [pageName, sectionName, fieldName] = key.split('.')
    if (pageName !== page || !sectionName || !fieldName) continue
    pageContent[sectionName] ??= {}
    pageContent[sectionName][fieldName] = fieldName === 'enabled'
      ? value !== 'false'
      : fieldName === 'order'
        ? Number(value)
        : value
  }

  // Compatibility with keys used by the first Home implementation.
  if (page === 'home') {
    pageContent.hero ??= {}
    pageContent.hero.badge ??= content.home_hero_eyebrow ?? ''
    pageContent.hero.title ??= content.home_hero_title ?? ''
    pageContent.hero.subtitle ??= content.home_hero_description ?? ''
  }

  return pageContent
}

export function pageValue(
  content: PageContent,
  section: string,
  field: string,
  fallback: string
) {
  const value = content[section]?.[field]
  return typeof value === 'string' && value.trim() ? value : fallback
}

export function sectionEnabled(content: PageContent, section: string) {
  return content[section]?.enabled !== false
}
