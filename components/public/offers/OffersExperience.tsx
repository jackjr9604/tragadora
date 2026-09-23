'use client'

import Link from 'next/link'
import { ArrowUpRight, ChevronDown, Clock3, Gift, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { PublicOffer } from '@/lib/public-offers'
import { FeaturedOffersStrip } from './FeaturedOffersStrip'
import { OfferActivityToast } from './OfferActivityToast'
import { OfferLogo } from './OfferLogo'
import { PromoCodeButton } from './PromoCodeButton'
import { offerBenefit, offerDateLabel, offerExpiresSoon } from './offer-ui'

type OfferType = 'all' | 'discount' | 'free' | 'code'
type Market = 'all' | 'cfd' | 'futures'
type OfferState = 'active' | 'ending'
type OfferGroup = { platformId: string; offers: PublicOffer[] }

const chip = 'rounded-lg border px-3 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-amber-300'
const activeChip = 'border-amber-200/55 bg-[linear-gradient(110deg,#a97313,#e8bb49_55%,#f8d779)] text-[#101827] shadow-[inset_0_1px_rgba(255,255,255,.35),0_5px_16px_rgba(200,148,36,.16)]'
const inactiveChip = 'border-white/10 bg-white/[.035] text-slate-300 hover:border-amber-300/35 hover:bg-white/[.06]'

export function OffersExperience({ offers, language, nowIso }: { offers: PublicOffer[]; language: string; nowIso: string }) {
  const [type, setType] = useState<OfferType>('all')
  const [market, setMarket] = useState<Market>('all')
  const [state, setState] = useState<OfferState>('active')
  const [search, setSearch] = useState('')
  const nowMs = new Date(nowIso).getTime()
  const featured = useMemo(() => offers.filter((offer) => offer.isFeatured), [offers])
  const filtered = useMemo(() => offers.filter((offer) => {
    const query = search.trim().toLocaleLowerCase(language)
    return (!query || `${offer.platform.name} ${offer.title} ${offer.promoCode ?? ''}`.toLocaleLowerCase(language).includes(query))
      && (type === 'all' || (type === 'discount' && offer.discountValue > 0) || (type === 'free' && offer.includesFreeAccount) || (type === 'code' && Boolean(offer.promoCode)))
      && (market === 'all' || offer.platform.markets.includes(market))
      && (state === 'active' || offerExpiresSoon(offer, nowMs))
  }), [language, market, nowMs, offers, search, state, type])
  const groups = useMemo(() => {
    const grouped = new Map<string, PublicOffer[]>()
    for (const offer of filtered) grouped.set(offer.platform.id, [...(grouped.get(offer.platform.id) ?? []), offer])
    return [...grouped].map(([platformId, groupOffers]) => ({ platformId, offers: groupOffers }))
  }, [filtered])

  return <>
    <FeaturedOffersStrip offers={featured} language={language} />
    <section id="ofertas" className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="tg-surface rounded-2xl p-3 sm:p-4"><div className="grid gap-3 xl:grid-cols-[minmax(240px,.9fr)_auto_auto_auto] xl:items-center">
        <label className="flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-[#081321] px-3 focus-within:border-amber-300/50"><Search className="size-4 text-slate-500" /><span className="sr-only">Buscar firma</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar firma o código" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-600" /></label>
        <FilterGroup label="Tipo" value={type} onChange={(value) => setType(value as OfferType)} options={[['all', 'Todas'], ['discount', 'Descuento'], ['free', 'Cuenta gratis'], ['code', 'Código']]} />
        <FilterGroup label="Mercado" value={market} onChange={(value) => setMarket(value as Market)} options={[['all', 'Todos'], ['cfd', 'CFD'], ['futures', 'Futures']]} />
        <FilterGroup label="Estado" value={state} onChange={(value) => setState(value as OfferState)} options={[['active', 'Activas'], ['ending', 'Por vencer']]} />
      </div></div>

      <div className="mt-5"><p className="tg-eyebrow">Promociones vigentes</p><h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">{filtered.length} {filtered.length === 1 ? 'promoción' : 'promociones'} · {groups.length} {groups.length === 1 ? 'firma' : 'firmas'}</h2></div>
      <div className="mt-4 space-y-3">{groups.map((group) => <OfferGroupCard key={group.platformId} group={group} language={language} nowMs={nowMs} />)}</div>
      {groups.length === 0 && <div className="tg-empty mt-5 rounded-2xl px-6 py-12 text-center"><Gift className="mx-auto size-8 text-amber-300" /><h2 className="mt-3 text-xl font-semibold">No encontramos ofertas con esos filtros</h2><p className="mt-2 text-sm text-slate-400">Prueba otro mercado, tipo o término de búsqueda.</p></div>}
    </section>
    <OfferActivityToast offers={offers} />
  </>
}

function FilterGroup({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <fieldset className="flex min-w-0 flex-wrap items-center gap-1.5"><legend className="sr-only">{label}</legend>{options.map(([key, text]) => <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)} className={`${chip} ${value === key ? activeChip : inactiveChip}`}>{text}</button>)}</fieldset>
}

