import Link from 'next/link'
import { ArrowUpRight, Flame, Gift } from 'lucide-react'
import type { PublicOffer } from '@/lib/public-offers'
import { OfferLogo } from './OfferLogo'
import { PromoCodeButton } from './PromoCodeButton'
import { offerBenefit, offerDateLabel } from './offer-ui'

export function FeaturedOffersStrip({ offers, language, global = false }: { offers: PublicOffer[]; language: string; global?: boolean }) {
  if (!offers.length) return null
  return <section aria-labelledby={global ? 'global-offers-title' : 'hot-offers-title'} className={global ? 'border-b border-amber-300/10 bg-[#07111e]/85' : ''}>
    <div className={`mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8 ${global ? 'py-3' : 'pt-5'}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2"><Flame className="size-4 shrink-0 text-amber-300" /><h2 id={global ? 'global-offers-title' : 'hot-offers-title'} className="text-sm font-semibold text-white">Ofertas destacadas</h2>{!global && <span className="hidden text-xs text-slate-500 sm:inline">Selección editorial</span>}</div>
        {global && <Link href={`/ofertas?lang=${language}`} className="shrink-0 text-xs font-semibold text-amber-200 hover:text-amber-100">Ver todas →</Link>}
      </div>
      <div className={`mt-3 flex snap-x gap-3 overflow-x-auto pb-2 ${global ? '' : '-mx-4 px-4 sm:mx-0 sm:px-0'}`}>
        {offers.map((offer) => global ? <GlobalOfferCard key={offer.id} offer={offer} language={language} /> : <article key={offer.id} className="w-[min(82vw,290px)] shrink-0 snap-start rounded-xl border border-amber-300/20 bg-[linear-gradient(135deg,rgba(18,36,58,.96),rgba(8,19,32,.98))] p-4 shadow-[0_10px_30px_rgba(0,0,0,.18)]">
          <div className="flex items-start gap-3"><OfferLogo offer={offer} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{offer.platform.name}</p><p className="mt-0.5 text-xl font-black text-amber-200">{offerBenefit(offer)}</p></div>{offer.hotBadge && <span className="max-w-24 truncate rounded-full border border-amber-300/25 bg-amber-300/[.08] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-amber-100">{offer.hotBadge}</span>}</div>
          <p className="mt-2 line-clamp-1 text-xs text-slate-300">{offer.shortHighlight || offer.title}</p>
          {offer.includesFreeAccount && <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-cyan-300/20 bg-cyan-300/[.06] px-2 py-1 text-[10px] font-semibold text-cyan-100"><Gift className="size-3" />{offer.freeAccountLabel || 'Cuenta gratis'}</span>}
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">{offer.promoCode ? <PromoCodeButton code={offer.promoCode} compact /> : <span className="truncate text-[11px] text-slate-500">{offer.expiresAt ? `Hasta ${offerDateLabel(offer.expiresAt, language)}` : 'Vigente'}</span>}<Link href={`/go/${offer.platform.slug}?offer=${offer.id}&lang=${language}`} className="tg-button-gold min-h-8 shrink-0 px-3 py-1.5 text-xs">Ver <ArrowUpRight className="size-3.5" /></Link></div>
        </article>)}
      </div>
    </div>
  </section>
}

function GlobalOfferCard({ offer, language }: { offer: PublicOffer; language: string }) {
  return <article className="grid w-[min(88vw,390px)] shrink-0 snap-start grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-amber-300/20 bg-[linear-gradient(135deg,rgba(18,36,58,.96),rgba(8,19,32,.98))] p-2.5 shadow-[0_8px_24px_rgba(0,0,0,.16)]">
    <OfferLogo offer={offer} />
    <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-xs font-semibold text-white">{offer.platform.name}</p>{offer.hotBadge && <span className="max-w-20 truncate rounded-full border border-amber-300/20 px-1.5 py-0.5 text-[8px] font-bold uppercase text-amber-100">{offer.hotBadge}</span>}</div><p className="text-lg font-black text-amber-200">{offerBenefit(offer)}</p><p className="truncate text-[10px] text-slate-400">{offer.promoCode || offer.freeAccountLabel || (offer.expiresAt ? `Hasta ${offerDateLabel(offer.expiresAt, language)}` : 'Vigente')}</p></div>
    <Link href={`/go/${offer.platform.slug}?offer=${offer.id}&lang=${language}`} className="tg-button-gold min-h-8 px-3 py-1.5 text-xs">Ver <ArrowUpRight className="size-3.5" /></Link>
  </article>
}
