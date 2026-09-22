'use client'

import Link from 'next/link'
import { ArrowUpRight, Check, Clock3, Copy, Flame, Gift, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { PublicOffer } from '@/lib/public-offers'

type OfferType = 'all' | 'discount' | 'free' | 'code'
type Market = 'all' | 'cfd' | 'futures'
type OfferState = 'active' | 'ending'

const chip = 'rounded-full border px-3 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-amber-300'

function benefit(offer: PublicOffer) {
  if (offer.discountValue > 0) return offer.discountType === 'percentage' ? `${offer.discountValue}% OFF` : `$${offer.discountValue} OFF`
  if (offer.includesFreeAccount) return offer.freeAccountLabel || 'Cuenta gratis'
  return offer.shortHighlight || 'Beneficio activo'
}

function expiresSoon(offer: PublicOffer, nowMs: number) {
  if (!offer.expiresAt) return false
  const remaining = new Date(offer.expiresAt).getTime() - nowMs
  return remaining >= 0 && remaining <= 7 * 24 * 60 * 60 * 1000
}

function dateLabel(value: string, language: string) {
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'America/Bogota' }).format(new Date(value))
}

function OfferLogo({ offer, large = false }: { offer: PublicOffer; large?: boolean }) {
  const size = large ? 'size-12 rounded-xl' : 'size-9 rounded-lg'
  return offer.platform.logoUrl
    // Storage domains are configured by Supabase and intentionally remain unoptimized.
    ? <img src={offer.platform.logoUrl} alt={offer.platform.logoAlt || offer.platform.name} width={large ? 48 : 36} height={large ? 48 : 36} loading="lazy" decoding="async" className={`${size} bg-white object-contain p-1`} /> // eslint-disable-line @next/next/no-img-element
    : <span className={`${size} flex items-center justify-center bg-white/10 font-bold text-amber-200`}>{offer.platform.name.slice(0, 2).toUpperCase()}</span>
}

export function OffersExperience({ offers, language, nowIso }: { offers: PublicOffer[]; language: string; nowIso: string }) {
  const [type, setType] = useState<OfferType>('all')
  const [market, setMarket] = useState<Market>('all')
  const [state, setState] = useState<OfferState>('active')
  const [search, setSearch] = useState('')
  const featured = useMemo(() => offers.filter((offer) => offer.isFeatured), [offers])
  const filtered = useMemo(() => offers.filter((offer) => {
    const query = search.trim().toLocaleLowerCase(language)
    const matchesSearch = !query || `${offer.platform.name} ${offer.title} ${offer.promoCode ?? ''}`.toLocaleLowerCase(language).includes(query)
    const matchesType = type === 'all' || (type === 'discount' && offer.discountValue > 0) || (type === 'free' && offer.includesFreeAccount) || (type === 'code' && Boolean(offer.promoCode))
    const matchesMarket = market === 'all' || offer.platform.markets.includes(market)
    const matchesState = state === 'active' || expiresSoon(offer, new Date(nowIso).getTime())
    return matchesSearch && matchesType && matchesMarket && matchesState
  }), [language, market, nowIso, offers, search, state, type])

  return <>
    {featured.length > 0 && <HotOffersStrip offers={featured} language={language} />}
    <section id="ofertas" className="mx-auto w-full max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-white/10 bg-[#0d1928]/90 p-4 shadow-[0_18px_60px_rgba(0,0,0,.2)] sm:p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-4">
            <FilterGroup label="Tipo" value={type} onChange={(value) => setType(value as OfferType)} options={[['all', 'Todas'], ['discount', 'Descuento'], ['free', 'Cuenta gratis'], ['code', 'Código promo']]} />
            <FilterGroup label="Mercado" value={market} onChange={(value) => setMarket(value as Market)} options={[['all', 'Todos'], ['cfd', 'CFD'], ['futures', 'Futures']]} />
            <FilterGroup label="Estado" value={state} onChange={(value) => setState(value as OfferState)} options={[['active', 'Activas'], ['ending', 'Por vencer']]} />
          </div>
          <label className="block min-w-0 lg:w-80"><span className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">Buscar firma</span><span className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-[#081321] px-3 focus-within:border-amber-300/50"><Search className="size-4 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o código" className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-slate-600" /></span></label>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-300">Promociones vigentes</p><h2 className="mt-1 text-2xl font-semibold text-white">{filtered.length} {filtered.length === 1 ? 'oferta disponible' : 'ofertas disponibles'}</h2></div></div>
      <div className="mt-5 space-y-4">{filtered.map((offer) => <OfferCard key={offer.id} offer={offer} language={language} nowMs={new Date(nowIso).getTime()} />)}</div>
      {filtered.length === 0 && <div className="mt-6 rounded-2xl border border-dashed border-amber-300/20 bg-[#0d1928] px-6 py-14 text-center"><Gift className="mx-auto size-8 text-amber-300" /><h2 className="mt-4 text-xl font-semibold">No encontramos ofertas con esos filtros</h2><p className="mt-2 text-sm text-slate-400">Prueba otro mercado, tipo o término de búsqueda.</p></div>}
    </section>
    <OfferActivityToast offers={offers} />
  </>
}

