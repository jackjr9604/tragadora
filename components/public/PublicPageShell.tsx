import { Suspense, type ReactNode } from 'react'
import { LivePayoutTicker } from './LivePayoutTicker'
import { PublicFooter } from './PublicFooter'
import { PublicNavbar } from './PublicNavbar'
import type { PublicLanguage } from '@/lib/public-language'
import { getActivePublicLanguages } from '@/lib/site-content'
import { getLatestPayoutTicker } from '@/lib/payout-tracker'
import { getPublicSearchIndex } from '@/lib/public-search'

export async function PublicPageShell({ language = 'es', children }: { language?: PublicLanguage; children: ReactNode }) {
  const [languages, searchItems] = await Promise.all([getActivePublicLanguages(), getPublicSearchIndex()])
  const activeLanguage = languages.some((item) => item.code === language)
    ? language
    : languages.find((item) => item.isDefault)?.code ?? 'es'
  return <main className="tradagora-shell min-h-screen overflow-x-clip bg-[#09111f] text-slate-100"><Suspense fallback={<TickerFallback />}><AsyncTicker /></Suspense><PublicNavbar language={activeLanguage} languages={languages} searchItems={searchItems} /><div className="flex flex-col">{children}</div><PublicFooter language={activeLanguage} /></main>
}

async function AsyncTicker() {
  const payouts = await getLatestPayoutTicker()
  return <LivePayoutTicker payouts={payouts} />
}

function TickerFallback() {
  return <div aria-hidden="true" className="h-12 border-b border-amber-300/10 bg-[#07111e]" />
}
