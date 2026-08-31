import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowUpRight, Check, HelpCircle, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getHomeData, type HomePlatform } from '@/lib/home-data'
import { classifyPayoutVerification } from '@/lib/prop-firm-recommender'
import { resolvePublicLanguage } from '@/lib/language'
import { PlatformLogo } from '@/components/public/PlatformLogo'
import { PublicPageShell } from '@/components/public/PublicPageShell'

export const revalidate = 60

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ lang?: string | string[] }>
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
  const supabase = await createClient()

  const platformResult = await supabase.from('platforms').select(`
    id, name, slug, score, origin_country_code,
    media:logo_media_id (file_url, alt_text)
  `).eq('slug', slug).eq('type', 'prop_firm').eq('status', 'active').maybeSingle()
  if (!platformResult.data) notFound()
  const row = platformResult.data

  const [homeData, detailsResult, translationsResult, marketsResult, availabilityResult, countriesResult, challengesResult, plansResult, sourcesResult, payoutsResult, offersResult] = await Promise.all([
    getHomeData(language),
    supabase.from('prop_firm_details').select('*').eq('platform_id', row.id).maybeSingle(),
    supabase.from('platform_translations').select('language, short_description').eq('platform_id', row.id).in('language', [language, 'es']),
    supabase.from('platform_markets').select('market').eq('platform_id', row.id),
    supabase.from('platform_availability').select('country_code, status').eq('platform_id', row.id),
    supabase.from('countries').select('code, name'),
    supabase.from('challenges').select('id, name, challenge_type, phases, status').eq('platform_id', row.id).eq('status', 'active').order('name'),
    supabase.from('account_plans').select('id, challenge_id, account_size, price, profit_target, daily_drawdown, max_drawdown, profit_split').order('account_size'),
    supabase.from('payout_sources').select('id, name, source_type, config, status').eq('platform_id', row.id).eq('status', true),
    supabase.from('payouts').select('amount, payout_date', { count: 'exact' }).eq('platform_id', row.id).order('payout_date', { ascending: false }).range(0, 999),
    supabase.from('offers').select('id, title, description, discount_value, discount_type, promo_code, status').eq('platform_id', row.id).eq('status', true).order('priority'),
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
  const payoutRows = payoutsResult.data ?? []
  const payoutTotal = payoutRows.reduce((total, payout) => total + Number(payout.amount ?? 0), 0)
  const sources = sourcesResult.data ?? []
  const verification = classifyPayoutVerification(sources)
  const challenges = challengesResult.data ?? []
  const plans = plansResult.data ?? []

  return <PublicPageShell payouts={homeData.latestPayouts} language={language}>
    <section className="border-b border-white/8 bg-[radial-gradient(circle_at_top_right,rgba(22,201,180,.14),transparent_35%)]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_auto] lg:px-8 lg:py-24">
        <div><div className="flex items-center gap-4"><PlatformLogo platform={platform} /><div><p className="font-mono text-xs uppercase tracking-[.2em] text-cyan-300">Prop Firm</p><h1 className="mt-1 text-4xl font-bold tracking-tight sm:text-5xl">{platform.name}</h1></div></div><p className="mt-6 max-w-3xl text-lg leading-8 text-slate-400">{description || 'La descripción de esta firma está pendiente de completar.'}</p><div className="mt-6 flex flex-wrap gap-2">{platform.markets.length ? platform.markets.map((market) => <Badge key={market}>{marketLabel(market)}</Badge>) : <Badge>Mercados sin confirmar</Badge>}{platform.profitSplit !== null && <Badge>Hasta {platform.profitSplit}% profit split</Badge>}<Badge>{verification.label}</Badge></div></div>
        <div className="flex min-w-52 flex-col justify-center rounded-2xl border border-white/10 bg-[#111c2e] p-6"><span className="text-sm text-slate-500">Score público</span><strong className="mt-2 font-mono text-5xl text-emerald-400">{platform.score ?? '—'}</strong><Link href={`/go/${platform.slug}`} className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#f7c64b] px-5 py-3 font-bold text-slate-950">Visitar firma <ArrowUpRight className="size-4" /></Link></div>
      </div>
    </section>

    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:px-8">
      <Card title="Reglas de trading"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Rule label="EA / Bots" value={platform.supportsEa} /><Rule label="Noticias" value={platform.allowsNews} /><Rule label="Weekend holding" value={platform.allowsWeekend} /><Rule label="Scalping" value={platform.allowsScalping} /><Rule label="Day Trading" value={platform.allowsDayTrading} /><Rule label="Copy Trading" value={platform.allowsCopyTrading} /></div></Card>

      <Card title="Challenges y cuentas"><div className="space-y-5">{challenges.map((challenge) => { const challengePlans = plans.filter((plan) => plan.challenge_id === challenge.id); return <section key={challenge.id}><div className="mb-3"><h3 className="text-lg font-bold">{challenge.name}</h3><p className="text-sm text-slate-500">{challenge.challenge_type || 'Tipo no especificado'} · {challenge.phases ?? '—'} fases</p></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="border-b border-white/10 text-left text-slate-500"><tr><th className="p-3">Cuenta</th><th className="p-3">Precio</th><th className="p-3">Target</th><th className="p-3">Daily DD</th><th className="p-3">Max DD</th><th className="p-3">Split</th></tr></thead><tbody>{challengePlans.map((plan) => <tr key={plan.id} className="border-b border-white/5"><td className="p-3">{money(plan.account_size)}</td><td className="p-3">{money(plan.price)}</td><td className="p-3">{percent(plan.profit_target)}</td><td className="p-3">{percent(plan.daily_drawdown)}</td><td className="p-3">{percent(plan.max_drawdown)}</td><td className="p-3">{percent(plan.profit_split)}</td></tr>)}</tbody></table></div>{!challengePlans.length && <p className="text-sm text-slate-500">Planes pendientes de registrar.</p>}</section> })}{!challenges.length && <p className="text-slate-500">Challenges pendientes de registrar.</p>}</div></Card>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card title="Disponibilidad">{availability.length ? <div className="space-y-2">{availability.map((item) => <div key={item.country_code} className="flex justify-between gap-4 rounded-lg bg-white/5 p-3 text-sm"><span>{countryMap.get(item.country_code) ?? item.country_code}</span><span className={item.status === 'available' ? 'text-emerald-400' : item.status === 'restricted' ? 'text-rose-400' : 'text-slate-500'}>{item.status === 'available' ? 'Disponible' : item.status === 'restricted' ? 'Restringido' : 'Desconocido'}</span></div>)}</div> : <p className="text-slate-300">Global / sin restricciones específicas registradas</p>}{row.origin_country_code && <p className="mt-4 text-sm text-slate-500">País de origen: {countryMap.get(row.origin_country_code) ?? row.origin_country_code}</p>}</Card>
        <Card title="Payouts y verificación"><div className="grid grid-cols-3 gap-3"><Stat label="Payouts" value={String(payoutsResult.count ?? payoutRows.length)} /><Stat label="Rastreado" value={money(payoutTotal)} /><Stat label="Verificación" value={verification.label} /></div><div className="mt-5 space-y-2">{sources.map((source) => <p key={source.id} className="rounded-lg bg-white/5 p-3 text-sm">{source.name} · {source.source_type}</p>)}</div></Card>
      </div>

      {(details?.time_limit_policy || details?.consistency_rules || details?.special_rules) && <Card title="Políticas y reglas"><div className="grid gap-5 lg:grid-cols-3"><Policy title="Límite de tiempo" value={details.time_limit_policy} /><Policy title="Consistencia" value={details.consistency_rules} /><Policy title="Reglas especiales" value={details.special_rules} /></div></Card>}
      {!!offersResult.data?.length && <Card title="Ofertas activas"><div className="grid gap-4 md:grid-cols-2">{offersResult.data.map((offer) => <article key={offer.id} className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-5"><strong className="text-2xl text-[#f7c64b]">{offer.discount_value}{offer.discount_type === 'percentage' ? '%' : ' USD'}</strong><h3 className="mt-2 font-bold">{offer.title}</h3>{offer.description && <p className="mt-2 text-sm text-slate-400">{offer.description}</p>}{offer.promo_code && <p className="mt-3 font-mono text-sm text-cyan-300">Código: {offer.promo_code}</p>}</article>)}</div></Card>}
    </div>
  </PublicPageShell>
}

function first<T>(value: T[] | T | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null }
function numberOrNull(value: unknown) { return value === null || value === undefined ? null : Number(value) }
function money(value: unknown) { return value === null || value === undefined ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value)) }
function percent(value: unknown) { return value === null || value === undefined ? '—' : `${Number(value)}%` }
function marketLabel(value: string) { return ({ cfd: 'CFD / Forex', futures: 'Futures', crypto: 'Crypto', options: 'Options' } as Record<string, string>)[value] ?? value }
function Badge({ children }: { children: React.ReactNode }) { return <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">{children}</span> }
function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-white/10 bg-[#111c2e] p-6 sm:p-8"><h2 className="mb-6 text-2xl font-bold">{title}</h2>{children}</section> }
function Rule({ label, value }: { label: string; value: boolean | null }) { const Icon = value === true ? Check : value === false ? X : HelpCircle; const color = value === true ? 'text-emerald-400' : value === false ? 'text-rose-400' : 'text-slate-500'; return <div className="flex items-center gap-3 rounded-xl bg-white/5 p-4"><Icon className={`size-5 ${color}`} /><div><p className="font-semibold">{label}</p><p className={`text-sm ${color}`}>{value === true ? 'Permitido' : value === false ? 'No permitido' : 'No confirmado'}</p></div></div> }
function Stat({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div> }
function Policy({ title, value }: { title: string; value: string | null }) { return <div><h3 className="font-semibold">{title}</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-400">{value || 'Dato no disponible'}</p></div> }
