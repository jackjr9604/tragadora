'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { HomePayout } from '@/lib/home-data'
import { PlatformLogo } from './PlatformLogo'
import { money, relativeDate } from './public-format'
import { getPublicUi, publicLocale, publicPath } from '@/lib/public-i18n'
import type { PublicLanguage } from '@/lib/public-language'

export function LivePayoutTicker({ payouts, language }: { payouts: HomePayout[]; language: PublicLanguage }) {
  const [forceMotion, setForceMotion] = useState(false)
  const t = getPublicUi(language)
  return (
    <div className="border-b border-amber-300/10 bg-[#07111e]">
      <div className="flex h-12 items-center overflow-hidden">
        <span className="z-10 flex h-full shrink-0 items-center gap-2 border-r border-amber-300/15 bg-[#07111e] px-4 font-mono text-[11px] uppercase tracking-[.2em] text-cyan-300"><span className="size-2 rounded-full bg-cyan-300 shadow-[0_0_12px_#67e8f9]" /> {t('payout.live')} <button type="button" onClick={() => setForceMotion(true)} className="motion-override rounded border border-cyan-300/30 px-2 py-1 normal-case tracking-normal">{t('payout.enableMotion')}</button></span>
        {payouts.length ? <div className="live-ticker-viewport"><div className={`live-ticker-track ${forceMotion ? 'motion-enabled' : ''}`}>
          {[...payouts, ...payouts].map((payout, index) => payout.sourceUrl
            ? <a key={`${payout.id}-${index}`} href={payout.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 border-r border-white/8 px-6 text-sm"><TickerContent payout={payout} language={language} /></a>
            : <Link key={`${payout.id}-${index}`} href={publicPath('/payouts', language)} className="flex items-center gap-3 border-r border-white/8 px-6 text-sm"><TickerContent payout={payout} language={language} /></Link>)}
        </div></div> : <p className="px-5 text-xs text-slate-500">{t('payout.activityPlaceholder')}</p>}
      </div>
    </div>
  )
}

function TickerContent({ payout, language }: { payout: HomePayout; language: PublicLanguage }) {
  const t = getPublicUi(language)
  return <><span className="hidden sm:block">{payout.platform && <PlatformLogo platform={payout.platform} small />}</span><span className="font-semibold text-white">{payout.platform?.name ?? t('payout.verifiedItem')}</span><span className="font-mono font-bold text-emerald-400">{money.format(payout.amount)}</span><span className="text-xs text-slate-500">{relativeDate(payout.payoutDate, publicLocale(language))}</span></>
}