function FilterGroup({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <div><p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-slate-500">{label}</p><div className="flex flex-wrap gap-2">{options.map(([key, text]) => <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)} className={`${chip} ${value === key ? 'border-amber-300 bg-amber-300 text-[#09111f]' : 'border-white/10 bg-white/[.03] text-slate-300 hover:border-amber-300/40'}`}>{text}</button>)}</div></div>
}

function HotOffersStrip({ offers, language }: { offers: PublicOffer[]; language: string }) {
  return <section aria-labelledby="hot-offers-title" className="mx-auto w-full max-w-7xl px-4 pt-7 sm:px-6 lg:px-8"><div className="flex items-center gap-2"><Flame className="size-5 text-amber-300" /><h2 id="hot-offers-title" className="text-lg font-semibold">Ofertas destacadas</h2><span className="text-xs text-slate-500">Selección editorial</span></div><div className="-mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">{offers.map((offer) => <article key={offer.id} className="min-w-[270px] snap-start rounded-2xl border border-amber-300/25 bg-[linear-gradient(135deg,#142338,#0b1725)] p-4 shadow-[0_12px_35px_rgba(0,0,0,.22)] sm:min-w-[300px] lg:flex-1"><div className="flex items-start gap-3"><OfferLogo offer={offer} /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{offer.platform.name}</p><p className="mt-1 text-2xl font-black text-amber-300">{benefit(offer)}</p></div>{offer.hotBadge && <span className="rounded-full bg-cyan-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-200">{offer.hotBadge}</span>}</div><p className="mt-3 line-clamp-2 min-h-10 text-sm text-slate-300">{offer.shortHighlight || offer.title}</p><div className="mt-4 flex items-center justify-between gap-3">{offer.promoCode ? <code className="truncate text-xs text-cyan-200">{offer.promoCode}</code> : <span className="text-xs text-slate-500">{offer.expiresAt ? `Hasta ${dateLabel(offer.expiresAt, language)}` : 'Sin fecha límite publicada'}</span>}<Link href={`/go/${offer.platform.slug}?offer=${offer.id}&lang=${language}`} className="shrink-0 rounded-lg bg-amber-300 px-3 py-2 text-xs font-bold text-[#09111f]">Ver oferta</Link></div></article>)}</div></section>
}

function OfferCard({ offer, language, nowMs }: { offer: PublicOffer; language: string; nowMs: number }) {
  return <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#101c2c] shadow-[0_16px_50px_rgba(0,0,0,.18)] transition hover:border-amber-300/30 md:grid md:grid-cols-[190px_minmax(0,1fr)_230px]">
    <div className="relative flex min-h-36 flex-col justify-center border-b border-amber-300/15 bg-[radial-gradient(circle_at_top_left,rgba(247,198,75,.2),transparent_55%),#0a1523] p-5 md:border-b-0 md:border-r"><span className="text-xs font-bold uppercase tracking-[.18em] text-amber-200">Beneficio</span><strong className="mt-2 text-3xl font-black text-white">{benefit(offer)}</strong>{offer.includesFreeAccount && <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-200"><Gift className="size-3.5" />{offer.freeAccountLabel || 'Cuenta gratis incluida'}</span>}</div>
    <div className="min-w-0 p-5"><div className="flex items-start gap-3"><OfferLogo offer={offer} large /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-white">{offer.platform.name}</h3>{offer.hotBadge && <span className="rounded-full border border-amber-300/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200">{offer.hotBadge}</span>}{offer.countryCode && <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-400">Solo {offer.countryCode}</span>}</div><p className="mt-1 text-lg font-bold text-slate-100">{offer.title}</p></div></div>{offer.description && <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-400">{offer.description}</p>}<div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">{offer.challengeName && <span className="rounded-full bg-white/5 px-2.5 py-1">{offer.challengeName}</span>}{offer.platform.markets.map((market) => <span key={market} className="rounded-full bg-white/5 px-2.5 py-1 uppercase">{market}</span>)}{offer.expiresAt && <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${expiresSoon(offer, nowMs) ? 'bg-red-400/10 text-red-200' : 'bg-white/5'}`}><Clock3 className="size-3.5" />Hasta {dateLabel(offer.expiresAt, language)}</span>}</div></div>
    <div className="flex flex-col justify-center gap-3 border-t border-white/10 bg-black/10 p-5 md:border-l md:border-t-0"><OfferCode code={offer.promoCode} /><Link href={`/go/${offer.platform.slug}?offer=${offer.id}&lang=${language}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 font-bold text-[#09111f] transition hover:bg-amber-200">Aplicar <ArrowUpRight className="size-4" /></Link><Link href={`/prop-firms/${offer.platform.slug}`} className="text-center text-xs font-semibold text-slate-400 hover:text-white">Más sobre la firma</Link></div>
  </article>
}

function OfferCode({ code }: { code: string | null }) {
  const [copied, setCopied] = useState(false)
  if (!code) return <p className="text-center text-xs text-slate-500">Se aplica desde el enlace de la oferta</p>
  async function copy() {
    try {
      await navigator.clipboard.writeText(code!)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }
  return <button type="button" onClick={copy} aria-label={`Copiar código ${code}`} className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-dashed border-cyan-300/30 bg-cyan-300/5 px-3 text-left"><span><span className="block text-[10px] uppercase tracking-wide text-slate-500">Código promo</span><code className="font-bold text-cyan-200">{code}</code></span><span className="inline-flex items-center gap-1 text-xs text-slate-300">{copied ? <><Check className="size-4 text-emerald-300" />Copiado</> : <><Copy className="size-4" />Copiar</>}</span></button>
}

function OfferActivityToast({ offers }: { offers: PublicOffer[] }) {
  const [index, setIndex] = useState(-1)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!offers.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const shown = Number(sessionStorage.getItem('tradagora-offer-toast-count') || 0)
    if (shown >= 3) return
    let hideTimer: number | undefined
    const show = () => {
      setIndex((current) => (current + 1) % offers.length)
      setVisible(true)
      const nextCount = Number(sessionStorage.getItem('tradagora-offer-toast-count') || 0) + 1
      sessionStorage.setItem('tradagora-offer-toast-count', String(nextCount))
      hideTimer = window.setTimeout(() => setVisible(false), 6000)
    }
    const initial = window.setTimeout(show, 4500)
    const rotation = window.setInterval(() => {
      if (Number(sessionStorage.getItem('tradagora-offer-toast-count') || 0) < 3) show()
      else window.clearInterval(rotation)
    }, 20000)
    return () => { window.clearTimeout(initial); window.clearTimeout(hideTimer); window.clearInterval(rotation) }
  }, [offers])
  if (!visible || index < 0 || !offers[index]) return null
  const offer = offers[index]
  const message = offer.shortHighlight
    || (offer.promoCode ? `Código ${offer.promoCode} disponible` : offer.includesFreeAccount ? (offer.freeAccountLabel || 'Incluye cuenta gratis') : `${benefit(offer)} activo`)
  return <aside role="status" aria-live="polite" className="fixed bottom-4 left-4 z-50 w-[min(340px,calc(100vw-2rem))] rounded-2xl border border-amber-300/25 bg-[#101c2c]/95 p-4 shadow-2xl backdrop-blur"><button type="button" onClick={() => setVisible(false)} aria-label="Cerrar notificación de oferta" className="absolute right-2 top-2 rounded-lg p-1 text-slate-400 hover:text-white"><X className="size-4" /></button><div className="flex items-center gap-3 pr-5"><OfferLogo offer={offer} /><p className="text-sm"><strong className="block text-white">{offer.platform.name}</strong><span className="text-slate-300">{message}</span></p></div></aside>
}
