import type { ReactNode } from 'react'
import type { HomePayout } from '@/lib/home-data'
import { LivePayoutTicker } from './LivePayoutTicker'
import { PublicFooter } from './PublicFooter'
import { PublicNavbar } from './PublicNavbar'
import type { PublicLanguage } from '@/lib/public-language'
import { getActivePublicLanguages } from '@/lib/site-content'

export async function PublicPageShell({ payouts, language = 'es', children }: { payouts: HomePayout[]; language?: PublicLanguage; children: ReactNode }) {
  const languages = await getActivePublicLanguages()
  const activeLanguage = languages.some((item) => item.code === language)
    ? language
    : languages.find((item) => item.isDefault)?.code ?? 'es'
  return <main className="min-h-screen overflow-x-clip bg-[#09111f] text-slate-100"><LivePayoutTicker payouts={payouts} /><PublicNavbar language={activeLanguage} languages={languages} /><div className="flex flex-col">{children}</div><PublicFooter language={activeLanguage} /></main>
}
