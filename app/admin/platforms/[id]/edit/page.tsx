'use client'

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PayoutMetricsManager } from '@/components/admin/PayoutMetricsManager'
import { PropFirmMatchSnapshotsManager } from '@/components/admin/PropFirmMatchSnapshotsManager'
import { MondoTradersMetricsPanel } from '@/components/admin/MondoTradersMetricsPanel'

type NullableBoolean = boolean | null
type Market = 'cfd' | 'futures' | 'crypto' | 'options'
type AvailabilityStatus = 'available' | 'restricted' | 'unknown'
type Media = { id: string; file_name: string; file_url: string; alt_text: string | null }
type Country = { code: string; name: string }
type PayoutSource = { id: string; name: string; source_type: string; status: boolean; config: Record<string, unknown> | null }
type Challenge = { id: string; name: string; challenge_type: string | null; status: string; planCount: number }
type Offer = { id: string; title: string; status: boolean }
type CatalogItem = { id: string; name: string; status: boolean }
type MethodSelection = { supportsDeposit: boolean; supportsPayout: boolean }

const MARKET_OPTIONS: Array<{ value: Market; label: string }> = [
  { value: 'cfd', label: 'CFD / Forex' }, { value: 'futures', label: 'Futures' },
  { value: 'crypto', label: 'Crypto' }, { value: 'options', label: 'Options' },
]
const INPUT = 'w-full rounded-lg border p-3'
const BUTTON = 'inline-flex rounded-lg bg-black px-4 py-2 text-sm font-medium text-white'
const SECONDARY_BUTTON = 'rounded-lg border px-4 py-2 text-center text-sm font-medium'
const supabase = createClient()

