import type { PublicLanguageOption } from '@/lib/public-language'
import type { TranslationLanguage } from '@/lib/public-platform-translation-policy'

export function publicTranslationLanguageContext(registeredLanguages: PublicLanguageOption[]) {
  const languages: TranslationLanguage[] = registeredLanguages.map((language) => ({
    code: language.code,
    is_active: true,
    is_default: language.isDefault,
    publication_status: 'published',
  }))
  const defaultLanguage = languages.find((language) => language.is_default)?.code ?? 'es'
  return { languages, defaultLanguage }
}
