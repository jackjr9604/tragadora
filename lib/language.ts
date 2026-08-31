import 'server-only'

import { cookies } from 'next/headers'
import { getActivePublicLanguages } from '@/lib/site-content'
import { normalizedLanguage, PUBLIC_LANGUAGE_COOKIE, type PublicLanguage } from '@/lib/public-language'

export async function resolvePublicLanguage(value?: string | string[]): Promise<PublicLanguage> {
  const languages = await getActivePublicLanguages()
  const activeCodes = new Set(languages.map((language) => language.code.toLowerCase()))
  const explicit = normalizedLanguage(value)
  if (explicit && activeCodes.has(explicit)) return explicit

  const cookieStore = await cookies()
  const stored = normalizedLanguage(cookieStore.get(PUBLIC_LANGUAGE_COOKIE)?.value)
  if (stored && activeCodes.has(stored)) return stored

  return languages.find((language) => language.isDefault)?.code ?? 'es'
}