function OfferGroupCard({ group, language, nowMs }: { group: OfferGroup; language: string; nowMs: number }) {
  const [primary, ...additional] = group.offers
  return <article className="overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(105deg,rgba(15,31,50,.94),rgba(8,19,32,.98))] shadow-sm transition hover:border-amber-300/30">
    <div className="grid md:grid-cols-[150px_minmax(0,1fr)_190px_130px] md:items-stretch">
      <div className="flex min-h-24 flex-col justify-center border-b border-amber-300/12 bg-[radial-gradient(circle_at_top_left,rgba(240,196,84,.14),transparent_58%)] px-4 py-3 md:border-b-0 md:border-r"><span className="text-[10px] font-bold uppercase tracking-[.16em] text-amber-200">Beneficio</span><strong className="mt-1 text-2xl font-black text-white">{offerBenefit(primary)}</strong>{primary.includesFreeAccount && <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full border border-cyan-300/20 bg-cyan-300/[.06] px-2 py-1 text-[10px] font-semibold text-cyan-100"><Gift className="size-3" />{primary.freeAccountLabel || 'Cuenta gratis'}</span>}</div>
      <div className="min-w-0 px-4 py-3"><div className="flex items-center gap-3"><OfferLogo offer={primary} large /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-white">{primary.platform.name}</h3>{primary.hotBadge && <span className="rounded-full border border-amber-300/25 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-100">{primary.hotBadge}</span>}{primary.countryCode && <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] text-slate-400">Solo {primary.countryCode}</span>}</div><p className="truncate text-sm font-semibold text-slate-200">{primary.title}</p></div></div><p className="mt-2 line-clamp-1 text-xs text-slate-400">{primary.shortHighlight || primary.description}</p><OfferMeta offer={primary} language={language} nowMs={nowMs} /></div>
      <div className="flex flex-col justify-center border-t border-white/8 px-4 py-3 md:border-l md:border-t-0">{primary.promoCode ? <PromoCodeButton code={primary.promoCode} /> : <p className="text-center text-xs text-slate-500">Se aplica desde el enlace</p>}</div>
      <div className="flex flex-col justify-center gap-2 border-t border-white/8 px-4 py-3 md:border-l md:border-t-0"><Link href={`/go/${primary.platform.slug}?offer=${primary.id}&lang=${language}`} className="tg-button-gold min-h-10 px-4 text-sm">Aplicar <ArrowUpRight className="size-4" /></Link><Link href={`/prop-firms/${primary.platform.slug}`} className="text-center text-[11px] font-semibold text-slate-400 hover:text-white">Ver firma</Link></div>
    </div>
    {additional.length > 0 && <details className="group border-t border-white/8"><summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-xs font-semibold text-amber-100 hover:bg-white/[.03]">Más {additional.length} {additional.length === 1 ? 'oferta' : 'ofertas'} de {primary.platform.name}<ChevronDown className="size-4 transition group-open:rotate-180" /></summary><div className="grid gap-2 border-t border-white/8 bg-black/10 p-3 lg:grid-cols-2">{additional.map((offer) => <SecondaryOffer key={offer.id} offer={offer} language={language} nowMs={nowMs} />)}</div></details>}
  </article>
}

function OfferMeta({ offer, language, nowMs }: { offer: PublicOffer; language: string; nowMs: number }) {
  return <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-slate-400">{offer.challengeName && <span className="rounded-md bg-white/5 px-2 py-1">{offer.challengeName}</span>}{offer.platform.markets.map((item) => <span key={item} className="rounded-md bg-white/5 px-2 py-1 uppercase">{item}</span>)}{offer.expiresAt ? <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${offerExpiresSoon(offer, nowMs) ? 'bg-red-400/10 text-red-200' : 'bg-white/5'}`}><Clock3 className="size-3" />{offerExpiresSoon(offer, nowMs) ? 'Por vencer · ' : 'Hasta '}{offerDateLabel(offer.expiresAt, language)}</span> : <span className="rounded-md bg-white/5 px-2 py-1">Vigente</span>}</div>
}

function SecondaryOffer({ offer, language, nowMs }: { offer: PublicOffer; language: string; nowMs: number }) {
  return <div className="grid items-center gap-3 rounded-lg border border-white/8 bg-white/[.025] p-3 sm:grid-cols-[minmax(0,1fr)_160px_auto]"><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{offer.title}</p><p className="text-xs font-bold text-amber-200">{offerBenefit(offer)}</p><OfferMeta offer={offer} language={language} nowMs={nowMs} /></div>{offer.promoCode ? <PromoCodeButton code={offer.promoCode} compact /> : <span className="text-xs text-slate-500">Sin código</span>}<Link href={`/go/${offer.platform.slug}?offer=${offer.id}&lang=${language}`} className="tg-button-secondary min-h-9 px-3 text-xs">Aplicar</Link></div>
}
