import type { ReactNode } from 'react'
import type { HomePayout } from '@/lib/home-data'
import { LivePayoutTicker } from './LivePayoutTicker'
import { PublicFooter } from './PublicFooter'
import { PublicNavbar } from './PublicNavbar'
import type { PublicLanguage } from '@/lib/public-language'

export function PublicPageShell({ payouts, language = 'es', children }: { payouts: HomePayout[]; language?: PublicLanguage; children: ReactNode }) {
  return <main className="min-h-screen overflow-hidden bg-[#09111f] text-slate-100"><LivePayoutTicker payouts={payouts} /><PublicNavbar language={language} /><div className="flex flex-col">{children}</div><PublicFooter /></main>
}
