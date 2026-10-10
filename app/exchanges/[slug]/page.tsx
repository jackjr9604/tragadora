import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowUpRight, ExternalLink } from 'lucide-react'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { PromoCodeButton } from '@/components/public/offers/PromoCodeButton'
import { getPublicExchange } from '@/lib/exchanges'
import { resolvePublicLanguage } from '@/lib/language'
import { getPublicOffers } from '@/lib/public-offers'
import { firmProfileText, localizedCountryName, publicExchangeProfileCopy, publicLocale, publicPath, publicUiLanguage } from '@/lib/public-i18n'

export const revalidate = 60

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ lang?: string | string[] }>
}

export default async function Page({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const language = await resolvePublicLanguage(query.lang)
  const copy = publicExchangeProfileCopy[publicUiLanguage(language)]
  const locale = publicLocale(language)
  const [exchange, offers] = await Promise.all([getPublicExchange(slug, language), getPublicOffers(language, null)])
  if (!exchange) notFound()
  const activeOffers = offers.filter((offer) => offer.platform.id === exchange.id)
  const country = exchange.countryCode
    ? localizedCountryName(exchange.countryCode, exchange.country ?? exchange.countryCode, language)
    : exchange.country
  const exchangeType = exchange.exchangeType === 'decentralized' ? copy.decentralized : copy.centralized
  const fiatSupport = exchange.fiatSupport === null ? null : exchange.fiatSupport ? copy.yes : copy.no

  return <PublicPageShell language={language}>
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <header className="tradagora-pattern tradagora-pattern-gold rounded-3xl border border-amber-300/20 bg-[#101b2d] p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            {exchange.logoUrl
              ? <img src={exchange.logoUrl} alt={exchange.logoAlt || exchange.name} className="size-16 rounded-2xl bg-white object-contain p-1" />
              : <span className="flex size-16 items-center justify-center rounded-2xl bg-white/5 font-bold text-amber-300">{exchange.name.slice(0, 2)}</span>}
            <div>
              <p className="tg-eyebrow">{copy.exchange}</p>
              <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{exchange.name}</h1>
              <p className="mt-2 text-sm text-slate-400">{[country, exchange.foundedYear ? firmProfileText(copy.since, { year: exchange.foundedYear }) : null].filter(Boolean).join(' · ') || copy.generalUnverified}</p>
            </div>
          </div>
          <Link href={publicPath(`/go/${exchange.slug}`, language)} className="tg-button-gold">{firmProfileText(copy.visit, { name: exchange.name })} <ArrowUpRight className="size-4" /></Link>
        </div>
      </header>

      <main className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-[#111c2e] p-6">
            <h2 className="text-xl font-bold">{copy.summary}</h2>
            <p className="mt-3 leading-7 text-slate-300">{exchange.description || copy.noDescription}</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Fact label={copy.type} value={exchangeType} fallback={copy.unverified} />
              <Fact label={copy.products} value={exchange.productSummary} fallback={copy.unverified} />
              <Fact label={copy.fiatSupport} value={fiatSupport} fallback={copy.unverified} />
              <Fact label={copy.regulation} value={exchange.regulationSummary} fallback={copy.unverified} />
            </div>
            {exchange.regulationSourceUrl && <a href={exchange.regulationSourceUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-amber-300">{copy.checkSource} <ExternalLink className="size-4" /></a>}
          </section>

          {activeOffers.length > 0 && <section className="rounded-2xl border border-white/10 bg-[#111c2e] p-6">
            <h2 className="text-xl font-bold">{copy.activeOffers}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">{activeOffers.map((offer) => <article key={offer.id} className="rounded-xl border border-amber-300/15 p-4">
              <strong>{offer.title}</strong>
              <p className="mt-2 text-2xl font-bold text-amber-300">{offer.discountType === 'percentage' ? firmProfileText(copy.percentageDiscount, { value: offer.discountValue }) : firmProfileText(copy.fixedDiscount, { value: offer.discountValue })} {copy.off}</p>
              {offer.promoCode && <div className="mt-4"><PromoCodeButton code={offer.promoCode} compact language={language} /></div>}
              <Link href={publicPath(`/go/${exchange.slug}`, language, { offer: offer.id })} className="tg-button-gold mt-4">{copy.viewOffer}</Link>
            </article>)}</div>
          </section>}
        </div>

        <aside className="h-fit rounded-2xl border border-white/10 bg-[#111c2e] p-5">
          <h2 className="font-bold">{copy.essentialInformation}</h2>
          <dl className="mt-5 space-y-5">
            <Fact label={copy.country} value={country} fallback={copy.unverified} />
            <Fact label={copy.founded} value={exchange.foundedYear ? new Intl.NumberFormat(locale, { useGrouping: false }).format(exchange.foundedYear) : null} fallback={copy.unverified} />
            <Fact label={copy.products} value={exchange.productSummary} fallback={copy.unverified} />
            <Fact label={copy.fiat} value={fiatSupport} fallback={copy.unverified} />
          </dl>
        </aside>
      </main>
    </div>
  </PublicPageShell>
}

function Fact({ label, value, fallback }: { label: string; value: string | null; fallback: string }) {
  return <div><dt className="text-xs uppercase tracking-wider text-slate-500">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-200">{value || fallback}</dd></div>
}
