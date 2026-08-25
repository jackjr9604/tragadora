import type { SiteLanguage } from '@/lib/site-content'

export type ContentTranslator = (
  sourceText: string,
  sourceLang: SiteLanguage,
  targetLang: SiteLanguage
) => Promise<string>

export async function translateContent(
  sourceText: string,
  sourceLang: SiteLanguage,
  targetLang: SiteLanguage
): Promise<string> {
  void sourceText
  void sourceLang
  void targetLang
  throw new Error('No hay un proveedor de traducción automática configurado.')
}

export const automaticTranslationConfigured = false
