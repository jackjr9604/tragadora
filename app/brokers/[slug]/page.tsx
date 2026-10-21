import type { Metadata } from 'next'
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
import { firmProfileText, getPublicUi, localizedCountryName, publicBrokerProfileCopy, publicLocale, publicPath, publicUiLanguage } from '@/lib/public-i18n'
import { publicSeoMetadata } from '@/lib/public-seo'

export const revalidate = 60
type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<{ lang?: string | string[] }> }

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const language = await resolvePublicLanguage(query.lang)
  const broker = await getPublicBroker(slug, language)
  return broker ? publicSeoMetadata({ path: `/brokers/${slug}`, language, title: broker.seoTitle || broker.name, description: broker.seoDescription || broker.shortDescription }) : {}
}

export default async function BrokerPage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const language = await resolvePublicLanguage(query.lang)
  const copy = publicBrokerProfileCopy[publicUiLanguage(language)]
  const t = getPublicUi(language)
  const locale = publicLocale(language)
  const countryCode = (await headers()).get('x-vercel-ip-country')
  const [broker, offers] = await Promise.all([getPublicBroker(slug, language), getPublicOffers(language, countryCode)])
  if (!broker) notFound()
  const brokerOffers = offers.filter((offer) => offer.platform.id === broker.id)

  return <PublicPageShell language={language}><div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
    <header className="tradagora-pattern tradagora-pattern-gold rounded-3xl border border-amber-300/20 bg-[#101b2d] p-6 sm:p-8"><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center"><div className="flex items-center gap-4"><BrokerLogo broker={broker} large /><div><p className="tg-eyebrow">{copy.broker}</p><h1 className="mt-1 text-3xl font-bold sm:text-4xl">{broker.name}</h1><p className="mt-2 text-sm text-slate-400">{[broker.countryCode ? localizedCountryName(broker.countryCode, broker.country ?? broker.countryCode, language) : broker.country, broker.foundedYear ? firmProfileText(copy.since, { year: broker.foundedYear }) : null].filter(Boolean).join(' · ') || copy.generalUnverified}</p></div></div><Link href={publicPath(`/go/${broker.slug}`, language)} className="tg-button-gold shrink-0">{firmProfileText(copy.visit, { name: broker.name })} <ArrowUpRight className="size-4" /></Link></div></header>
    <main className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
      <div className="space-y-6"><section className="rounded-2xl border border-white/10 bg-[#111c2e] p-5 sm:p-7"><h2 className="text-xl font-bold">{copy.summary}</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{broker.description || copy.noDescription}</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><Fact label={copy.markets} value={broker.markets.map((market) => marketLabel(market, copy)).join(' · ') || null} fallback={copy.unverified} /><Fact label={copy.platforms} value={broker.tradingPlatforms.join(' · ') || null} fallback={copy.unverified} /><Fact label={copy.minimumDeposit} value={deposit(broker.minimumDeposit, broker.minimumDepositCurrency, locale)} fallback={copy.unverified} /><Fact label={copy.regulation} value={broker.regulationSummary} fallback={copy.unverified} /></div>{(broker.pros.length || broker.cons.length) ? <div className="mt-6 grid gap-4 sm:grid-cols-2">{broker.pros.length > 0 && <TranslationList title={t('platform.pros')} items={broker.pros} />}{broker.cons.length > 0 && <TranslationList title={t('platform.cons')} items={broker.cons} />}</div> : null}{broker.regulationSourceUrl && <a href={broker.regulationSourceUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-amber-300 hover:underline">{copy.officialSource} <ExternalLink className="size-4" /></a>}</section>
      {brokerOffers.length > 0 && <section className="rounded-2xl border border-white/10 bg-[#111c2e] p-5 sm:p-7"><p className="tg-eyebrow">{copy.activePromotion}</p><h2 className="mt-2 text-xl font-bold">{copy.offerAvailable}</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">{brokerOffers.map((offer) => <article key={offer.id} className="rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-4"><p className="text-2xl font-bold text-amber-300">{offer.discountType === 'percentage' ? firmProfileText(copy.percentageDiscount, { value: offer.discountValue }) : firmProfileText(copy.fixedDiscount, { value: offer.discountValue })} {copy.off}</p><h3 className="mt-2 font-semibold">{offer.title}</h3>{offer.promoCode && <div className="mt-4"><PromoCodeButton code={offer.promoCode} compact language={language} /></div>}<Link href={publicPath(`/go/${broker.slug}`, language, { offer: offer.id })} className="tg-button-gold mt-4 w-full">{copy.applyOffer} <ArrowUpRight className="size-4" /></Link></article>)}</div></section>}
      </div>
      <aside className="h-fit rounded-2xl border border-white/10 bg-[#111c2e] p-5"><h2 className="font-bold">{copy.essentialInformation}</h2><dl className="mt-5 space-y-5"><Fact label={copy.country} value={broker.countryCode ? localizedCountryName(broker.countryCode, broker.country ?? broker.countryCode, language) : broker.country} fallback={copy.unverified} /><Fact label={copy.founded} value={broker.foundedYear ? new Intl.NumberFormat(locale, { useGrouping: false }).format(broker.foundedYear) : null} fallback={copy.unverified} /><Fact label={copy.minimumDeposit} value={deposit(broker.minimumDeposit, broker.minimumDepositCurrency, locale)} fallback={copy.unverified} /><Fact label={copy.regulation} value={broker.regulationSummary} fallback={copy.unverified} /></dl></aside>
    </main>
  </div></PublicPageShell>
}

type BrokerProfileCopy = (typeof publicBrokerProfileCopy)[keyof typeof publicBrokerProfileCopy]
function Fact({ label, value, fallback }: { label: string; value: string | null; fallback: string }) { return <div><dt className="text-xs uppercase tracking-wider text-slate-500">{label}</dt><dd className="mt-1.5 text-sm font-semibold text-slate-200">{value || fallback}</dd></div> }
function deposit(value: number | null, currency: string | null, locale: string) { return value === null ? null : new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(value) }
function marketLabel(value: string, copy: BrokerProfileCopy) { return (copy.marketsMap as Record<string, string>)[value] ?? value }
function TranslationList({ title, items }: { title: string; items: string[] }) { return <section className="rounded-xl border border-white/8 bg-black/10 p-4"><h3 className="font-semibold">{title}</h3><ul className="mt-3 space-y-2 text-sm text-slate-400">{items.map((item) => <li key={item}>• {item}</li>)}</ul></section> }
