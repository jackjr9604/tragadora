import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SearchInput } from '@/components/shared/SearchInput'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { PeriodTabs, SummaryTable } from '@/components/public/PayoutTrackerUI'
import { payoutPeriod, payoutPeriodLabel } from '@/lib/payout-periods'
import { getPayoutTrackerSummaries, type PayoutFirmSummary } from '@/lib/payout-tracker'
import { resolvePublicLanguage } from '@/lib/language'
import { GlobalOffersStrip } from '@/components/public/offers/GlobalOffersStrip'
import { PageHero } from '@/components/public/PageHero'
import { getPageContent, pageValue, sectionEnabled } from '@/lib/site-content'
import { getPublicUi, publicLocale } from '@/lib/public-i18n'
import { publicSeoMetadata } from '@/lib/public-seo'

export const revalidate = 60
export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const language = await resolvePublicLanguage((await searchParams).lang), t = getPublicUi(language), content = await getPageContent('payouts', language)
  const value = (field: string, fallback: string) => typeof content.hero?.[field] === 'string' && String(content.hero[field]).trim() ? String(content.hero[field]) : fallback
  return publicSeoMetadata({ path: '/payouts', language, title: value('title', t('hero.payouts.title')), description: value('subtitle', t('hero.payouts.subtitle')) })
}
type SearchParams = { lang?: string | string[]; period?: string | string[]; q?: string | string[]; market?: string | string[]; sort?: string | string[] }

export default async function PayoutsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const language = await resolvePublicLanguage(params.lang)
  const t = getPublicUi(language)
  const locale = publicLocale(language)
  const period = payoutPeriod(scalar(params.period), '30d')
  const [allSummaries, content] = await Promise.all([
    getPayoutTrackerSummaries(period),
    getPageContent('payouts', language),
  ])
  const query = scalar(params.q).trim().toLocaleLowerCase(locale)
  const market = scalar(params.market) || 'all'
  const sort = scalar(params.sort) || 'total'
  const summaries = allSummaries.filter((item) => !query || item.name.toLocaleLowerCase(locale).includes(query)).filter((item) => market === 'all' || item.markets.includes(market)).sort(sorter(sort, locale))

  return <PublicPageShell language={language}>
    <PageHero content={content} language={language} fallbackTitle={t('hero.payouts.title')} fallbackSubtitle={t('hero.payouts.subtitle')} primaryHref="#ranking" secondaryHref="#metodologia" compact><div className="mt-7"><PeriodTabs active={period} basePath="/payouts" language={language} /></div></PageHero>
    <Suspense fallback={null}><GlobalOffersStrip language={language} /></Suspense>
    <section id="ranking" className="mx-auto w-full min-w-0 max-w-[1440px] scroll-mt-24 px-4 py-8 sm:px-6 lg:px-8 lg:py-10"><div className="mb-6"><h2 className="text-2xl font-bold">{t('payout.heading', { period: payoutPeriodLabel(period, language) })}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{t('payout.externalReferenceHelp')}</p></div><form className="tg-surface mb-5 grid min-w-0 gap-3 rounded-2xl p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,.8fr)_minmax(0,.8fr)_auto]"><input type="hidden" name="lang" value={language} /><input type="hidden" name="period" value={period} /><SearchInput key={scalar(params.q)} value={scalar(params.q)} placeholder={t('directory.searchFirm')} theme="dark" /><Select name="market" value={market} options={[["all", t('filter.allMarkets')], ["cfd", "Forex / CFD"], ["futures", "Futures"], ["crypto", "Crypto"]]} /><Select name="sort" value={sort} options={[["total", t('filter.sortTotal')], ["payouts", t('filter.sortCount')], ["largest", t('filter.sortLargest')], ["average", t('filter.sortAverage')]]} /><button className="tg-button-gold w-full px-5 py-3 text-sm md:w-auto">{t('common.apply')}</button></form><SummaryTable summaries={summaries} language={language} /></section>
    {sectionEnabled(content, 'methodology') && <section id="metodologia" className="mx-auto w-full max-w-[1440px] scroll-mt-24 px-4 pb-12 sm:px-6 lg:px-8"><div className="tg-surface rounded-2xl p-6 sm:p-8"><p className="tg-eyebrow">{pageValue(content, 'methodology', 'badge', t('payout.methodologyBadge'))}</p><h2 className="mt-3 text-2xl font-bold text-white">{pageValue(content, 'methodology', 'title', t('payout.methodologyTitle'))}</h2><p className="mt-3 max-w-3xl leading-7 text-slate-400">{pageValue(content, 'methodology', 'subtitle', t('payout.methodologySubtitle'))}</p></div></section>}
  </PublicPageShell>
}

function Select({ name, value, options }: { name: string; value: string; options: Array<[string, string]> }) { return <select name={name} defaultValue={value} className="tg-filter w-full min-w-0 rounded-xl px-3 py-3 text-sm">{options.map(([option, label]) => <option key={option} value={option}>{label}</option>)}</select> }
function scalar(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? '' : value ?? '' }
function sorter(sort: string, locale: string) { const value = (item: PayoutFirmSummary) => sort === 'payouts' ? item.knownPayoutCount ?? -1 : sort === 'largest' ? item.knownLargestPayout ?? -1 : sort === 'average' ? item.knownAveragePayout ?? -1 : item.displayTotalAmount ?? -1; return (a: PayoutFirmSummary, b: PayoutFirmSummary) => value(b) - value(a) || a.name.localeCompare(b.name, locale) }
