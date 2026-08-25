'use client'

import { useState } from 'react'
import type { HomePayout } from '@/lib/home-data'
import { PlatformLogo } from './PlatformLogo'
import { money, relativeDate } from './public-format'

export function LivePayoutTicker({ payouts }: { payouts: HomePayout[] }) {
  const [forceMotion, setForceMotion] = useState(false)
  return (
    <div className="border-b border-cyan-300/10 bg-[#0d1828]">
      <div className="flex h-12 items-center overflow-hidden">
        <span className="z-10 flex h-full shrink-0 items-center gap-2 border-r border-white/10 bg-[#0d1828] px-4 font-mono text-[11px] uppercase tracking-[.2em] text-cyan-300"><span className="size-2 rounded-full bg-cyan-300 shadow-[0_0_12px_#67e8f9]" /> En vivo <button type="button" onClick={() => setForceMotion(true)} className="motion-override rounded border border-cyan-300/30 px-2 py-1 normal-case tracking-normal">Activar movimiento</button></span>
        {payouts.length ? <div className="live-ticker-viewport"><div className={`live-ticker-track ${forceMotion ? 'motion-enabled' : ''}`}>
          {[...payouts, ...payouts].map((payout, index) => <a key={`${payout.id}-${index}`} href={payout.sourceUrl || '/payouts'} target={payout.sourceUrl ? '_blank' : undefined} rel={payout.sourceUrl ? 'noreferrer' : undefined} className="flex items-center gap-3 border-r border-white/8 px-6 text-sm"><span className="hidden sm:block">{payout.platform && <PlatformLogo platform={payout.platform} small />}</span><span className="font-semibold text-white">{payout.platform?.name ?? 'Payout verificado'}</span><span className="font-mono font-bold text-emerald-400">{money.format(payout.amount)}</span><span className="text-xs text-slate-500">{relativeDate(payout.payoutDate)}</span></a>)}
        </div></div> : <p className="px-5 text-xs text-slate-500">La actividad verificada aparecerá aquí.</p>}
      </div>
    </div>
  )
}
