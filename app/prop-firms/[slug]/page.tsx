import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowUpRight, CalendarDays, CandlestickChart, Check, Clock3, CreditCard, HandCoins, HelpCircle, Landmark, Monitor, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getHomeData, type HomePlatform } from '@/lib/home-data'
import { resolvePublicLanguage } from '@/lib/language'
import { PlatformLogo } from '@/components/public/PlatformLogo'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { resolveChallenge, type AccountPlan, type ChallengePhase, type ChallengeRewardOption, type ChallengeVariant, type ChallengeVariantPhase, type EffectivePhase, type ResolvedChallenge } from '@/lib/challenge-resolver'
import { FirmProfileNavigation, type FirmSection } from './_components/FirmProfileNavigation'

export const revalidate = 60

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ lang?: string | string[]; view?: string | string[] }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('platforms').select('name').eq('slug', slug).maybeSingle()
  return data ? { title: `${data.name} | Tradagora`, description: `Condiciones, reglas, cuentas y payouts verificados de ${data.name}.` } : {}
}

export default async function PropFirmDetailPage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const language = await resolvePublicLanguage(query.lang)
  const requestedView = Array.isArray(query.view) ? query.view[0] : query.view
  const activeView = requestedView === 'offers' || requestedView === 'payouts' ? requestedView : 'overview'
  const supabase = await createClient()

  const platformResult = await supabase.from('platforms').select(`
    id, name, slug, score, origin_country_code, website_url,
    media:logo_media_id (file_url, alt_text)
  `).eq('slug', slug).eq('type', 'prop_firm').eq('status', 'active').maybeSingle()
  if (!platformResult.data) notFound()
  const row = platformResult.data

  const [homeData, detailsResult, translationsResult, marketsResult, availabilityResult, countriesResult, challengesResult, payoutMetricsResult, offersResult, tradingPlatformsResult, transactionMethodsResult, instrumentsResult] = await Promise.all([
    getHomeData(language),
    supabase.from('prop_firm_details').select('*').eq('platform_id', row.id).maybeSingle(),
    supabase.from('platform_translations').select('language, short_description').eq('platform_id', row.id).in('language', [language, 'es']),
    supabase.from('platform_markets').select('market').eq('platform_id', row.id),
    supabase.from('platform_availability').select('country_code, status').eq('platform_id', row.id),
    supabase.from('countries').select('code, name'),
    supabase.from('challenges').select('id, name, challenge_type, phases, status').eq('platform_id', row.id).eq('status', 'active').order('name'),
    supabase.from('platform_payout_period_summary').select('*').eq('platform_id', row.id).eq('period_key', 'all').maybeSingle(),
    supabase.from('offers').select('id, challenge_id, title, description, discount_value, discount_type, promo_code, status').eq('platform_id', row.id).eq('status', true).order('priority'),
    supabase.from('platform_trading_platforms').select('catalog:trading_platform_id(name)').eq('platform_id', row.id),
    supabase.from('platform_transaction_methods').select('supports_deposit, supports_payout, catalog:transaction_method_id(name)').eq('platform_id', row.id),
    supabase.from('platform_instruments').select('catalog:instrument_category_id(name)').eq('platform_id', row.id),
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
  const restrictedCountries = availability.filter((item) => item.status === 'restricted')
  const payoutMetrics = payoutMetricsResult.data
  const usesExternalMetrics = payoutMetrics?.display_total_amount !== null && payoutMetrics?.display_total_amount !== undefined
  const payoutTotal = usesExternalMetrics ? payoutMetrics.display_total_amount : payoutMetrics?.verified_amount
  const payoutCount = usesExternalMetrics ? payoutMetrics?.known_payout_count : payoutMetrics?.verified_payout_count
  const largestPayout = usesExternalMetrics ? payoutMetrics?.known_largest_payout : payoutMetrics?.verified_largest_payout
  const averagePayout = usesExternalMetrics ? payoutMetrics?.known_average_payout : payoutMetrics?.verified_average_payout
  const challenges = challengesResult.data ?? []
  const challengeIds = challenges.map((challenge) => challenge.id)
  const visibleAt = new Date().toISOString()
  const [plansResult, phasesResult, variantsResult, rewardOptionsResult] = challengeIds.length ? await Promise.all([
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
  const ctaHref = primaryOffer ? `/go/${platform.slug}?offer=${primaryOffer.id}&lang=${encodeURIComponent(language)}` : `/go/${platform.slug}`
  const ctaLabel = primaryOffer ? 'Ver oferta' : `Visitar ${platform.name}`
  const sections: FirmSection[] = [
    { id: 'resumen', label: 'Resumen' },
    ...(hasFirmInformation ? [{ id: 'informacion', label: 'Información' }] : []),
    ...(platform.markets.length ? [{ id: 'mercados', label: 'Mercados' }] : []),
    { id: 'reglas', label: 'Reglas' },
    ...(resolvedChallenges.length ? [{ id: 'desafios', label: 'Desafíos' }] : []),
    ...(allRewardOptions.length ? [{ id: 'retiros', label: 'Retiros' }] : []),
    ...(restrictedCountries.length ? [{ id: 'restricciones', label: 'Restricciones' }] : []),
  ]

  return <PublicPageShell payouts={homeData.latestPayouts} language={language}>
    <section id="firm-hero" className="bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.12),transparent_38%)]">
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-10 lg:px-8">
      <div className="grid gap-7 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#152238] to-[#0d1728] p-5 shadow-[0_24px_70px_rgba(0,0,0,.18)] sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex min-w-0 items-start gap-4 sm:gap-5"><div className="rounded-2xl border border-white/10 bg-white/5 p-1"><PlatformLogo platform={platform} /></div><div className="min-w-0"><p className="font-mono text-[11px] uppercase tracking-[.22em] text-cyan-300">Prop Firm</p><h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-5xl">{platform.name}</h1><div className="mt-3 flex flex-wrap items-center gap-2">{row.origin_country_code && <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{countryMap.get(row.origin_country_code) ?? row.origin_country_code}</span>}{platform.markets.map((market) => <span key={market} className="rounded-full border border-cyan-300/20 bg-cyan-300/8 px-3 py-1 text-xs font-semibold text-cyan-200">{marketLabel(market)}</span>)}</div>{(details?.ceo_name || details?.founded_at) && <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3"><SimpleFact label="CEO" value={details?.ceo_name ?? null} /><SimpleFact label="Fundada" value={details?.founded_at ? formatFoundedDate(details.founded_at) : null} /><SimpleFact label="Operando" value={details?.founded_at ? yearsOperating(details.founded_at) : null} /></dl>}</div></div>
        <div className="flex flex-wrap items-center gap-3 lg:max-w-[310px] lg:justify-end">{platform.score !== null && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/8 px-4 py-2"><p className="text-[10px] uppercase tracking-wider text-emerald-300/70">Score</p><p className="font-mono text-2xl font-bold text-emerald-400">{platform.score}<span className="text-sm text-emerald-300/50"> / 10</span></p></div>}{row.website_url && <Link href={row.website_url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/15 px-4 py-3 text-sm font-semibold transition hover:border-white/30 hover:bg-white/5">Sitio oficial</Link>}<Link href={ctaHref} className="inline-flex items-center gap-2 rounded-lg bg-[#f7c64b] px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-[#ffd66c]">{ctaLabel}<ArrowUpRight className="size-4" /></Link></div>
      </div>
      </div>
    </section>

    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {activeView !== 'overview' && <FirmProfileNavigation sections={[]} name={platform.name} score={platform.score} logoUrl={platform.logoUrl} logoAlt={platform.logoAlt} ctaHref={ctaHref} ctaLabel={ctaLabel} />}
      <nav aria-label="Vistas de la firma" className="mt-6 grid grid-cols-3 rounded-xl border border-white/10 bg-[#111c2e]/80 p-1.5 sm:inline-grid sm:min-w-[440px]">{[['overview', 'Overview'], ['offers', 'Offers'], ['payouts', 'Payouts']].map(([view, label]) => <Link key={view} href={`/prop-firms/${platform.slug}?view=${view}&lang=${encodeURIComponent(language)}`} aria-current={activeView === view ? 'page' : undefined} className={`rounded-lg px-3 py-2.5 text-center text-sm font-semibold transition ${activeView === view ? 'bg-cyan-300 text-slate-950 shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>{label}</Link>)}</nav>
      {activeView === 'overview' && <div className="grid gap-10 py-10 lg:grid-cols-[200px_minmax(0,1fr)] lg:py-14">
        <FirmProfileNavigation sections={sections} name={platform.name} score={platform.score} logoUrl={platform.logoUrl} logoAlt={platform.logoAlt} ctaHref={ctaHref} ctaLabel={ctaLabel} />
        <main className="min-w-0 space-y-6">
          <ProfileSection id="resumen" title="Resumen"><p className="max-w-3xl text-base leading-7 text-slate-300">{description || `Consulta las condiciones y datos disponibles de ${platform.name}.`}</p><dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3"><InfoStat icon={<Landmark className="size-4" />} label="País" value={row.origin_country_code ? countryMap.get(row.origin_country_code) ?? row.origin_country_code : null} /><InfoStat icon={<CalendarDays className="size-4" />} label="Fundada" value={details?.founded_at ? formatFoundedDate(details.founded_at) : null} /><InfoStat icon={<Clock3 className="size-4" />} label="Operando" value={details?.founded_at ? yearsOperating(details.founded_at) : null} /><InfoStat label="Mercado" value={platform.markets.map(marketLabel).join(' · ') || null} /><InfoStat label="Cuenta máxima" value={maximumAccountSize === null ? null : compactMoney(maximumAccountSize)} /><InfoStat label="Profit split" value={maximumRewardSplit === null ? null : `Hasta ${percent(maximumRewardSplit)}`} /></dl></ProfileSection>
          {hasFirmInformation && <ProfileSection id="informacion" title="Información general"><div className="grid gap-4 md:grid-cols-2"><TagCard icon={<Monitor className="size-5" />} title="Trading Platforms" values={tradingPlatformNames} /><TagCard icon={<CreditCard className="size-5" />} title="Payment Methods" values={paymentMethodNames} /><TagCard icon={<HandCoins className="size-5" />} title="Payout Methods" values={payoutMethodNames} /><TagCard icon={<CandlestickChart className="size-5" />} title="Instruments" values={instrumentNames} />{details?.broker_provider && <TagCard icon={<Landmark className="size-5" />} title="Broker" values={[details.broker_provider]} />}</div></ProfileSection>}
          {platform.markets.length > 0 && <ProfileSection id="mercados" title="Mercados"><div className="flex flex-wrap gap-2">{platform.markets.map((market) => <Badge key={market}>{marketLabel(market)}</Badge>)}</div></ProfileSection>}
          <ProfileSection id="reglas" title="Reglas de trading"><div className="grid gap-3 sm:grid-cols-2">{[['News trading', platform.allowsNews], ['EA / Automated Trading', platform.supportsEa], ['Copy trading', platform.allowsCopyTrading], ['Weekend holding', platform.allowsWeekend], ['Scalping', platform.allowsScalping], ['Day trading', platform.allowsDayTrading]].map(([label, value]) => <RuleRow key={String(label)} label={String(label)} value={value as boolean | null} />)}{details?.inactivity_days !== null && details?.inactivity_days !== undefined && <TextRuleRow label="Inactividad" value={`${details.inactivity_days} días`} />}</div>{details?.consistency_rules && <div className="mt-6 rounded-xl border border-white/8 bg-black/10 p-4"><h3 className="font-semibold">Regla de consistencia</h3><p className="mt-2 text-sm leading-6 text-slate-400">{details.consistency_rules}</p></div>}</ProfileSection>
          {resolvedChallenges.length > 0 && <ProfileSection id="desafios" title="Desafíos"><div className="space-y-5">{resolvedChallenges.map((resolved) => <ChallengeDetails key={resolved.challenge.id} resolved={resolved} legacyPlans={plans.filter((plan) => plan.challenge_id === resolved.challenge.id)} />)}</div></ProfileSection>}
          {allRewardOptions.length > 0 && <ProfileSection id="retiros" title="Política de retiros"><div className="space-y-7">{resolvedChallenges.map((resolved) => <ProgramPayoutPolicy key={resolved.challenge.id} resolved={resolved} />)}</div></ProfileSection>}
          {restrictedCountries.length > 0 && <ProfileSection id="restricciones" title="Países restringidos"><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">{restrictedCountries.map((item) => <span key={item.country_code} className="rounded-md bg-white/[.04] px-3 py-2 text-sm text-slate-300">{countryMap.get(item.country_code) ?? item.country_code}</span>)}</div></ProfileSection>}
        </main>
      </div>}

      {activeView === 'offers' && <main className="py-10 lg:py-14"><ViewHeading eyebrow="Promociones activas" title="Ofertas" description={`Beneficios disponibles actualmente para comenzar con ${platform.name}.`} />{offersResult.data?.length ? <div className="mt-7 grid gap-5 md:grid-cols-2">{offersResult.data.map((offer) => <article key={offer.id} className="group relative overflow-hidden rounded-2xl border border-amber-300/15 bg-gradient-to-br from-amber-300/10 via-[#142036] to-[#101a2c] p-5 transition hover:-translate-y-0.5 hover:border-amber-300/30"><div className="absolute -right-8 -top-8 size-28 rounded-full bg-amber-300/8 blur-2xl" /><strong className="relative font-mono text-3xl font-bold text-[#f7c64b]">{offer.discount_value}{offer.discount_type === 'percentage' ? '%' : ' USD'} <span className="text-sm uppercase tracking-wider">OFF</span></strong><h3 className="relative mt-4 text-lg font-bold">{offer.title}</h3>{offer.challenge_id && <p className="relative mt-1 text-sm text-slate-400">{challengeNames.get(offer.challenge_id) ?? 'Challenge específico'}</p>}{offer.promo_code && <p className="relative mt-4 inline-flex rounded-lg border border-white/10 bg-black/15 px-3 py-2 font-mono text-sm text-cyan-300">Código: {offer.promo_code}</p>}<Link href={`/go/${platform.slug}?offer=${offer.id}&lang=${encodeURIComponent(language)}`} className="relative mt-5 flex items-center justify-center gap-2 rounded-lg bg-[#f7c64b] px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-[#ffd66c]">Obtener oferta <ArrowUpRight className="size-4" /></Link></article>)}</div> : <EmptyState title="No hay ofertas activas" description="Cuando haya una promoción disponible, aparecerá aquí con sus condiciones y código." />}</main>}

      {activeView === 'payouts' && <main className="py-10 lg:py-14"><ViewHeading eyebrow="Payout tracker" title="Pagos" description={`Métricas rastreadas de los pagos publicados por ${platform.name}.`} />{payoutMetrics ? <><div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">{payoutTotal !== null && payoutTotal !== undefined && <MetricCard label="Total pagado" value={money(payoutTotal)} accent />}{payoutCount !== null && payoutCount !== undefined && <MetricCard label="Nº pagos" value={integer(payoutCount)} />}{largestPayout !== null && largestPayout !== undefined && <MetricCard label="Mayor pago" value={money(largestPayout)} />}{averagePayout !== null && averagePayout !== undefined && <MetricCard label="Promedio" value={money(averagePayout)} />}</div><div className="mt-5 flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#111c2e]/70 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-slate-200">Fuente de la métrica</p><p className="mt-1 text-xs text-slate-500">{usesExternalMetrics ? publicMetricSourceName(payoutMetrics.display_total_source_name) : 'Payouts verificados por Tradagora'}.</p></div><Link href={`/payouts/${platform.slug}?lang=${encodeURIComponent(language)}`} className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-cyan-300 transition hover:text-cyan-200">Ver análisis completo <ArrowUpRight className="size-4" /></Link></div></> : <EmptyState title="Aún no hay métricas" description="Las métricas aparecerán cuando existan datos públicos o payouts verificados para esta firma." />}</main>}
    </div>
  </PublicPageShell>
}

function first<T>(value: T[] | T | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null }
function numberOrNull(value: unknown) { return value === null || value === undefined ? null : Number(value) }
function money(value: unknown) { return value === null || value === undefined ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value)) }
function percent(value: unknown) { return value === null || value === undefined ? '—' : `${Number(value)}%` }
function marketLabel(value: string) { return ({ cfd: 'CFD / Forex', futures: 'Futures', crypto: 'Crypto', options: 'Options' } as Record<string, string>)[value] ?? value }
function integer(value: unknown) { return value === null || value === undefined ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(value)) }
function Badge({ children }: { children: React.ReactNode }) { return <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">{children}</span> }
function ProfileSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) { return <section id={id} className="scroll-mt-24 rounded-2xl border border-white/10 bg-[#111c2e]/65 p-5 transition-colors hover:border-white/15 sm:p-7"><h2 className="mb-6 text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>{children}</section> }
function SimpleFact({ label, value }: { label: string; value: string | null }) { return value ? <div><dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-200">{value}</dd></div> : null }
function InfoStat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string | null }) { return value ? <div className="rounded-xl border border-white/8 bg-black/10 p-3.5"><dt className="flex items-center gap-2 text-xs text-slate-500">{icon}{label}</dt><dd className="mt-2 text-sm font-semibold text-slate-200">{value}</dd></div> : null }
function TagCard({ icon, title, values }: { icon: React.ReactNode; title: string; values: string[] }) { return values.length ? <article className="rounded-xl border border-white/8 bg-black/10 p-4 transition hover:border-cyan-300/20 hover:bg-white/[.035]"><div className="flex items-center gap-2 text-sm font-semibold text-slate-200"><span className="text-cyan-300">{icon}</span>{title}</div><div className="mt-4 flex flex-wrap gap-2">{values.map((value) => <Badge key={value}>{value}</Badge>)}</div></article> : null }
function RuleRow({ label, value }: { label: string; value: boolean | null }) { const Icon = value === true ? Check : value === false ? X : HelpCircle; const tone = value === true ? 'border-emerald-400/20 bg-emerald-400/8 text-emerald-300' : value === false ? 'border-rose-400/20 bg-rose-400/8 text-rose-300' : 'border-white/10 bg-white/5 text-slate-400'; return <div className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-black/10 p-3.5"><span className="text-sm text-slate-300">{label}</span><span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}><Icon className="size-3.5" />{value === true ? 'Permitido' : value === false ? 'No permitido' : 'N/D'}</span></div> }
function TextRuleRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-black/10 p-3.5"><span className="text-sm text-slate-300">{label}</span><span className="text-sm font-semibold text-slate-200">{value}</span></div> }
function formatFoundedDate(value: string) { return new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) }
function yearsOperating(value: string) { const founded = new Date(`${value}T00:00:00Z`); const now = new Date(); let years = now.getUTCFullYear() - founded.getUTCFullYear(); if (now.getUTCMonth() < founded.getUTCMonth() || (now.getUTCMonth() === founded.getUTCMonth() && now.getUTCDate() < founded.getUTCDate())) years--; return `${Math.max(0, years)} ${years === 1 ? 'año' : 'años'}` }
function publicMetricSourceName(value: string | null) { return /mondo[\s-]*traders?/i.test(value ?? '') ? 'Seguimiento externo' : value || 'Métrica externa rastreada' }
function MetricCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) { return <div className="rounded-2xl border border-white/10 bg-[#111c2e]/75 p-4 sm:p-5"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-2 font-mono text-xl font-bold sm:text-2xl ${accent ? 'text-emerald-400' : 'text-slate-100'}`}>{value}</p></div> }
function ViewHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <header><p className="font-mono text-xs uppercase tracking-[.18em] text-cyan-300">{eyebrow}</p><h2 className="mt-2 text-3xl font-bold tracking-tight">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p></header> }
function EmptyState({ title, description }: { title: string; description: string }) { return <div className="mt-7 rounded-2xl border border-dashed border-white/15 bg-white/[.025] px-5 py-12 text-center"><p className="font-semibold text-slate-200">{title}</p><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{description}</p></div> }
function ChallengeDetails({ resolved, legacyPlans }: { resolved: ResolvedChallenge; legacyPlans: AccountPlan[] }) {
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
    ? evaluationSummary(resolved.basePhases)
    : legacyEvaluationSummary(legacyPlans)
  const hasPrices = visiblePlans.some((plan) => plan.price !== null)
  const withdrawalSummary = allRewards.length ? shortPayoutSummary(allRewards).join(' · ') : 'No confirmado'

  return <article className="rounded-xl border border-white/10 bg-black/10 p-4 transition hover:border-cyan-300/20 sm:p-5">
    <header className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-bold">{resolved.challenge.name}</h3><p className="mt-1 text-sm text-slate-500">{phaseCountLabel(resolved)}</p></div><span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-400">Challenge</span></header>

    <div className="mt-5"><SectionLabel>{hasPrices ? 'Cuenta y precio' : 'Tamaños de cuenta'}</SectionLabel><AccountPlanSummary plans={visiblePlans} /></div>

    <div className="mt-5 grid grid-cols-2 gap-2.5 md:grid-cols-5">
      <SummaryMetric label="Target" value={evaluation.target} />
      <SummaryMetric label="Daily loss" value={evaluation.dailyDrawdown} />
      <SummaryMetric label="Max loss" value={evaluation.maxDrawdown} />
      <SummaryMetric label="Profit split" value={mainProfitSplit === null ? '—' : `Hasta ${percent(mainProfitSplit)}`} accent />
      <SummaryMetric label="Retiro" value={withdrawalSummary} />
    </div>

    {resolved.variants.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{resolved.variants.map((variant) => <Badge key={variant.id}>{variant.name}{variant.profit_split !== null ? ` · ${percent(variant.profit_split)}` : ''}</Badge>)}</div>}
  </article>
}
function ProgramPayoutPolicy({ resolved }: { resolved: ResolvedChallenge }) {
  const options = uniqueById([
    ...resolved.generalRewardOptions,
    ...resolved.variants.flatMap((variant) => variant.rewardOptionsSource === 'specific' ? variant.rewardOptions : []),
  ])
  if (!options.length) return null
  return <article><h3 className="font-bold text-slate-100">{resolved.challenge.name}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{options.map((option) => <div key={option.id} className="rounded-xl border border-white/8 bg-black/10 p-4"><div className="border-l-2 border-emerald-400/60 pl-3"><p className="text-sm font-semibold">{option.name}</p>{option.profit_split !== null && <p className="mt-1 text-sm text-emerald-300">{percent(option.profit_split)} profit split</p>}{shortPayoutSummary([option]).map((line) => <p key={line} className="mt-1 text-sm text-slate-400">{line}</p>)}{option.minimum_profitable_days !== null && option.minimum_profitable_days > 0 && <p className="mt-1 text-xs text-slate-500">Requiere {option.minimum_profitable_days} días rentables</p>}</div></div>)}</div></article>
}
function SectionLabel({ children }: { children: React.ReactNode }) { return <p className="mb-2 font-mono text-xs uppercase tracking-[.16em] text-cyan-300">{children}</p> }

function AccountPlanSummary({ plans }: { plans: AccountPlan[] }) {
  const uniquePlans = [...new Map(plans.map((plan) => [`${plan.account_size ?? 'unknown'}:${plan.price ?? 'unknown'}:${plan.currency ?? ''}`, plan])).values()]
  if (!uniquePlans.length) return <p className="text-sm text-slate-500">Tamaños y precios pendientes de registrar.</p>
  const hasPrices = uniquePlans.some((plan) => plan.price !== null)
  return hasPrices ? <div className="overflow-hidden rounded-lg border border-white/8"><div className="grid grid-cols-2 bg-white/[.035] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><span>Account</span><span className="text-right">Price</span></div><div className="divide-y divide-white/8">{uniquePlans.map((plan) => <div key={`${plan.account_size}:${plan.price}:${plan.currency}`} className="grid grid-cols-2 gap-4 px-3 py-2.5"><p className="font-mono font-bold text-slate-100">{compactMoney(plan.account_size)}</p><p className="text-right text-sm font-semibold text-slate-300">{plan.price === null ? '—' : priceMoney(plan.price, plan.currency)}</p></div>)}</div></div> : <div className="flex flex-wrap gap-2">{uniquePlans.map((plan) => <span key={`${plan.account_size}:${plan.currency}`} className="rounded-lg bg-white/[.04] px-4 py-2.5 font-mono font-bold text-slate-100">{compactMoney(plan.account_size)}</span>)}</div>
}

function SummaryMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="rounded-lg border border-white/5 bg-white/[.035] p-3"><p className="text-[11px] text-slate-500">{label}</p><p className={`mt-1 text-sm font-semibold ${accent && value !== '—' ? 'text-emerald-400' : 'text-slate-200'}`}>{value}</p></div>
}

function shortPayoutSummary(options: ChallengeRewardOption[]) {
  if (options.length > 1) return ['Opciones de retiro disponibles']
  const option = options[0]
  const frequency = option.payout_frequency?.trim() ?? ''
  const recurringBusinessDays = frequency.match(/^Every (\d+) business days$/i)
  if (recurringBusinessDays) return [`Cada ${recurringBusinessDays[1]} días hábiles`]
  const firstThenRecurring = frequency.match(/^First (\d+) days, then every (\d+) days$/i)
  if (firstThenRecurring) return [`Primer retiro: ${firstThenRecurring[1]} días`, `Después: cada ${firstThenRecurring[2]} días`]
  if (frequency) return [frequency]
  if (option.minimum_payout_days !== null) return [`Espera mínima: ${option.minimum_payout_days} días`]
  return ['Condiciones disponibles en el detalle']
}

function evaluationSummary(phases: EffectivePhase[]) {
  return {
    target: phaseMetric(phases, (phase) => phase.profitTarget),
    dailyDrawdown: phaseMetric(phases, (phase) => phase.dailyDrawdown),
    maxDrawdown: phaseMetric(phases, (phase) => phase.maxDrawdown),
  }
}

function legacyEvaluationSummary(plans: AccountPlan[]) {
  return {
    target: uniqueMetric(plans.map((plan) => plan.profit_target)),
    dailyDrawdown: uniqueMetric(plans.map((plan) => plan.daily_drawdown)),
    maxDrawdown: uniqueMetric(plans.map((plan) => plan.max_drawdown)),
  }
}

function phaseMetric(phases: EffectivePhase[], select: (phase: EffectivePhase) => number | null) {
  const values = phases.flatMap((phase) => select(phase) === null ? [] : [{ phase: phase.phaseNumber, value: select(phase)! }])
  if (!values.length) return '—'
  if (new Set(values.map((item) => item.value)).size === 1) return percent(values[0].value)
  return values.map((item) => `F${item.phase} ${percent(item.value)}`).join(' · ')
}

function uniqueMetric(values: Array<number | null>) {
  const unique = [...new Set(values.flatMap((value) => value === null ? [] : [Number(value)]))]
  if (!unique.length) return '—'
  return unique.map(percent).join(' · ')
}

function phaseCountLabel(resolved: ResolvedChallenge) {
  const count = resolved.basePhases.length || resolved.challenge.phases
  if (resolved.challenge.challenge_type === 'instant' || count === 0) return 'Instant'
  if (count === null || count === undefined) return 'Número de fases no confirmado'
  return `${count} ${count === 1 ? 'fase' : 'fases'}`
}

function compactMoney(value: number | null) {
  if (value === null) return 'Tamaño no disponible'
  if (value >= 1_000_000) return `$${Number((value / 1_000_000).toFixed(1))}M`
  if (value >= 1_000) return `$${Number((value / 1_000).toFixed(1))}K`
  return `$${value.toLocaleString('en-US')}`
}

function priceMoney(value: number | null, currency: string | null) {
  if (value === null) return 'Precio no disponible'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)
}

function uniqueById(options: ChallengeRewardOption[]) { return [...new Map(options.map((option) => [option.id, option])).values()] }
