import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { ArrowUpRight, ExternalLink } from 'lucide-react'
import { BrokerLogo } from '@/components/public/BrokerDirectory'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { PromoCodeButton } from '@/components/public/offers/PromoCodeButton'
import { getPublicBroker } from '@/lib/brokers'
import { resolvePublicLanguage } from '@/lib/language'
import { getPublicOffers } from '@/lib/public-offers'

export const revalidate = 60

export default async function BrokerPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ lang?: string | string[] }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const language = await resolvePublicLanguage(query.lang)
  const countryCode = (await headers()).get('x-vercel-ip-country')
  const [broker, offers] = await Promise.all([getPublicBroker(slug, language), getPublicOffers(language, countryCode)])
  if (!broker) notFound()
  const brokerOffers = offers.filter((offer) => offer.platform.id === broker.id)

  return <PublicPageShell language={language}><div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
    <header className="tradagora-pattern tradagora-pattern-gold rounded-3xl border border-amber-300/20 bg-[#101b2d] p-6 sm:p-8"><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center"><div className="flex items-center gap-4"><BrokerLogo broker={broker} large /><div><p className="tg-eyebrow">Broker</p><h1 className="mt-1 text-3xl font-bold sm:text-4xl">{broker.name}</h1><p className="mt-2 text-sm text-slate-400">{[broker.country, broker.foundedYear ? `Desde ${broker.foundedYear}` : null].filter(Boolean).join(' · ') || 'Información general sin verificar'}</p></div></div><Link href={`/go/${broker.slug}?lang=${language}`} className="tg-button-gold shrink-0">Visitar {broker.name} <ArrowUpRight className="size-4" /></Link></div></header>
    <main className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
      <div className="space-y-6"><section className="rounded-2xl border border-white/10 bg-[#111c2e] p-5 sm:p-7"><h2 className="text-xl font-bold">Resumen</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{broker.description || 'Sin descripción verificada.'}</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><Fact label="Mercados" value={broker.markets.map(marketLabel).join(' · ') || null} /><Fact label="Plataformas" value={broker.tradingPlatforms.join(' · ') || null} /><Fact label="Depósito mínimo" value={deposit(broker.minimumDeposit, broker.minimumDepositCurrency)} /><Fact label="Regulación" value={broker.regulationSummary} /></div>{broker.regulationSourceUrl && <a href={broker.regulationSourceUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-amber-300 hover:underline">Consultar fuente oficial <ExternalLink className="size-4" /></a>}</section>
      {brokerOffers.length > 0 && <section className="rounded-2xl border border-white/10 bg-[#111c2e] p-5 sm:p-7"><p className="tg-eyebrow">Promoción activa</p><h2 className="mt-2 text-xl font-bold">Oferta disponible</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">{brokerOffers.map((offer) => <article key={offer.id} className="rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-4"><p className="text-2xl font-bold text-amber-300">{offer.discountValue}{offer.discountType === 'percentage' ? '%' : ' USD'} OFF</p><h3 className="mt-2 font-semibold">{offer.title}</h3>{offer.promoCode && <div className="mt-4"><PromoCodeButton code={offer.promoCode} compact /></div>}<Link href={`/go/${broker.slug}?offer=${offer.id}&lang=${language}`} className="tg-button-gold mt-4 w-full">Aplicar oferta <ArrowUpRight className="size-4" /></Link></article>)}</div></section>}
      </div>
      <aside className="h-fit rounded-2xl border border-white/10 bg-[#111c2e] p-5"><h2 className="font-bold">Información esencial</h2><dl className="mt-5 space-y-5"><Fact label="País" value={broker.country} /><Fact label="Fundación" value={broker.foundedYear ? String(broker.foundedYear) : null} /><Fact label="Depósito mínimo" value={deposit(broker.minimumDeposit, broker.minimumDepositCurrency)} /><Fact label="Regulación" value={broker.regulationSummary} /></dl></aside>
    </main>
  </div></PublicPageShell>
}

function Fact({ label, value }: { label: string; value: string | null }) { return <div><dt className="text-xs uppercase tracking-wider text-slate-500">{label}</dt><dd className="mt-1.5 text-sm font-semibold text-slate-200">{value || 'Sin verificar'}</dd></div> }
function deposit(value: number | null, currency: string | null) { return value === null ? null : new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(value) }
function marketLabel(value: string) { return ({ cfd: 'CFD / Forex', futures: 'Futures', crypto: 'Crypto', options: 'Opciones' } as Record<string, string>)[value] ?? value }
