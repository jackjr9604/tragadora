import 'server-only'

import { cookies } from 'next/headers'
import { getActivePublicLanguages } from '@/lib/site-content'
import { choosePublicLanguage, PUBLIC_LANGUAGE_COOKIE, type PublicLanguage } from '@/lib/public-language'
import { publishablePublicLanguages } from '@/lib/public-i18n'

export async function resolvePublicLanguage(value?: string | string[]): Promise<PublicLanguage> {
  const languages = publishablePublicLanguages(await getActivePublicLanguages())
  const cookieStore = await cookies()
  return choosePublicLanguage({
    requested: value,
    stored: cookieStore.get(PUBLIC_LANGUAGE_COOKIE)?.value,
    active: languages.map((language) => language.code),
    defaultLanguage: languages.find((language) => language.isDefault)?.code,
  })
}
