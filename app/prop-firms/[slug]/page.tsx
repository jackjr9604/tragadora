import type { Metadata } from 'next'
import Link from 'next/link'
import { CountryFlag } from '@/components/shared/CountryFlag'
import { notFound } from 'next/navigation'
import { ArrowUpRight, CalendarDays, CandlestickChart, Check, Clock3, CreditCard, HandCoins, HelpCircle, Landmark, Monitor, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { HomePlatform } from '@/lib/home-data'
import { resolvePublicLanguage } from '@/lib/language'
import { PlatformLogo } from '@/components/public/PlatformLogo'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { resolveChallenge, type AccountPlan, type ChallengePhase, type ChallengeRewardOption, type ChallengeVariant, type ChallengeVariantPhase, type EffectivePhase, type ResolvedChallenge } from '@/lib/challenge-resolver'
import { FirmProfileNavigation, type FirmSection } from './_components/FirmProfileNavigation'
import { FirmPayoutDashboard } from '@/components/public/FirmPayoutDashboard'
import { payoutPeriod } from '@/lib/payout-periods'
import { getPayoutFirmDetail } from '@/lib/payout-tracker'
import { getPublicPlatformBySlug } from '@/lib/public-platform'
import { firmProfileText, localizedCountryName, publicFirmProfileCopy, publicLocale, publicPath, publicUiLanguage } from '@/lib/public-i18n'

export const revalidate = 60

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ lang?: string | string[]; view?: string | string[]; period?: string | string[] }>
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const language = await resolvePublicLanguage(query.lang)
  const copy = publicFirmProfileCopy[publicUiLanguage(language)]
  const platform = await getPublicPlatformBySlug(slug)
  return platform ? { title: `${platform.name} | Tradagora`, description: firmProfileText(copy.metaDescription, { name: platform.name }) } : {}
}

