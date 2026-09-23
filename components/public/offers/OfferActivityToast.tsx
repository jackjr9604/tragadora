'use client'

import { X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PublicOffer } from '@/lib/public-offers'
import { OfferLogo } from './OfferLogo'
import { PromoCodeButton } from './PromoCodeButton'
import { offerBenefit } from './offer-ui'

const SESSION_COUNT_KEY = 'tradagora_offer_toast_count'
const MAX_TOASTS_PER_SESSION = 3
const VISIBLE_DURATION = process.env.NODE_ENV === 'development' ? 5000 : 6000

export function OfferActivityToast({ offers }: { offers: PublicOffer[] }) {
  const [index, setIndex] = useState(-1)
  const [visible, setVisible] = useState(false)
  const currentIndex = useRef(-1)
  const lastPlatform = useRef<string | null>(null)
  const eligibleOffers = useMemo(() => [...offers].sort((a, b) => {
    const score = (offer: PublicOffer) => {
      if (offer.isFeatured) return 5
      if (offer.promoCode) return 4
      if (offer.includesFreeAccount) return 3
      if (offer.discountValue > 0) return 2
      return 1
    }
    return score(b) - score(a)
  }), [offers])

  useEffect(() => {
    const development = process.env.NODE_ENV === 'development'
    const initialDelay = development ? 3000 : 11000
    const repeatDelay = development ? 10000 : 25000
    const debug = (details: Record<string, unknown>) => {
      if (development) console.debug('[OfferActivityToast]', details)
    }

    const shown = Number(sessionStorage.getItem(SESSION_COUNT_KEY) || 0)
    debug({
      activeOffers: offers.length,
      eligibleOffers: eligibleOffers.length,
      sessionCount: shown,
      mounted: true,
      nextToast: shown < MAX_TOASTS_PER_SESSION && eligibleOffers.length ? initialDelay : null,
    })
    if (!eligibleOffers.length || shown >= MAX_TOASTS_PER_SESSION) return

    let hideTimer: number | undefined
    let nextTimer: number | undefined
    const show = () => {
      const sessionCount = Number(sessionStorage.getItem(SESSION_COUNT_KEY) || 0)
      if (sessionCount >= MAX_TOASTS_PER_SESSION) return

      const candidates = eligibleOffers
        .map((_, candidate) => candidate)
        .filter((candidate) => eligibleOffers[candidate].platform.id !== lastPlatform.current)
      const next = candidates.find((candidate) => candidate > currentIndex.current)
        ?? candidates[0]
        ?? ((currentIndex.current + 1) % eligibleOffers.length)
      currentIndex.current = next
      lastPlatform.current = eligibleOffers[next].platform.id
      setIndex(next)
      setVisible(true)
      const nextCount = sessionCount + 1
      sessionStorage.setItem(SESSION_COUNT_KEY, String(nextCount))
      debug({ sessionCount: nextCount, nextToast: eligibleOffers[next].id })
      window.clearTimeout(hideTimer)
      hideTimer = window.setTimeout(() => setVisible(false), VISIBLE_DURATION)
      if (nextCount < MAX_TOASTS_PER_SESSION) nextTimer = window.setTimeout(show, repeatDelay)
    }
    const initialTimer = window.setTimeout(show, initialDelay)
    return () => {
      window.clearTimeout(initialTimer)
      window.clearTimeout(hideTimer)
      window.clearTimeout(nextTimer)
    }
  }, [eligibleOffers, offers.length])

  if (!visible || index < 0 || !eligibleOffers[index]) return null
  const offer = eligibleOffers[index]
  const benefit = offer.shortHighlight || `${offerBenefit(offer)} activo`
  return (
    <aside
      role="status"
      aria-live="polite"
      style={{ '--offer-toast-duration': `${VISIBLE_DURATION}ms` } as React.CSSProperties}
      className="offer-toast-card group fixed bottom-4 left-3 z-[80] w-[min(360px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-amber-300/20 bg-[#0a1523]/97 p-3.5 shadow-[0_20px_55px_rgba(0,0,0,.38)] backdrop-blur-xl transition-[border-color,background-color,box-shadow] duration-200 hover:border-amber-300/35 hover:bg-[#0c1929] hover:shadow-[0_24px_65px_rgba(0,0,0,.46)] sm:bottom-5 sm:left-5 sm:w-[370px]"
    >
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Cerrar notificación de oferta"
        className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-md bg-transparent text-slate-500 transition-colors hover:bg-white/[.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
      >
        <X className="size-4" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <div className="rounded-[11px] border border-white/8 bg-[#101f31] p-0.5 shadow-inner shadow-black/20">
          <OfferLogo offer={offer} />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <strong className="truncate text-sm font-semibold text-white">{offer.platform.name}</strong>
            {offer.hotBadge ? <span className="rounded-full border border-amber-300/20 bg-amber-300/[.06] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[.12em] text-amber-200/90">{offer.hotBadge}</span> : null}
          </div>
          <p className="mt-1 truncate text-[13px] leading-5 text-slate-300">{offer.isFeatured ? `Oferta destacada · ${benefit}` : benefit}</p>
          <div className="mt-2 flex min-h-8 flex-wrap items-center gap-2">
            {offer.promoCode ? <PromoCodeButton code={offer.promoCode} compact /> : <span className="text-[11px] text-slate-500">Oferta vigente</span>}
            {offer.includesFreeAccount ? <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[.05] px-2.5 py-1 text-[10px] font-medium text-cyan-100/80">+ {offer.freeAccountLabel || 'Cuenta gratis'}</span> : null}
          </div>
        </div>
      </div>

      <span aria-hidden="true" className="offer-toast-progress absolute inset-x-0 bottom-0 h-px origin-left bg-gradient-to-r from-amber-500/35 via-amber-300/80 to-amber-100/45" />
      <style>{`
        @keyframes offer-toast-life {
          0% { opacity: 0; transform: translateY(6px); }
          4% { opacity: 1; transform: translateY(0); }
          96% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(6px); }
        }
        @keyframes offer-toast-progress {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
        .offer-toast-card { animation: offer-toast-life var(--offer-toast-duration) ease-out forwards; }
        .offer-toast-progress { animation: offer-toast-progress var(--offer-toast-duration) linear forwards; }
        @media (prefers-reduced-motion: reduce) {
          .offer-toast-card, .offer-toast-progress { animation: none; }
        }
      `}</style>
    </aside>
  )
}
