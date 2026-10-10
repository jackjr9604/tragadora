import { Suspense, type ReactNode } from 'react'
import { LivePayoutTicker } from './LivePayoutTicker'
import { PublicFooter } from './PublicFooter'
import { PublicNavbar } from './PublicNavbar'
import type { PublicLanguage } from '@/lib/public-language'
import { getActivePublicLanguages } from '@/lib/site-content'
import { getLatestPayoutTicker } from '@/lib/payout-tracker'
import { getPublicSearchIndex } from '@/lib/public-search'
import { getBranding } from '@/lib/branding'
import { publishablePublicLanguages } from '@/lib/public-i18n'

export async function PublicPageShell({ language = 'es', children }: { language?: PublicLanguage; children: ReactNode }) {
  const [registeredLanguages, searchItems, branding] = await Promise.all([getActivePublicLanguages(), getPublicSearchIndex(), getBranding()])
  const languages = publishablePublicLanguages(registeredLanguages)
  const activeLanguage = languages.some((item) => item.code === language)
    ? language
    : languages.find((item) => item.isDefault)?.code ?? 'es'
  return <main className="tradagora-shell min-h-screen overflow-x-clip bg-[#09111f] text-slate-100"><Suspense fallback={<TickerFallback />}><AsyncTicker language={activeLanguage} /></Suspense><PublicNavbar language={activeLanguage} languages={languages} searchItems={searchItems} desktopLogo={branding.navbar_desktop_logo} mobileLogo={branding.navbar_mobile_logo} /><div className="flex flex-col">{children}</div><PublicFooter language={activeLanguage} logo={branding.footer_logo} /></main>
}

async function AsyncTicker({ language }: { language: PublicLanguage }) {
  const payouts = await getLatestPayoutTicker()
  return <LivePayoutTicker payouts={payouts} language={language} />
}

function TickerFallback() {
  return <div aria-hidden="true" className="h-12 border-b border-amber-300/10 bg-[#07111e]" />
}
