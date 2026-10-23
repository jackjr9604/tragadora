import 'server-only'

import { getActivePublicLanguages } from '@/lib/site-content'
import { publicTranslationLanguageContext } from '@/lib/public-translation-languages-policy'

export async function getPublicTranslationLanguageContext() {
  return publicTranslationLanguageContext(await getActivePublicLanguages())
}