export default async function PropFirmDetailPage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const language = await resolvePublicLanguage(query.lang)
  const copy = publicFirmProfileCopy[publicUiLanguage(language)]
  const locale = publicLocale(language)
  const requestedView = Array.isArray(query.view) ? query.view[0] : query.view
  const activeView = requestedView === 'offers' || requestedView === 'payouts' ? requestedView : 'overview'
  const requestedPeriod = Array.isArray(query.period) ? query.period[0] : query.period
  const payoutPeriodKey = requestedPeriod === '24h' ? '7d' : payoutPeriod(requestedPeriod, 'all')
  const supabase = await createClient()
  const needsOverview = activeView === 'overview'

  const row = await getPublicPlatformBySlug(slug)
  if (!row) notFound()

  const [detailsResult, translationsResult, marketsResult, availabilityResult, countriesResult, challengesResult, offersResult, tradingPlatformsResult, transactionMethodsResult, instrumentsResult, payoutDetail] = await Promise.all([
    supabase.from('prop_firm_details').select('platform_id, profit_split_max, supports_ea, allows_news_trading, allows_weekend_holding, allows_scalping, allows_day_trading, allows_copy_trading, broker_provider, ceo_name, founded_at, consistency_rules, inactivity_days').eq('platform_id', row.id).maybeSingle(),
    needsOverview ? supabase.from('platform_translations').select('language, short_description').eq('platform_id', row.id).in('language', [language, 'es']) : Promise.resolve({ data: [], error: null }),
    supabase.from('platform_markets').select('market').eq('platform_id', row.id),
    needsOverview
  ? supabase
      .from('platform_availability')
      .select('country_code, status, market')
      .eq('platform_id', row.id)
  : Promise.resolve({ data: [], error: null }),
    supabase.from('countries').select('code, name').eq('code', row.origin_country_code ?? ''),
    activeView !== 'payouts' ? supabase.from('challenges').select('id, name, challenge_type, phases, status').eq('platform_id', row.id).eq('status', 'active').order('name') : Promise.resolve({ data: [], error: null }),
    activeView !== 'payouts' ? supabase.from('offers').select('id, challenge_id, title, description, discount_value, discount_type, promo_code, status').eq('platform_id', row.id).eq('status', true).order('priority') : Promise.resolve({ data: [], error: null }),
    needsOverview ? supabase.from('platform_trading_platforms').select('catalog:trading_platform_id(name)').eq('platform_id', row.id) : Promise.resolve({ data: [], error: null }),
    needsOverview ? supabase.from('platform_transaction_methods').select('supports_deposit, supports_payout, catalog:transaction_method_id(name)').eq('platform_id', row.id) : Promise.resolve({ data: [], error: null }),
    needsOverview ? supabase.from('platform_instruments').select('catalog:instrument_category_id(name)').eq('platform_id', row.id) : Promise.resolve({ data: [], error: null }),
    activeView === 'payouts' ? getPayoutFirmDetail(slug, payoutPeriodKey) : Promise.resolve(null),
  ])

  const details = detailsResult.data
  const translations = translationsResult.data ?? []
  const description = translations.find((item) => item.language === language)?.short_description
    ?? translations.find((item) => item.language === 'es')?.short_description
    ?? null
  const media = first(row.media)
  const platform: HomePlatform = {
    id: row.id, name: row.name, slug: row.slug, score: row.score === null ? null : Number(row.score),
    logoUrl: media?.file_url ?? null, logoAlt: media?.alt_text ?? null, description,
    profitSplit: numberOrNull(details?.profit_split_max), supportsEa: details?.supports_ea ?? null,
    allowsNews: details?.allows_news_trading ?? null, allowsWeekend: details?.allows_weekend_holding ?? null,
    allowsScalping: details?.allows_scalping ?? null, allowsDayTrading: details?.allows_day_trading ?? null,
    allowsCopyTrading: details?.allows_copy_trading ?? null, markets: (marketsResult.data ?? []).map((item) => item.market),
  }
  const countryMap = new Map((countriesResult.data ?? []).map((country) => [country.code, country.name]))
  const availability = availabilityResult.data ?? []
  const restrictedCountries = availability.filter(
  (item) =>
    item.status === 'restricted' &&
    item.market == null
)
  const challenges = challengesResult.data ?? []
  const challengeIds = challenges.map((challenge) => challenge.id)
  const visibleAt = new Date().toISOString()
  const [plansResult, phasesResult, variantsResult, rewardOptionsResult] = needsOverview && challengeIds.length ? await Promise.all([
    supabase.from('account_plans').select('*').in('challenge_id', challengeIds).order('account_size'),
    supabase.from('challenge_phases').select('*').in('challenge_id', challengeIds).order('phase_number'),
    supabase.from('challenge_variants').select('*').in('challenge_id', challengeIds).eq('status', true).order('name'),
    supabase.from('challenge_reward_options').select('*').in('challenge_id', challengeIds).eq('status', true)
      .or(`effective_from.is.null,effective_from.lte.${visibleAt}`)
      .or(`effective_to.is.null,effective_to.gt.${visibleAt}`)
      .order('sort_order'),
  ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }]
  const normalizedError = plansResult.error ?? phasesResult.error ?? variantsResult.error ?? rewardOptionsResult.error
  if (normalizedError) throw new Error(normalizedError.message)
  const variantIds = (variantsResult.data ?? []).map((variant) => variant.id)
  const variantPhasesResult = variantIds.length
    ? await supabase.from('challenge_variant_phases').select('*').in('variant_id', variantIds).order('phase_number')
    : { data: [], error: null }
  if (variantPhasesResult.error) throw new Error(variantPhasesResult.error.message)
  const plans = (plansResult.data ?? []) as AccountPlan[]
  const phases = (phasesResult.data ?? []) as ChallengePhase[]
  const variants = (variantsResult.data ?? []) as ChallengeVariant[]
  const variantPhases = (variantPhasesResult.data ?? []) as ChallengeVariantPhase[]
  const rewardOptions = (rewardOptionsResult.data ?? []) as ChallengeRewardOption[]
  const resolvedChallenges = challenges.map((challenge) => resolveChallenge({ challenge, phases, variants, variantPhases, plans, rewardOptions, now: visibleAt }))
  const allRewardOptions = uniqueById(resolvedChallenges.flatMap((resolved) => [
    ...resolved.generalRewardOptions,
    ...resolved.variants.flatMap((variant) => variant.rewardOptionsSource === 'specific' ? variant.rewardOptions : []),
  ]))
  const rewardSplits = allRewardOptions.flatMap((option) => option.profit_split === null ? [] : [Number(option.profit_split)])
  const maximumRewardSplit = rewardSplits.length ? Math.max(...rewardSplits) : platform.profitSplit
  const challengeNames = new Map(challenges.map((challenge) => [challenge.id, challenge.name]))
  const maximumAccountSize = plans.reduce<number | null>((maximum, plan) => plan.account_size === null ? maximum : Math.max(maximum ?? 0, Number(plan.account_size)), null)
  const tradingPlatformNames = (tradingPlatformsResult.data ?? []).flatMap((item) => { const catalog = first(item.catalog); return catalog?.name ? [catalog.name] : [] })
  const paymentMethodNames = (transactionMethodsResult.data ?? []).flatMap((item) => { const catalog = first(item.catalog); return item.supports_deposit && catalog?.name ? [catalog.name] : [] })
  const payoutMethodNames = (transactionMethodsResult.data ?? []).flatMap((item) => { const catalog = first(item.catalog); return item.supports_payout && catalog?.name ? [catalog.name] : [] })
  const instrumentNames = (instrumentsResult.data ?? []).flatMap((item) => { const catalog = first(item.catalog); return catalog?.name ? [catalog.name] : [] })
  const hasFirmInformation = Boolean(details?.broker_provider || tradingPlatformNames.length || paymentMethodNames.length || payoutMethodNames.length || instrumentNames.length)
  const primaryOffer = offersResult.data?.[0]
  const ctaHref = publicPath(`/go/${platform.slug}`, language, { offer: primaryOffer?.id })
  const ctaLabel = primaryOffer ? copy.viewOffer : firmProfileText(copy.visit, { name: platform.name })
  const sections: FirmSection[] = [
    { id: 'resumen', label: copy.overview },
    ...(hasFirmInformation ? [{ id: 'informacion', label: copy.information }] : []),
    ...(platform.markets.length ? [{ id: 'mercados', label: copy.markets }] : []),
    { id: 'reglas', label: copy.rules },
    ...(resolvedChallenges.length ? [{ id: 'desafios', label: copy.challenges }] : []),
    ...(allRewardOptions.length ? [{ id: 'retiros', label: copy.withdrawals }] : []),
    ...(restrictedCountries.length ? [{ id: 'restricciones', label: copy.restrictions }] : []),
  ]

  return <PublicPageShell language={language}>
    <section id="firm-hero" className="tradagora-pattern border-b border-white/8">
      <div className="mx-auto max-w-[1440px] px-4 pt-8 sm:px-6 sm:pt-10 lg:px-8">
      <div className="grid gap-7 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#152238] to-[#0d1728] p-5 shadow-[0_24px_70px_rgba(0,0,0,.18)] sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex min-w-0 items-start gap-4 sm:gap-5"><div className="rounded-2xl border border-white/10 bg-white/5 p-1"><PlatformLogo platform={platform} /></div><div className="min-w-0"><p className="font-mono text-[11px] uppercase tracking-[.22em] text-cyan-300">Prop Firm</p><h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-5xl">{platform.name}</h1><div className="mt-3 flex flex-wrap items-center gap-2">{row.origin_country_code && <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"><CountryFlag countryCode={row.origin_country_code} countryName={localizedCountryName(row.origin_country_code, countryMap.get(row.origin_country_code) ?? row.origin_country_code, language)} language={language} showName size="sm" /></span>}{platform.markets.map((market) => <span key={market} className="rounded-full border border-cyan-300/20 bg-cyan-300/8 px-3 py-1 text-xs font-semibold text-cyan-200">{marketLabel(market, copy)}</span>)}</div>{(details?.ceo_name || details?.founded_at) && <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3"><SimpleFact label="CEO" value={details?.ceo_name ?? null} /><SimpleFact label={copy.founded} value={details?.founded_at ? formatFoundedDate(details.founded_at, locale) : null} /><SimpleFact label={copy.operating} value={details?.founded_at ? yearsOperating(details.founded_at, copy) : null} /></dl>}</div></div>
        <div className="flex flex-wrap items-center gap-3 lg:max-w-[310px] lg:justify-end">{platform.score !== null && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/8 px-4 py-2"><p className="text-[10px] uppercase tracking-wider text-emerald-300/70">{copy.score}</p><p className="font-mono text-2xl font-bold text-emerald-400">{platform.score}<span className="text-sm text-emerald-300/50"> / 10</span></p></div>}<Link href={ctaHref} className="inline-flex items-center gap-2 rounded-lg bg-[#f7c64b] px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-amber-950/20 transition hover:bg-[#ffd66c]">{ctaLabel}<ArrowUpRight className="size-4" /></Link></div>
      </div>
      </div>
    </section>

    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
      {activeView !== 'overview' && <FirmProfileNavigation sections={[]} name={platform.name} score={platform.score} logoUrl={platform.logoUrl} logoAlt={platform.logoAlt} ctaHref={ctaHref} ctaLabel={ctaLabel} language={language} />}
      <nav aria-label={copy.firmViews} className="mt-6 grid grid-cols-3 rounded-xl border border-white/10 bg-[#111c2e]/80 p-1.5 sm:inline-grid sm:min-w-[440px]">{[['overview', copy.overview], ['offers', copy.offers], ['payouts', copy.payouts]].map(([view, label]) => <Link key={view} href={`/prop-firms/${platform.slug}?view=${view}&lang=${encodeURIComponent(language)}`} aria-current={activeView === view ? 'page' : undefined} className={`rounded-lg px-3 py-2.5 text-center text-sm font-semibold transition ${activeView === view ? 'bg-cyan-300 text-slate-950 shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>{label}</Link>)}</nav>
      {activeView === 'overview' && <div className="grid gap-10 py-10 lg:grid-cols-[200px_minmax(0,1fr)] lg:py-14">
        <FirmProfileNavigation sections={sections} name={platform.name} score={platform.score} logoUrl={platform.logoUrl} logoAlt={platform.logoAlt} ctaHref={ctaHref} ctaLabel={ctaLabel} language={language} />
        <main className="min-w-0 space-y-6">
          <ProfileSection id="resumen" title={copy.overview}><p className="max-w-3xl text-base leading-7 text-slate-300">{description || firmProfileText(copy.fallbackDescription, { name: platform.name })}</p><dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3"><InfoStat icon={<Landmark className="size-4" />} label={copy.country} value={row.origin_country_code ? localizedCountryName(row.origin_country_code, countryMap.get(row.origin_country_code) ?? row.origin_country_code, language) : null} /><InfoStat icon={<CalendarDays className="size-4" />} label={copy.founded} value={details?.founded_at ? formatFoundedDate(details.founded_at, locale) : null} /><InfoStat icon={<Clock3 className="size-4" />} label={copy.operating} value={details?.founded_at ? yearsOperating(details.founded_at, copy) : null} /><InfoStat label={copy.market} value={platform.markets.map((market) => marketLabel(market, copy)).join(' · ') || null} /><InfoStat label={copy.maximumAccount} value={maximumAccountSize === null ? null : compactMoney(maximumAccountSize, copy, locale)} /><InfoStat label={copy.profitSplit} value={maximumRewardSplit === null ? null : firmProfileText(copy.upTo, { value: percent(maximumRewardSplit) })} /></dl></ProfileSection>
          {hasFirmInformation && <ProfileSection id="informacion" title={copy.generalInformation}><div className="grid gap-4 md:grid-cols-2"><TagCard icon={<Monitor className="size-5" />} title={copy.tradingPlatforms} values={tradingPlatformNames} /><TagCard icon={<CreditCard className="size-5" />} title={copy.paymentMethods} values={paymentMethodNames} /><TagCard icon={<HandCoins className="size-5" />} title={copy.payoutMethods} values={payoutMethodNames} /><TagCard icon={<CandlestickChart className="size-5" />} title={copy.instruments} values={instrumentNames} />{details?.broker_provider && <TagCard icon={<Landmark className="size-5" />} title={copy.broker} values={[details.broker_provider]} />}</div></ProfileSection>}
          {platform.markets.length > 0 && <ProfileSection id="mercados" title={copy.markets}><div className="flex flex-wrap gap-2">{platform.markets.map((market) => <Badge key={market}>{marketLabel(market, copy)}</Badge>)}</div></ProfileSection>}
          <ProfileSection id="reglas" title={copy.tradingRules}><div className="grid gap-3 sm:grid-cols-2">{[[copy.newsTrading, platform.allowsNews], [copy.automatedTrading, platform.supportsEa], [copy.copyTrading, platform.allowsCopyTrading], [copy.weekendHolding, platform.allowsWeekend], [copy.scalping, platform.allowsScalping], [copy.dayTrading, platform.allowsDayTrading]].map(([label, value]) => <RuleRow key={String(label)} label={String(label)} value={value as boolean | null} copy={copy} />)}{details?.inactivity_days !== null && details?.inactivity_days !== undefined && <TextRuleRow label={copy.inactivity} value={firmProfileText(copy.days, { count: details.inactivity_days })} />}</div>{details?.consistency_rules && <div className="mt-6 rounded-xl border border-white/8 bg-black/10 p-4"><h3 className="font-semibold">{copy.consistencyRule}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{details.consistency_rules}</p></div>}</ProfileSection>
          {resolvedChallenges.length > 0 && <ProfileSection id="desafios" title={copy.challenges}><div className="space-y-5">{resolvedChallenges.map((resolved) => <ChallengeDetails key={resolved.challenge.id} resolved={resolved} legacyPlans={plans.filter((plan) => plan.challenge_id === resolved.challenge.id)} copy={copy} locale={locale} />)}</div></ProfileSection>}
          {allRewardOptions.length > 0 && <ProfileSection id="retiros" title={copy.payoutPolicy}><div className="space-y-7">{resolvedChallenges.map((resolved) => <ProgramPayoutPolicy key={resolved.challenge.id} resolved={resolved} copy={copy} />)}</div></ProfileSection>}
          {restrictedCountries.length > 0 && <ProfileSection id="restricciones" title={copy.restrictedCountries}><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">{restrictedCountries.map((item) => <span key={item.country_code} className="rounded-md bg-white/[.04] px-3 py-2 text-sm text-slate-300">{localizedCountryName(item.country_code, countryMap.get(item.country_code) ?? item.country_code, language)}</span>)}</div></ProfileSection>}
        </main>
      </div>}

      {activeView === 'offers' && <main className="py-10 lg:py-14"><ViewHeading eyebrow={copy.activePromotions} title={copy.offers} description={firmProfileText(copy.offersDescription, { name: platform.name })} />{offersResult.data?.length ? <div className="mt-7 grid gap-5 md:grid-cols-2">{offersResult.data.map((offer) => <article key={offer.id} className="group relative overflow-hidden rounded-2xl border border-amber-300/15 bg-gradient-to-br from-amber-300/10 via-[#142036] to-[#101a2c] p-5 transition hover:-translate-y-0.5 hover:border-amber-300/30"><div className="absolute -right-8 -top-8 size-28 rounded-full bg-amber-300/8 blur-2xl" /><strong className="relative font-mono text-3xl font-bold text-[#f7c64b]">{offer.discount_type === 'percentage' ? firmProfileText(copy.percentageDiscount, { value: offer.discount_value }) : firmProfileText(copy.fixedDiscount, { value: offer.discount_value })} <span className="text-sm uppercase tracking-wider">{copy.off}</span></strong><h3 className="relative mt-4 text-lg font-bold">{offer.title}</h3>{offer.challenge_id && <p className="relative mt-1 text-sm text-slate-400">{challengeNames.get(offer.challenge_id) ?? copy.specificChallenge}</p>}{offer.promo_code && <p className="relative mt-4 inline-flex rounded-lg border border-white/10 bg-black/15 px-3 py-2 font-mono text-sm text-cyan-300">{copy.code}: {offer.promo_code}</p>}<Link href={publicPath(`/go/${platform.slug}`, language, { offer: offer.id })} className="relative mt-5 flex items-center justify-center gap-2 rounded-lg bg-[#f7c64b] px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-[#ffd66c]">{copy.getOffer} <ArrowUpRight className="size-4" /></Link></article>)}</div> : <EmptyState title={copy.noActiveOffers} description={copy.noActiveOffersHelp} />}</main>}

      {activeView === 'payouts' && <main className="py-10 lg:py-14"><ViewHeading eyebrow={copy.payoutTracker} title={copy.payments} description={firmProfileText(copy.payoutsDescription, { name: platform.name })} />{payoutDetail ? <FirmPayoutDashboard detail={payoutDetail} period={payoutPeriodKey} basePath={`/prop-firms/${platform.slug}`} language={language} embedded /> : <EmptyState title={copy.noActivity} description={copy.noActivityHelp} />}</main>}
    </div>
  </PublicPageShell>
}

function first<T>(value: T[] | T | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null }
function numberOrNull(value: unknown) { return value === null || value === undefined ? null : Number(value) }
function percent(value: unknown) { return value === null || value === undefined ? '—' : `${Number(value)}%` }
type FirmProfileCopy = (typeof publicFirmProfileCopy)[keyof typeof publicFirmProfileCopy]
function marketLabel(value: string, copy: FirmProfileCopy) { return (copy.marketsMap as Record<string, string>)[value] ?? value }
function Badge({ children }: { children: React.ReactNode }) { return <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">{children}</span> }
function ProfileSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) { return <section id={id} className="scroll-mt-24 rounded-2xl border border-white/10 bg-[#111c2e]/65 p-5 transition-colors hover:border-white/15 sm:p-7"><h2 className="mb-6 text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>{children}</section> }
function SimpleFact({ label, value }: { label: string; value: string | null }) { return value ? <div><dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-200">{value}</dd></div> : null }
function InfoStat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string | null }) { return value ? <div className="rounded-xl border border-white/8 bg-black/10 p-3.5"><dt className="flex items-center gap-2 text-xs text-slate-500">{icon}{label}</dt><dd className="mt-2 text-sm font-semibold text-slate-200">{value}</dd></div> : null }
function TagCard({ icon, title, values }: { icon: React.ReactNode; title: string; values: string[] }) { return values.length ? <article className="rounded-xl border border-white/8 bg-black/10 p-4 transition hover:border-cyan-300/20 hover:bg-white/[.035]"><div className="flex items-center gap-2 text-sm font-semibold text-slate-200"><span className="text-cyan-300">{icon}</span>{title}</div><div className="mt-4 flex flex-wrap gap-2">{values.map((value) => <Badge key={value}>{value}</Badge>)}</div></article> : null }
function RuleRow({ label, value, copy }: { label: string; value: boolean | null; copy: FirmProfileCopy }) { const Icon = value === true ? Check : value === false ? X : HelpCircle; const tone = value === true ? 'border-emerald-400/20 bg-emerald-400/8 text-emerald-300' : value === false ? 'border-rose-400/20 bg-rose-400/8 text-rose-300' : 'border-white/10 bg-white/5 text-slate-400'; return <div className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-black/10 p-3.5"><span className="text-sm text-slate-300">{label}</span><span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}><Icon className="size-3.5" />{value === true ? copy.allowed : value === false ? copy.notAllowed : copy.notKnown}</span></div> }
function TextRuleRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-black/10 p-3.5"><span className="text-sm text-slate-300">{label}</span><span className="text-sm font-semibold text-slate-200">{value}</span></div> }
function formatFoundedDate(value: string, locale: string) { return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) }
function yearsOperating(value: string, copy: FirmProfileCopy) { const founded = new Date(`${value}T00:00:00Z`); const now = new Date(); let years = now.getUTCFullYear() - founded.getUTCFullYear(); if (now.getUTCMonth() < founded.getUTCMonth() || (now.getUTCMonth() === founded.getUTCMonth() && now.getUTCDate() < founded.getUTCDate())) years--; const count = Math.max(0, years); return `${count} ${count === 1 ? copy.year : copy.years}` }
function ViewHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <header><p className="tg-eyebrow">{eyebrow}</p><h2 className="mt-2 text-3xl font-bold tracking-tight">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p></header> }
function EmptyState({ title, description }: { title: string; description: string }) { return <div className="tradagora-pattern tradagora-pattern-gold mt-7 rounded-2xl border border-dashed border-white/15 px-5 py-12 text-center"><p className="font-semibold text-slate-200">{title}</p><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{description}</p></div> }
function ChallengeDetails({ resolved, legacyPlans, copy, locale }: { resolved: ResolvedChallenge; legacyPlans: AccountPlan[]; copy: FirmProfileCopy; locale: string }) {
  const normalizedPlans = [...resolved.basePlans, ...resolved.variants.flatMap((variant) => variant.plans)]
  const visiblePlans: AccountPlan[] = resolved.hasNormalizedPhases ? normalizedPlans : legacyPlans
  const specificRewards = resolved.variants.flatMap((variant) => variant.rewardOptionsSource === 'specific' ? variant.rewardOptions : [])
  const allRewards = uniqueById([...resolved.generalRewardOptions, ...specificRewards])
  const splitValues = [
    ...allRewards.flatMap((option) => option.profit_split === null ? [] : [Number(option.profit_split)]),
    ...resolved.variants.flatMap((variant) => variant.profit_split === null ? [] : [Number(variant.profit_split)]),
    ...normalizedPlans.flatMap((plan) => plan.effectiveProfitSplit === null ? [] : [Number(plan.effectiveProfitSplit)]),
    ...legacyPlans.flatMap((plan) => plan.profit_split === null ? [] : [Number(plan.profit_split)]),
  ]
  const mainProfitSplit = splitValues.length ? Math.max(...splitValues) : null
  const evaluation = resolved.hasNormalizedPhases
    ? evaluationSummary(resolved.basePhases, copy)
    : legacyEvaluationSummary(legacyPlans)
  const hasPrices = visiblePlans.some((plan) => plan.price !== null)
  const withdrawalSummary = allRewards.length ? shortPayoutSummary(allRewards, copy).join(' · ') : copy.unconfirmed

  return <article className="rounded-xl border border-white/10 bg-black/10 p-4 transition hover:border-cyan-300/20 sm:p-5">
    <header className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-bold">{resolved.challenge.name}</h3><p className="mt-1 text-sm text-slate-500">{phaseCountLabel(resolved, copy)}</p></div><span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-400">{copy.challenge}</span></header>

    <div className="mt-5"><SectionLabel>{hasPrices ? copy.accountAndPrice : copy.accountSizes}</SectionLabel><AccountPlanSummary plans={visiblePlans} copy={copy} locale={locale} /></div>

    <div className="mt-5 grid grid-cols-2 gap-2.5 md:grid-cols-5">
      <SummaryMetric label={copy.target} value={evaluation.target} />
      <SummaryMetric label={copy.dailyLoss} value={evaluation.dailyDrawdown} />
      <SummaryMetric label={copy.maxLoss} value={evaluation.maxDrawdown} />
      <SummaryMetric label={copy.profitSplit} value={mainProfitSplit === null ? '—' : firmProfileText(copy.upTo, { value: percent(mainProfitSplit) })} accent />
      <SummaryMetric label={copy.withdrawal} value={withdrawalSummary} />
    </div>

    {resolved.variants.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{resolved.variants.map((variant) => <Badge key={variant.id}>{variant.name}{variant.profit_split !== null ? ` · ${percent(variant.profit_split)}` : ''}</Badge>)}</div>}
  </article>
}
function ProgramPayoutPolicy({ resolved, copy }: { resolved: ResolvedChallenge; copy: FirmProfileCopy }) {
  const options = uniqueById([
    ...resolved.generalRewardOptions,
    ...resolved.variants.flatMap((variant) => variant.rewardOptionsSource === 'specific' ? variant.rewardOptions : []),
  ])
  if (!options.length) return null
  return <article><h3 className="font-bold text-slate-100">{resolved.challenge.name}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{options.map((option) => <div key={option.id} className="rounded-xl border border-white/8 bg-black/10 p-4"><div className="border-l-2 border-emerald-400/60 pl-3"><p className="text-sm font-semibold">{option.name}</p>{option.profit_split !== null && <p className="mt-1 text-sm text-emerald-300">{percent(option.profit_split)} {copy.profitSplit.toLocaleLowerCase()}</p>}{shortPayoutSummary([option], copy).map((line) => <p key={line} className="mt-1 text-sm text-slate-400">{line}</p>)}{option.minimum_profitable_days !== null && option.minimum_profitable_days > 0 && <p className="mt-1 text-xs text-slate-500">{firmProfileText(copy.profitableDaysRequired, { count: option.minimum_profitable_days })}</p>}</div></div>)}</div></article>
}
function SectionLabel({ children }: { children: React.ReactNode }) { return <p className="tg-eyebrow mb-2">{children}</p> }

function AccountPlanSummary({ plans, copy, locale }: { plans: AccountPlan[]; copy: FirmProfileCopy; locale: string }) {
  const uniquePlans = [...new Map(plans.map((plan) => [`${plan.account_size ?? 'unknown'}:${plan.price ?? 'unknown'}:${plan.currency ?? ''}`, plan])).values()]
  if (!uniquePlans.length) return <p className="text-sm text-slate-500">{copy.plansPending}</p>
  const hasPrices = uniquePlans.some((plan) => plan.price !== null)
  return hasPrices ? <div className="overflow-hidden rounded-lg border border-white/8"><div className="grid grid-cols-2 bg-white/[.035] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><span>{copy.account}</span><span className="text-right">{copy.price}</span></div><div className="divide-y divide-white/8">{uniquePlans.map((plan) => <div key={`${plan.account_size}:${plan.price}:${plan.currency}`} className="grid grid-cols-2 gap-4 px-3 py-2.5"><p className="font-mono font-bold text-slate-100">{compactMoney(plan.account_size, copy, locale)}</p><p className="text-right text-sm font-semibold text-slate-300">{plan.price === null ? '—' : priceMoney(plan.price, plan.currency, copy, locale)}</p></div>)}</div></div> : <div className="flex flex-wrap gap-2">{uniquePlans.map((plan) => <span key={`${plan.account_size}:${plan.currency}`} className="rounded-lg bg-white/[.04] px-4 py-2.5 font-mono font-bold text-slate-100">{compactMoney(plan.account_size, copy, locale)}</span>)}</div>
}

function SummaryMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="rounded-lg border border-white/5 bg-white/[.035] p-3"><p className="text-[11px] text-slate-500">{label}</p><p className={`mt-1 text-sm font-semibold ${accent && value !== '—' ? 'text-emerald-400' : 'text-slate-200'}`}>{value}</p></div>
}

function shortPayoutSummary(options: ChallengeRewardOption[], copy: FirmProfileCopy) {
  if (options.length > 1) return [copy.optionsAvailable]
  const option = options[0]
  const frequency = option.payout_frequency?.trim() ?? ''
  const recurringBusinessDays = frequency.match(/^Every (\d+) business days$/i)
  if (recurringBusinessDays) return [firmProfileText(copy.everyBusinessDays, { count: recurringBusinessDays[1] })]
  const firstThenRecurring = frequency.match(/^First (\d+) days, then every (\d+) days$/i)
  if (firstThenRecurring) return [firmProfileText(copy.firstWithdrawal, { count: firstThenRecurring[1] }), firmProfileText(copy.thenEvery, { count: firstThenRecurring[2] })]
  if (frequency) return [frequency]
  if (option.minimum_payout_days !== null) return [firmProfileText(copy.minimumWait, { count: option.minimum_payout_days })]
  return [copy.conditionsInDetail]
}

function evaluationSummary(phases: EffectivePhase[], copy: FirmProfileCopy) {
  return {
    target: phaseMetric(phases, (phase) => phase.profitTarget, copy),
    dailyDrawdown: phaseMetric(phases, (phase) => phase.dailyDrawdown, copy),
    maxDrawdown: phaseMetric(phases, (phase) => phase.maxDrawdown, copy),
  }
}

function legacyEvaluationSummary(plans: AccountPlan[]) {
  return {
    target: uniqueMetric(plans.map((plan) => plan.profit_target)),
    dailyDrawdown: uniqueMetric(plans.map((plan) => plan.daily_drawdown)),
    maxDrawdown: uniqueMetric(plans.map((plan) => plan.max_drawdown)),
  }
}

function phaseMetric(phases: EffectivePhase[], select: (phase: EffectivePhase) => number | null, copy: FirmProfileCopy) {
  const values = phases.flatMap((phase) => select(phase) === null ? [] : [{ phase: phase.phaseNumber, value: select(phase)! }])
  if (!values.length) return '—'
  if (new Set(values.map((item) => item.value)).size === 1) return percent(values[0].value)
  return values.map((item) => `${firmProfileText(copy.phaseShort, { number: item.phase })} ${percent(item.value)}`).join(' · ')
}

function uniqueMetric(values: Array<number | null>) {
  const unique = [...new Set(values.flatMap((value) => value === null ? [] : [Number(value)]))]
  if (!unique.length) return '—'
  return unique.map(percent).join(' · ')
}

function phaseCountLabel(resolved: ResolvedChallenge, copy: FirmProfileCopy) {
  const count = resolved.basePhases.length || resolved.challenge.phases
  if (resolved.challenge.challenge_type === 'instant' || count === 0) return copy.instant
  if (count === null || count === undefined) return copy.phasesUnknown
  return firmProfileText(count === 1 ? copy.phase : copy.phases, { count })
}

function compactMoney(value: number | null, copy: FirmProfileCopy, locale: string) {
  if (value === null) return copy.sizeUnavailable
  if (value >= 1_000_000) return `$${Number((value / 1_000_000).toFixed(1))}M`
  if (value >= 1_000) return `$${Number((value / 1_000).toFixed(1))}K`
  return `$${value.toLocaleString(locale)}`
}

function priceMoney(value: number | null, currency: string | null, copy: FirmProfileCopy, locale: string) {
  if (value === null) return copy.priceUnavailable
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)
}

function uniqueById(options: ChallengeRewardOption[]) { return [...new Map(options.map((option) => [option.id, option])).values()] }