export default function EditPlatformPage() {
  const id = useParams().id as string
  const router = useRouter()
  const [name, setName] = useState(''), [slug, setSlug] = useState(''), [description, setDescription] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState(''), [logoMediaId, setLogoMediaId] = useState('')
  const [status, setStatus] = useState('active'), [score, setScore] = useState(''), [originCountryCode, setOriginCountryCode] = useState('')
  const [media, setMedia] = useState<Media[]>([]), [countries, setCountries] = useState<Country[]>([])
  const [profitSplitMin, setProfitSplitMin] = useState(''), [profitSplitMax, setProfitSplitMax] = useState('')
  const [supportsEa, setSupportsEa] = useState<NullableBoolean>(null), [allowsNews, setAllowsNews] = useState<NullableBoolean>(null)
  const [allowsWeekend, setAllowsWeekend] = useState<NullableBoolean>(null), [allowsScalping, setAllowsScalping] = useState<NullableBoolean>(null)
  const [allowsDayTrading, setAllowsDayTrading] = useState<NullableBoolean>(null), [allowsCopyTrading, setAllowsCopyTrading] = useState<NullableBoolean>(null)
  const [timeLimitPolicy, setTimeLimitPolicy] = useState(''), [consistencyRules, setConsistencyRules] = useState(''), [specialRules, setSpecialRules] = useState('')
  const [ceoName, setCeoName] = useState(''), [foundedAt, setFoundedAt] = useState(''), [brokerProvider, setBrokerProvider] = useState(''), [inactivityDays, setInactivityDays] = useState('')
  const [markets, setMarkets] = useState<Market[]>([]), [initialMarkets, setInitialMarkets] = useState<Market[]>([])
  const [tradingPlatforms, setTradingPlatforms] = useState<CatalogItem[]>([]), [selectedTradingPlatforms, setSelectedTradingPlatforms] = useState<string[]>([]), [initialTradingPlatforms, setInitialTradingPlatforms] = useState<string[]>([])
  const [transactionMethods, setTransactionMethods] = useState<CatalogItem[]>([]), [selectedMethods, setSelectedMethods] = useState<Record<string, MethodSelection>>({})
  const [instrumentCategories, setInstrumentCategories] = useState<CatalogItem[]>([]), [selectedInstruments, setSelectedInstruments] = useState<string[]>([]), [initialInstruments, setInitialInstruments] = useState<string[]>([])
  const [availability, setAvailability] = useState<Record<string, AvailabilityStatus>>({}), [initialAvailabilityCodes, setInitialAvailabilityCodes] = useState<string[]>([])
  const [countrySearch, setCountrySearch] = useState(''), [payoutSources, setPayoutSources] = useState<PayoutSource[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([]), [offers, setOffers] = useState<Offer[]>([])
  const [affiliateLinkCount, setAffiliateLinkCount] = useState(0)
  const [payoutSummary, setPayoutSummary] = useState({ count: 0, total: 0, latest: '' })
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState('')

  const visibleCountries = useMemo(() => {
    const search = countrySearch.trim().toLocaleLowerCase('es')
    return search ? countries.filter((country) => `${country.name} ${country.code}`.toLocaleLowerCase('es').includes(search)) : countries
  }, [countries, countrySearch])

  useEffect(() => {
    async function load() {
      const platformResult = await supabase.from('platforms').select('*').eq('id', id).single()
      if (platformResult.error || !platformResult.data) { setError(platformResult.error?.message ?? 'No se pudo cargar la Prop Firm.'); setLoading(false); return }
      const platform = platformResult.data
      setName(platform.name); setSlug(platform.slug); setWebsiteUrl(platform.website_url ?? ''); setStatus(platform.status)
      setLogoMediaId(platform.logo_media_id ?? ''); setScore(platform.score?.toString() ?? ''); setOriginCountryCode(platform.origin_country_code ?? '')

      const results = await Promise.all([
        supabase.from('prop_firm_details').select('*').eq('platform_id', id).maybeSingle(),
        supabase.from('platform_translations').select('short_description').eq('platform_id', id).eq('language', 'es').maybeSingle(),
        supabase.from('media').select('id, file_name, file_url, alt_text').order('created_at', { ascending: false }),
        supabase.from('countries').select('code, name').order('name'),
        supabase.from('platform_availability').select('country_code, status').eq('platform_id', id),
        supabase.from('platform_markets').select('market').eq('platform_id', id),
        supabase.from('payout_sources').select('id, name, source_type, status, config').eq('platform_id', id),
        supabase.from('payouts').select('amount, payout_date', { count: 'exact' }).eq('platform_id', id).order('payout_date', { ascending: false }).range(0, 999),
        supabase.from('challenges').select('id, name, challenge_type, status').eq('platform_id', id).order('name'),
        supabase.from('account_plans').select('challenge_id'),
        supabase.from('offers').select('id, title, status').eq('platform_id', id).order('created_at', { ascending: false }),
        supabase.from('affiliate_links').select('id', { count: 'exact', head: true }).eq('platform_id', id),
        supabase.from('trading_platforms').select('id, name, status').order('name'),
        supabase.from('platform_trading_platforms').select('trading_platform_id').eq('platform_id', id),
        supabase.from('transaction_methods').select('id, name, status').order('name'),
        supabase.from('platform_transaction_methods').select('transaction_method_id, supports_deposit, supports_payout').eq('platform_id', id),
        supabase.from('instrument_categories').select('id, name, status').order('name'),
        supabase.from('platform_instruments').select('instrument_category_id').eq('platform_id', id),
      ])
      const [detailsResult, translationResult, mediaResult, countriesResult, availabilityResult, marketsResult, sourcesResult, payoutsResult, challengesResult, plansResult, offersResult, linksResult, tradingPlatformsResult, platformTradingResult, transactionMethodsResult, platformMethodsResult, instrumentsResult, platformInstrumentsResult] = results
      const details = detailsResult.data
      if (details) {
        setProfitSplitMin(details.profit_split_min?.toString() ?? ''); setProfitSplitMax(details.profit_split_max?.toString() ?? '')
        setSupportsEa(details.supports_ea ?? null); setAllowsNews(details.allows_news_trading ?? null); setAllowsWeekend(details.allows_weekend_holding ?? null)
        setAllowsScalping(details.allows_scalping ?? null); setAllowsDayTrading(details.allows_day_trading ?? null); setAllowsCopyTrading(details.allows_copy_trading ?? null)
        setTimeLimitPolicy(details.time_limit_policy ?? ''); setConsistencyRules(details.consistency_rules ?? ''); setSpecialRules(details.special_rules ?? '')
        setCeoName(details.ceo_name ?? ''); setFoundedAt(details.founded_at ?? ''); setBrokerProvider(details.broker_provider ?? ''); setInactivityDays(details.inactivity_days?.toString() ?? '')
      }
      setDescription(translationResult.data?.short_description ?? ''); setMedia(mediaResult.data ?? []); setCountries(countriesResult.data ?? [])
      const availabilityEntries = Object.fromEntries(
        (availabilityResult.data ?? []).map((item) => [
          item.country_code,
          item.status as AvailabilityStatus,
        ])
      )
      setAvailability(availabilityEntries); setInitialAvailabilityCodes(Object.keys(availabilityEntries))
      const selectedMarkets = (marketsResult.data ?? []).map((item) => item.market as Market)
      setMarkets(selectedMarkets); setInitialMarkets(selectedMarkets); setPayoutSources((sourcesResult.data ?? []) as PayoutSource[])
      const planCounts = new Map<string, number>(); for (const plan of plansResult.data ?? []) planCounts.set(plan.challenge_id, (planCounts.get(plan.challenge_id) ?? 0) + 1)
      setChallenges((challengesResult.data ?? []).map((challenge) => ({ ...challenge, planCount: planCounts.get(challenge.id) ?? 0 })))
      setOffers((offersResult.data ?? []) as Offer[]); setAffiliateLinkCount(linksResult.count ?? 0)
      setTradingPlatforms((tradingPlatformsResult.data ?? []) as CatalogItem[])
      const tradingIds = (platformTradingResult.data ?? []).map((item) => item.trading_platform_id); setSelectedTradingPlatforms(tradingIds); setInitialTradingPlatforms(tradingIds)
      setTransactionMethods((transactionMethodsResult.data ?? []) as CatalogItem[])
      setSelectedMethods(Object.fromEntries((platformMethodsResult.data ?? []).map((item) => [item.transaction_method_id, { supportsDeposit: item.supports_deposit, supportsPayout: item.supports_payout }])))
      setInstrumentCategories((instrumentsResult.data ?? []) as CatalogItem[])
      const instrumentIds = (platformInstrumentsResult.data ?? []).map((item) => item.instrument_category_id); setSelectedInstruments(instrumentIds); setInitialInstruments(instrumentIds)
      const rows = payoutsResult.data ?? []; setPayoutSummary({ count: payoutsResult.count ?? rows.length, total: rows.reduce((sum, payout) => sum + Number(payout.amount ?? 0), 0), latest: rows[0]?.payout_date ?? '' })
      const firstError = results.find((result) => result.error)?.error; if (firstError) setError(firstError.message)
      setLoading(false)
    }
    load()
  }, [id])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    const fail = (message: string) => { setError(message); setSaving(false); return false }
    if (inactivityDays.trim() && (!Number.isInteger(Number(inactivityDays)) || Number(inactivityDays) < 0)) return void fail('Los días de inactividad deben ser un número entero igual o mayor que cero.')
    const platformResult = await supabase.from('platforms').update({ name, slug, website_url: websiteUrl || null, logo_media_id: logoMediaId || null, status, score: numberOrNull(score), origin_country_code: originCountryCode || null }).eq('id', id)
    if (platformResult.error) return void fail(platformResult.error.message)
    const detailResult = await supabase.from('prop_firm_details').upsert({ platform_id: id, ceo_name: textOrNull(ceoName), founded_at: textOrNull(foundedAt), broker_provider: textOrNull(brokerProvider), inactivity_days: nonNegativeIntegerOrNull(inactivityDays), profit_split_min: numberOrNull(profitSplitMin), profit_split_max: numberOrNull(profitSplitMax), supports_ea: supportsEa, allows_news_trading: allowsNews, allows_weekend_holding: allowsWeekend, allows_scalping: allowsScalping, allows_day_trading: allowsDayTrading, allows_copy_trading: allowsCopyTrading, time_limit_policy: textOrNull(timeLimitPolicy), consistency_rules: textOrNull(consistencyRules), special_rules: textOrNull(specialRules) }, { onConflict: 'platform_id' })
    if (detailResult.error) return void fail(detailResult.error.message)
    const translationResult = await supabase.from('platform_translations').upsert({ platform_id: id, language: 'es', short_description: description }, { onConflict: 'platform_id,language' })
    if (translationResult.error) return void fail(translationResult.error.message)
    if (!await syncRelations('platform_markets', 'market', initialMarkets, markets, (market) => ({ platform_id: id, market }), fail)) return
    if (!await syncRelations('platform_trading_platforms', 'trading_platform_id', initialTradingPlatforms, selectedTradingPlatforms, (tradingPlatformId) => ({ platform_id: id, trading_platform_id: tradingPlatformId }), fail)) return
    if (!await syncRelations('platform_instruments', 'instrument_category_id', initialInstruments, selectedInstruments, (instrumentCategoryId) => ({ platform_id: id, instrument_category_id: instrumentCategoryId }), fail)) return
    const methodRows = Object.entries(selectedMethods).filter(([, method]) => method.supportsDeposit || method.supportsPayout)
    const selectedMethodIds = methodRows.map(([methodId]) => methodId)
    const methodUpsert = methodRows.length ? await supabase.from('platform_transaction_methods').upsert(methodRows.map(([methodId, method]) => ({ platform_id: id, transaction_method_id: methodId, supports_deposit: method.supportsDeposit, supports_payout: method.supportsPayout })), { onConflict: 'platform_id,transaction_method_id' }) : null
    if (methodUpsert?.error) return void fail(methodUpsert.error.message)
    const methodDelete = selectedMethodIds.length
      ? await supabase.from('platform_transaction_methods').delete().eq('platform_id', id).not('transaction_method_id', 'in', `(${selectedMethodIds.join(',')})`)
      : await supabase.from('platform_transaction_methods').delete().eq('platform_id', id)
    if (methodDelete.error) return void fail(methodDelete.error.message)
    const availabilityCodes = Object.keys(availability)
    const removedCountries = initialAvailabilityCodes.filter((code) => !availabilityCodes.includes(code))
    if (removedCountries.length) {
      const removeResult = await supabase.from('platform_availability').delete().eq('platform_id', id).in('country_code', removedCountries)
      if (removeResult.error) return void fail(removeResult.error.message)
    }
    if (availabilityCodes.length) {
      const availabilityResult = await supabase.from('platform_availability').upsert(
        availabilityCodes.map((countryCode) => ({ platform_id: id, country_code: countryCode, status: availability[countryCode] })),
        { onConflict: 'platform_id,country_code' }
      )
      if (availabilityResult.error) return void fail(availabilityResult.error.message)
    }
    router.push('/admin/platforms'); router.refresh()
  }

  async function syncRelations<T extends string>(table: string, column: string, initial: T[], current: T[], row: (value: T) => Record<string, unknown>, fail: (message: string) => boolean) {
    const removed = initial.filter((value) => !current.includes(value)), added = current.filter((value) => !initial.includes(value))
    if (removed.length) { const result = await supabase.from(table).delete().eq('platform_id', id).in(column, removed); if (result.error) return fail(result.error.message) }
    if (added.length) { const result = await supabase.from(table).insert(added.map(row)); if (result.error) return fail(result.error.message) }
    return true
  }

  async function removePlatform() {
    if (!window.confirm('¿Seguro que quieres eliminar esta Prop Firm? Esta acción no se puede deshacer.')) return
    const result = await supabase.from('platforms').delete().eq('id', id)
    if (result.error) { setError(result.error.message); return }
    router.push('/admin/platforms'); router.refresh()
  }

  if (loading) return <main className="min-h-screen bg-slate-100 p-8"><p>Cargando...</p></main>
  const selectedMedia = media.find((item) => item.id === logoMediaId)

  return <main className="min-h-screen bg-slate-100 p-8"><div className="mx-auto max-w-6xl">
    <div className="mb-8"><h1 className="text-3xl font-bold">Editar Prop Firm</h1><p className="mt-1 text-slate-500">Modifica la información administrable de {name}.</p></div>
    <form onSubmit={submit} className="space-y-8 rounded-xl bg-white p-8 shadow">
      <Section title="Información general" description="Identidad, estado, origen y presentación pública." />
      <div className="grid gap-5 md:grid-cols-2"><Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} className={INPUT} required /></Field><Field label="Slug"><input value={slug} onChange={(e) => setSlug(e.target.value)} className={INPUT} required /></Field><Field label="Sitio web"><input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className={INPUT} /></Field><Field label="Estado"><select value={status} onChange={(e) => setStatus(e.target.value)} className={INPUT}><option value="active">Activa</option><option value="draft">Borrador</option><option value="inactive">Inactiva</option></select></Field><Field label="País de origen"><select value={originCountryCode} onChange={(e) => setOriginCountryCode(e.target.value)} className={INPUT}><option value="">No especificado</option>{countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select><Hint>No afecta la disponibilidad geográfica.</Hint></Field></div>
      <div className="grid gap-5 md:grid-cols-2"><Field label="CEO"><input value={ceoName} onChange={(e) => setCeoName(e.target.value)} className={INPUT} /></Field><Field label="Fecha de fundación"><input type="date" value={foundedAt} onChange={(e) => setFoundedAt(e.target.value)} className={INPUT} /></Field><Field label="Broker / proveedor de liquidez"><input value={brokerProvider} onChange={(e) => setBrokerProvider(e.target.value)} className={INPUT} /></Field><Field label="Días de inactividad"><input type="number" min="0" step="1" value={inactivityDays} onChange={(e) => setInactivityDays(e.target.value)} className={INPUT} /></Field></div>
      <Field label="Descripción"><textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${INPUT} min-h-32`} /></Field>
      <Field label="Logo"><select value={logoMediaId} onChange={(e) => setLogoMediaId(e.target.value)} className={INPUT}><option value="">Sin logo</option>{media.map((item) => <option key={item.id} value={item.id}>{item.file_name}</option>)}</select>{selectedMedia && <div className="mt-3 flex items-center gap-4"><MediaPreview media={selectedMedia} /><span className="text-sm text-slate-500">{selectedMedia.file_name}</span></div>}</Field>

      <Section title="Plataformas de trading" description="Catálogo oficial asociado explícitamente a la firma." />
      <CatalogChecklist items={tradingPlatforms} selected={selectedTradingPlatforms} onToggle={(catalogId) => setSelectedTradingPlatforms((current) => toggleId(current, catalogId))} />

      <Section title="Métodos" description="Indica si cada método oficial admite depósitos, retiros o ambos." />
      <div className="grid gap-3 md:grid-cols-2">{transactionMethods.map((method) => { const selection = selectedMethods[method.id] ?? { supportsDeposit: false, supportsPayout: false }; return <div key={method.id} className="rounded-lg border p-4"><p className="font-medium">{method.name}{!method.status && <span className="ml-2 text-xs text-slate-400">Inactivo</span>}</p><div className="mt-3 flex gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={selection.supportsDeposit} onChange={(event) => setSelectedMethods((current) => ({ ...current, [method.id]: { ...selection, supportsDeposit: event.target.checked } }))} />Depósito</label><label className="flex items-center gap-2"><input type="checkbox" checked={selection.supportsPayout} onChange={(event) => setSelectedMethods((current) => ({ ...current, [method.id]: { ...selection, supportsPayout: event.target.checked } }))} />Retiro</label></div></div> })}</div>

      <Section title="Instrumentos" description="Categorías generales disponibles; no representa símbolos individuales." />
      <CatalogChecklist items={instrumentCategories} selected={selectedInstruments} onToggle={(catalogId) => setSelectedInstruments((current) => toggleId(current, catalogId))} />

      <Section title="Mercados disponibles" description="Relaciones múltiples en platform_markets." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{MARKET_OPTIONS.map((option) => <label key={option.value} className="flex items-center gap-3 rounded-lg border p-4"><input type="checkbox" checked={markets.includes(option.value)} onChange={() => setMarkets((current) => current.includes(option.value) ? current.filter((value) => value !== option.value) : [...current, option.value])} />{option.label}</label>)}</div>

      <Section title="Reglas de trading" description="Desconocido se guarda como null y nunca cuenta como compatible." />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"><NullableSelect label="EA / Bots" value={supportsEa} onChange={setSupportsEa} /><NullableSelect label="Noticias" value={allowsNews} onChange={setAllowsNews} /><NullableSelect label="Weekend holding" value={allowsWeekend} onChange={setAllowsWeekend} /><NullableSelect label="Scalping" value={allowsScalping} onChange={setAllowsScalping} /><NullableSelect label="Copy Trading" value={allowsCopyTrading} onChange={setAllowsCopyTrading} /></div>

      <Section title="Challenges y cuentas" description="Usa los administradores existentes para editar challenges y planes." />
      <Link href={`/admin/challenges/platform/${id}`} className={SECONDARY_BUTTON}>Ver todos los challenges de {name}</Link>
      <div className="space-y-3">{challenges.map((challenge) => <div key={challenge.id} className="flex flex-col justify-between gap-3 rounded-xl border bg-slate-50 p-4 sm:flex-row sm:items-center"><div><p className="font-semibold">{challenge.name}</p><Hint>{challenge.challenge_type || 'Tipo pendiente'} · {challenge.planCount} {challenge.planCount === 1 ? 'plan' : 'planes'} · {challenge.status}</Hint></div><Link href={`/admin/challenges/${challenge.id}`} className="rounded-lg border bg-white px-4 py-2 text-center text-sm font-medium">Gestionar</Link></div>)}{!challenges.length && <p className="rounded-xl border border-dashed p-5 text-sm text-slate-500">No hay challenges asociados.</p>}</div>
      <Link href={`/admin/challenges/new?platform=${id}`} className={BUTTON}>+ Nuevo Challenge</Link>

      <details className="rounded-xl border bg-slate-50 p-5"><summary className="cursor-pointer text-lg font-semibold">Opciones avanzadas</summary><p className="mt-1 text-sm text-slate-500">Datos editoriales, disponibilidad detallada, integraciones y campos secundarios.</p><div className="mt-6 space-y-7 border-t pt-6">
      <div className="grid gap-5 md:grid-cols-2"><Field label="Score público"><input type="number" min="0" max="10" step="0.1" value={score} onChange={(e) => setScore(e.target.value)} className={INPUT} /></Field><NullableSelect label="Day Trading" value={allowsDayTrading} onChange={setAllowsDayTrading} /></div>

      <Section title="Políticas y reglas" description="Texto informativo que el recomendador no convierte en puntuación." />
      <div className="grid gap-5 lg:grid-cols-3"><Field label="Política de límite de tiempo"><textarea value={timeLimitPolicy} onChange={(e) => setTimeLimitPolicy(e.target.value)} className={`${INPUT} min-h-32`} /></Field><Field label="Reglas de consistencia"><textarea value={consistencyRules} onChange={(e) => setConsistencyRules(e.target.value)} className={`${INPUT} min-h-32`} /></Field><Field label="Reglas especiales"><textarea value={specialRules} onChange={(e) => setSpecialRules(e.target.value)} className={`${INPUT} min-h-32`} /></Field></div>

      <Section title="Resumen económico legacy" description="Resumen editorial conservado; las condiciones normalizadas viven en challenges y rewards." />
      <div className="grid gap-5 sm:grid-cols-2"><Field label="Profit Split mínimo %"><input type="number" step="0.01" value={profitSplitMin} onChange={(e) => setProfitSplitMin(e.target.value)} className={INPUT} /></Field><Field label="Profit Split máximo %"><input type="number" step="0.01" value={profitSplitMax} onChange={(e) => setProfitSplitMax(e.target.value)} className={INPUT} /></Field></div>

      <Section title="Disponibilidad geográfica" description="Global equivale a ausencia de filas en platform_availability." />
      <div className="grid gap-3 sm:grid-cols-2"><Choice active={!Object.keys(availability).length} label="Global" onChange={() => setAvailability({})} /><Choice active={Object.keys(availability).length > 0} label="Países específicos" onChange={() => setAvailability(countries[0] ? { [countries[0].code]: 'unknown' } : {})} /></div>
      {!!Object.keys(availability).length && <div className="space-y-4"><input type="search" value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)} placeholder="Buscar país o código…" className={INPUT} /><div className="grid max-h-96 gap-3 overflow-y-auto rounded-xl border p-3 lg:grid-cols-2">{visibleCountries.map((country) => { const selected = country.code in availability; return <div key={country.code} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"><label className="flex flex-1 items-center gap-3"><input type="checkbox" checked={selected} onChange={(e) => setAvailability((current) => { const next = { ...current }; if (e.target.checked) next[country.code] = 'unknown'; else delete next[country.code]; return next })} />{country.name}</label>{selected && <select value={availability[country.code]} onChange={(e) => setAvailability((current) => ({ ...current, [country.code]: e.target.value as AvailabilityStatus }))} className="rounded-lg border p-2 text-sm"><option value="available">Disponible</option><option value="restricted">Restringido / No disponible</option><option value="unknown">Desconocido</option></select>}</div>})}</div><Hint>{Object.keys(availability).length} países configurados.</Hint></div>}

      <Section title="Payouts y verificación" description="Información de solo lectura; no modifica la ingesta." />
      <div className="grid gap-4 sm:grid-cols-3"><Summary label="Total payouts" value={payoutSummary.count.toLocaleString('es-CO')} /><Summary label="Total rastreado" value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(payoutSummary.total)} /><Summary label="Último payout" value={payoutSummary.latest ? new Date(payoutSummary.latest).toLocaleDateString('es-CO') : '—'} /></div>
      <div className="space-y-3">{payoutSources.map((source) => <div key={source.id} className="flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"><div><p className="font-semibold">{source.name}</p><Hint>{source.source_type} · {String(source.config?.verification ?? 'sin verificación')} · {source.status ? 'Activa' : 'Inactiva'}</Hint></div><Link href={`/admin/payouts?source=${source.id}`} className={SECONDARY_BUTTON}>Ver monitoreo</Link></div>)}{!payoutSources.length && <Hint>Sin fuentes asociadas.</Hint>}</div><Link href="/admin/payouts" className={BUTTON}>Gestionar fuentes</Link>

      <Section title="Ofertas" description="Promociones asociadas a esta Prop Firm." /><div className="space-y-2">{offers.map((offer) => <div key={offer.id} className="flex justify-between rounded-lg border p-3 text-sm"><span>{offer.title}</span><span>{offer.status ? 'Activa' : 'Inactiva'}</span></div>)}{!offers.length && <Hint>Sin ofertas asociadas.</Hint>}</div><Link href="/admin/offers" className={BUTTON}>Gestionar ofertas</Link>
      <Section title="Afiliados" description="Enlaces existentes utilizados por /go/[slug]." /><Summary label="Enlaces configurados" value={String(affiliateLinkCount)} /><Link href="/admin/affiliate-links" className={BUTTON}>Gestionar afiliados</Link>
      </div></details>

      {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>}
      <div className="flex flex-col justify-between gap-3 border-t pt-6 sm:flex-row"><button type="button" onClick={removePlatform} className="rounded-lg border border-red-300 px-5 py-3 text-red-600">Eliminar</button><div className="flex gap-3"><button type="button" onClick={() => router.push('/admin/platforms')} className={SECONDARY_BUTTON}>Cancelar</button><button type="submit" disabled={saving} className={`${BUTTON} disabled:opacity-50`}>{saving ? 'Guardando...' : 'Guardar cambios'}</button></div></div>
    </form>
    <details className="mt-8 rounded-xl bg-white p-6 shadow"><summary className="cursor-pointer text-xl font-semibold">MondoTraders · Métricas externas</summary><p className="mt-2 mb-6 text-sm text-slate-500">Referencia externa por periodo. Estos agregados nunca se suman con los payouts verificados por Tradagora.</p><MondoTradersMetricsPanel platformId={id} /></details>
    <details className="mt-8 rounded-xl bg-white p-6 shadow"><summary className="cursor-pointer text-xl font-semibold">Prop Firm Match · Payout Tracker</summary><p className="mt-2 mb-6 text-sm text-slate-500">Fallback administrativo por periodo. Cada guardado crea un snapshot nuevo y conserva el anterior como histórico.</p><PropFirmMatchSnapshotsManager platformId={id} /></details>
    <details className="mt-8 rounded-xl bg-white p-6 shadow"><summary className="cursor-pointer text-xl font-semibold">Payout metrics</summary><p className="mt-2 mb-6 text-sm text-slate-500">Agregados oficiales o externos. No se insertan como payouts individuales y siempre conservan su fuente.</p><PayoutMetricsManager platformId={id} /></details>
  </div></main>
}

function Section({ title, description }: { title: string; description: string }) { return <div className="border-b pb-3 pt-2"><h2 className="text-xl font-semibold">{title}</h2><Hint>{description}</Hint></div> }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span>{children}</label> }
function Hint({ children }: { children: ReactNode }) { return <p className="mt-1 text-sm text-slate-500">{children}</p> }
function NullableSelect({ label, value, onChange }: { label: string; value: NullableBoolean; onChange: (value: NullableBoolean) => void }) { return <Field label={label}><select value={value === null ? 'unknown' : String(value)} onChange={(e) => onChange(e.target.value === 'unknown' ? null : e.target.value === 'true')} className={INPUT}><option value="unknown">Desconocido</option><option value="true">Sí</option><option value="false">No</option></select></Field> }
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-slate-50 p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div> }
function Choice({ active, label, onChange }: { active: boolean; label: string; onChange: () => void }) { return <label className={`rounded-lg border p-4 ${active ? 'border-black bg-slate-100' : ''}`}><input type="radio" name="availability" checked={active} onChange={onChange} className="mr-3" />{label}</label> }
function CatalogChecklist({ items, selected, onToggle }: { items: CatalogItem[]; selected: string[]; onToggle: (id: string) => void }) { return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{items.map((item) => <label key={item.id} className="flex items-center gap-3 rounded-lg border p-4"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} /><span>{item.name}{!item.status && <span className="ml-2 text-xs text-slate-400">Inactivo</span>}</span></label>)}{!items.length && <Hint>El catálogo estará disponible después de ejecutar la migración.</Hint>}</div> }
function MediaPreview({ media }: { media: Media }) {
  // Las URLs dinámicas son administradas por la biblioteca de medios de Supabase.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={media.file_url} alt={media.alt_text || media.file_name} className="size-20 rounded-lg border object-contain" />
}
function numberOrNull(value: string) { return value.trim() ? Number(value) : null }
function nonNegativeIntegerOrNull(value: string) { return value.trim() ? Number(value) : null }
function textOrNull(value: string) { return value.trim() || null }
function toggleId(values: string[], id: string) { return values.includes(id) ? values.filter((value) => value !== id) : [...values, id] }
