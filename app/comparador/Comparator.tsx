'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight, Check, Copy, Info, SlidersHorizontal } from 'lucide-react'
import { CountryFlag } from '@/components/shared/CountryFlag'
import { SearchInput } from '@/components/shared/SearchInput'
import { buildComparisonInsights, findComparablePlans, formatSize, valuesDiffer, type ComparisonFirm, type ComparisonPlan, type Priority } from '@/lib/comparison-engine'
import type { FirmChoice } from '@/lib/comparison-data'
import type { MatchResult } from '@/lib/preference-matches'

type Initial = { plans: string[]; size: string; priorities: string[]; styles: string[]; market: string; budget: string; platform: string; mode: 'personal' | 'firms'; showMatches: boolean; differences: boolean }
type Row = { label: string; values: Array<string | number | null>; hint?: string }
const priorityLabels: Record<Priority, string> = { price: 'Precio bajo', payout: 'Payout rápido', drawdown: 'Drawdown', split: 'Profit split', platform: 'Plataforma', rules: 'Reglas simples' }
const card = 'rounded-2xl border border-amber-300/15 bg-[#111e2e] p-4 sm:p-5'
const button = 'rounded-xl border border-amber-300/20 px-4 py-2.5 text-sm text-slate-200 hover:border-amber-300/50 focus-visible:outline-2 focus-visible:outline-amber-300'
const missing = (value: string | number | null | undefined) => value === null || value === undefined || value === '' ? 'Sin dato' : String(value)
const percentage = (value: number | null) => value === null ? null : `${value}%`
const money = (value: number | null, currency: string | null) => value === null ? null : `${currency ?? 'Moneda sin dato'} ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}`
const phases = (plan: ComparisonPlan | null, key: 'profitTarget' | 'dailyDrawdown' | 'maxDrawdown') => plan?.phases.map((phase) => phase[key] === null ? `F${phase.phaseNumber}: Sin dato` : `F${phase.phaseNumber}: ${phase[key]}%`).join(' · ') ?? null
const normalizedSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')

function FirmLogo({ url, name, size = 36 }: { url: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  return url && !failed
    ? <Image unoptimized src={url} alt="" width={size} height={size} onError={() => setFailed(true)} className="size-9 shrink-0 rounded-lg bg-white object-contain p-1" />
    : <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 font-semibold">{name.slice(0, 2).toUpperCase()}</span>
}

export function Comparator({ choices, firms, initial, filterOptions, matching }: { choices: FirmChoice[]; firms: ComparisonFirm[]; initial: Initial; filterOptions: { sizes: number[]; platforms: string[] }; matching: { results: MatchResult[]; hasExactRequirements: boolean } }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, startTransition] = useTransition()
  const [showMore, setShowMore] = useState(false)
  const [chosen, setChosen] = useState<string[]>(() => matching.results.slice(0, 3).map((result) => result.firm.slug))
  const [manualAddition, setManualAddition] = useState('')
  const priorities = initial.priorities.filter((value): value is Priority => value in priorityLabels && value !== 'rules').slice(0, 3)
  const styles = initial.styles.filter((value): value is 'ea' | 'news' | 'weekend' => ['ea', 'news', 'weekend'].includes(value))
  const size = initial.size && Number.isFinite(Number(initial.size)) ? Number(initial.size) : null
  const budget = initial.budget && Number.isFinite(Number(initial.budget)) ? Number(initial.budget) : null
  const selectedIds = firms.map((firm) => firm.slug)
  const match = useMemo(() => findComparablePlans(firms, size, initial.plans), [firms, size, initial.plans])
  const insights = useMemo(() => buildComparisonInsights(firms, match.plans, priorities, initial.platform || null), [firms, match.plans, priorities, initial.platform])
  const allSizes = initial.mode === 'personal' ? filterOptions.sizes : [...new Set(firms.flatMap((firm) => firm.plans.flatMap((plan) => plan.size === null ? [] : [plan.size])))].sort((a, b) => a - b)
  const allMarkets = [...new Set(choices.flatMap((firm) => firm.markets))].sort()
  const allPlatforms = initial.mode === 'personal' ? filterOptions.platforms : [...new Set(firms.flatMap((firm) => firm.tradingPlatforms))].sort()
  const candidates = choices.filter((firm) => !selectedIds.includes(firm.slug) && normalizedSearch(firm.name).includes(normalizedSearch(search)) && (!initial.market || firm.markets.includes(initial.market))).slice(0, 20)

  function update(changes: Record<string, string | null>) {
    const url = new URL(window.location.href)
    for (const [key, value] of Object.entries(changes)) { if (value) url.searchParams.set(key, value); else url.searchParams.delete(key) }
    if (`${url.pathname}${url.search}` === `${window.location.pathname}${window.location.search}`) return
    startTransition(() => router.push(`${url.pathname}${url.search}`, { scroll: false }))
  }
  function selectFirm(index: number, slug: string) {
    const next = [...selectedIds]
    if (index >= next.length) next.push(slug)
    else next[index] = slug
    const nextPlans = match.plans.map((plan) => plan?.id ?? '')
    nextPlans[index] = ''
    update({ firms: [...new Set(next)].slice(0, 3).join(','), plans: nextPlans.join(',') })
  }
  function removeFirm(index: number) {
    update({ firms: selectedIds.filter((_, position) => position !== index).join(','), plans: match.plans.filter((_, position) => position !== index).map((plan) => plan?.id ?? '').join(',') })
  }
  async function share() {
    const link = window.location.href
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      const input = document.createElement('textarea')
      input.value = link
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.append(input)
      input.select()
      const success = document.execCommand('copy')
      input.remove()
      setCopied(success)
      if (!success) window.prompt('Copia el enlace de la comparación:', link)
    }
  }
  function changePriority(priority: Priority) {
    const next = priorities.includes(priority) ? priorities.filter((item) => item !== priority) : [...priorities, priority].slice(0, 3)
    update({ priorities: next.join(','), view: null })
  }
  function compareChosen() {
    const selected = chosen.slice(0, 3)
    update({ mode: null, view: null, firms: selected.join(','), plans: selected.map((slug) => matching.results.find((result) => result.firm.slug === slug)?.plan.id ?? '').join(',') })
  }
  const sections: Array<{ title: string; rows: Row[] }> = [
    { title: 'Costo y cuenta', rows: [
      { label: 'Tamaño de cuenta', values: match.plans.map((plan) => plan ? formatSize(plan.size) : null) },
      { label: 'Precio del challenge', values: match.plans.map((plan) => plan ? money(plan.price, plan.currency) : null), hint: 'Solo precio conocido del challenge; no incluye cargos no documentados.' },
      { label: 'Programa', values: match.plans.map((plan) => plan?.challengeName ?? null) },
      { label: 'Variante', values: match.plans.map((plan) => plan?.variantName ?? null) },
      { label: 'Fases', values: match.plans.map((plan) => plan?.steps ?? null) },
    ] },
    { title: 'Objetivos y riesgo', rows: [
      { label: 'Objetivo por fase', values: match.plans.map((plan) => phases(plan, 'profitTarget')) },
      { label: 'Pérdida diaria', values: match.plans.map((plan) => phases(plan, 'dailyDrawdown')), hint: 'Límite de pérdida diario. Consulta también el periodo y la base de cálculo de la firma.' },
      { label: 'Pérdida máxima', values: match.plans.map((plan) => phases(plan, 'maxDrawdown')), hint: 'No basta con mirar el porcentaje: importa si el límite es estático o móvil y cómo se calcula.' },
      { label: 'Tipo de drawdown', values: match.plans.map((plan) => plan?.phases.map((phase) => phase.drawdownType ?? 'Sin dato').join(' · ') ?? null) },
      { label: 'Base de drawdown', values: match.plans.map((plan) => plan?.phases.map((phase) => phase.drawdownBasis ?? 'Sin dato').join(' · ') ?? null) },
      { label: 'Días mínimos de trading', values: match.plans.map((plan) => plan?.phases.map((phase) => phase.minTradingDays === null ? 'Sin dato' : `F${phase.phaseNumber}: ${phase.minTradingDays}`).join(' · ') ?? null) },
    ] },
    { title: 'Retiros y rewards del programa', rows: [
      { label: 'Opción de reward mostrada', values: match.plans.map((plan) => plan?.rewardName ?? null) },
      { label: 'Profit split', values: match.plans.map((plan) => percentage(plan?.split ?? null)) },
      { label: 'Frecuencia de payout', values: match.plans.map((plan) => plan?.payoutFrequency ?? null) },
      { label: 'Mínimo de días de payout', values: match.plans.map((plan) => plan?.payoutDays ?? null) },
      { label: 'Opciones de reward', values: match.plans.map((plan) => plan?.rewardNames.join(' · ') || null) },
    ] },
    { title: 'Libertad para operar', rows: ([['EA / bots', 'ea'], ['Noticias', 'news'], ['Weekend holding', 'weekend'], ['Copy trading', 'copy'], ['Scalping', 'scalping']] as const).map(([label, key]) => ({ label, values: firms.map((firm) => firm.rules[key] === null ? null : firm.rules[key] ? 'Permitido' : 'No permitido') })) },
    { title: 'Mercados y tecnología', rows: [
      { label: 'Mercados', values: firms.map((firm) => firm.markets.join(' · ') || null) },
      { label: 'Plataformas', values: firms.map((firm) => firm.tradingPlatforms.join(' · ') || null) },
      { label: 'Instrumentos', values: firms.map((firm) => firm.instruments.join(' · ') || null) },
      { label: 'Métodos de retiro', values: firms.map((firm) => firm.payoutMethods.join(' · ') || null) },
    ] },
    { title: 'Evidencia disponible de la firma · Tradagora', rows: [
      { label: 'Payouts verificados', values: firms.map((firm) => firm.evidence?.count ?? 'Sin dato verificado'), hint: 'Agregado de payouts individuales verificados por Tradagora para la firma; no equivale a garantía para este programa.' },
      { label: 'Monto verificado (sin desglose de moneda)', values: firms.map((firm) => firm.evidence ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(firm.evidence.amount) : 'Sin dato verificado') },
      { label: 'Última evidencia', values: firms.map((firm) => firm.evidence?.lastAt ? new Date(firm.evidence.lastAt).toLocaleDateString('es-CO') : 'Sin dato verificado') },
    ] },
  ]
  const visibleSections = sections.map((section) => ({ ...section, rows: section.rows.filter((row) => !initial.differences || valuesDiffer(row.values)) }))
  const importantDifferences = sections.flatMap((section) => section.rows.filter((row) => valuesDiffer(row.values)).map((row) => row.label)).slice(0, 5)

  return <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
    <header className="mb-8"><p className="tg-eyebrow">Decide con contexto</p><h1 className="mt-3 text-4xl font-bold text-white sm:text-5xl">Comparador de Prop Firms</h1><p className="mt-3 max-w-3xl text-slate-400">Compara programas y tamaños reales. Las diferencias importan según tu forma de operar; no existe una firma ganadora para todos.</p></header>
    <div className={`${card} mb-6`}><div className="flex flex-wrap gap-2"><button type="button" className={initial.mode === 'firms' ? 'tg-button-gold px-4 py-2' : button} onClick={() => update({ mode: null, view: null })}>Comparar firmas</button><button type="button" className={initial.mode === 'personal' ? 'tg-button-gold px-4 py-2' : button} onClick={() => update({ mode: 'personal', view: null, firms: null, plans: null })}>Comparar para mí</button></div>
      {initial.mode === 'personal' && !initial.showMatches && <><h2 className="mt-6 text-xl font-semibold text-white">1. Cuéntanos qué buscas</h2><p className="mt-1 text-sm text-slate-400">El mercado y presupuesto son requisitos; el tamaño exacto se prioriza. El resto ayuda a ordenar opciones.</p><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm text-slate-300">Mercado<select className="mt-1 block w-full rounded-xl border border-white/15 bg-[#0a1422] p-2.5" value={initial.market} onChange={(event) => update({ market: event.target.value })}><option value="">Cualquiera</option>{allMarkets.map((market) => <option key={market} value={market}>{market.toUpperCase()}</option>)}</select></label><label className="text-sm text-slate-300">Tamaño buscado<select className="mt-1 block w-full rounded-xl border border-white/15 bg-[#0a1422] p-2.5" value={initial.size} onChange={(event) => update({ size: event.target.value })}><option value="">Cualquiera</option>{allSizes.map((item) => <option key={item} value={item}>{formatSize(item)}</option>)}</select></label><label className="text-sm text-slate-300">Presupuesto máximo · USD<input type="number" min="0" inputMode="numeric" defaultValue={initial.budget} onBlur={(event) => update({ budget: event.target.value })} placeholder="Sin límite" className="mt-1 block w-full rounded-xl border border-white/15 bg-[#0a1422] p-2.5" /></label><label className="text-sm text-slate-300">Plataforma<select className="mt-1 block w-full rounded-xl border border-white/15 bg-[#0a1422] p-2.5" value={initial.platform} onChange={(event) => update({ platform: event.target.value })}><option value="">Cualquiera</option>{allPlatforms.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div><fieldset className="mt-5"><legend className="text-sm text-slate-300">¿Qué te importa más? Elige hasta 3.</legend><div className="mt-2 flex flex-wrap gap-2">{(Object.keys(priorityLabels) as Priority[]).filter((key) => key !== 'rules').map((key) => <button key={key} type="button" aria-pressed={priorities.includes(key)} disabled={!priorities.includes(key) && priorities.length >= 3} onClick={() => changePriority(key)} className={`${button} ${priorities.includes(key) ? 'border-amber-300 text-amber-200' : ''} disabled:opacity-40`}>{priorityLabels[key]}</button>)}</div></fieldset><fieldset className="mt-5"><legend className="text-sm text-slate-300">¿Cómo operas?</legend><div className="mt-2 flex flex-wrap gap-2">{([['ea', 'Uso EA / bots'], ['news', 'Opero noticias'], ['weekend', 'Mantengo posiciones el fin de semana']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={styles.includes(key)} className={`${button} ${styles.includes(key) ? 'border-amber-300 text-amber-200' : ''}`} onClick={() => update({ styles: styles.includes(key) ? styles.filter((item) => item !== key).join(',') : [...styles, key].join(',') })}>{label}</button>)}</div></fieldset><button type="button" className="tg-button-gold mt-6 px-5 py-3" onClick={() => update({ view: 'matches' })}>Ver mis coincidencias</button></>}
    </div>
    {initial.mode === 'personal' && initial.showMatches && <section className={`${card} mb-6`} aria-label="Tus coincidencias"><p className="tg-eyebrow">2. Tus coincidencias</p><h2 className="mt-2 text-2xl font-semibold">Opciones para explorar</h2><p className="mt-2 text-sm text-slate-400">Basado en {initial.market ? initial.market.toUpperCase() : 'cualquier mercado'}{size ? ` · ${formatSize(size)}` : ''}{budget ? ` · hasta USD ${budget}` : ''}{priorities.length ? ` · ${priorities.map((priority) => priorityLabels[priority]).join(', ')}` : ''}.</p><p className="mt-2 text-xs text-slate-500">Las coincidencias se calculan con reglas y características disponibles en Tradagora. Los datos faltantes no se consideran automáticamente negativos.</p><button type="button" className={`${button} mt-4`} onClick={() => update({ view: null })}>Editar preferencias</button>{!matching.hasExactRequirements && matching.results.length > 0 && <p className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-100">No encontramos una coincidencia exacta; estas son las opciones más cercanas. Revisa sus diferencias antes de decidir.</p>}{matching.results.length === 0 ? <p className="mt-6 text-slate-300">No hay programas activos con planes disponibles para estos criterios. Puedes ajustar tus preferencias o comparar firmas manualmente.</p> : <><div className="mt-5 grid gap-3 lg:grid-cols-3">{matching.results.slice(0, showMore ? 9 : 3).map((result) => <article key={result.firm.id} className="min-w-0 rounded-xl border border-amber-300/15 bg-[#0b1725] p-4"><div className="flex items-start gap-3"><FirmLogo url={result.firm.logoUrl} name={result.firm.name} /><div className="min-w-0"><h3 className="font-semibold text-white">{result.firm.name}</h3><p className="text-sm text-slate-400">{result.plan.challengeName}{result.plan.variantName ? ` · ${result.plan.variantName}` : ''}</p></div></div><p className="mt-3 text-sm text-slate-200">{formatSize(result.plan.size)} · {money(result.plan.price, result.plan.currency) ?? 'Precio sin dato'}</p><p className="mt-3 text-sm font-medium text-amber-200">Coincide con {result.matched} de {result.evaluable} prioridades evaluables</p>{priorities.length + styles.length - result.evaluable > 0 && <p className="mt-1 text-xs text-slate-400">{priorities.length + styles.length - result.evaluable} sin datos suficientes o criterio no comparable</p>}<ul className="mt-3 space-y-1 text-sm text-slate-200">{result.reasons.map((reason) => <li key={reason}>✓ {reason}</li>)}</ul>{result.cautions.length > 0 && <div className="mt-3 border-t border-white/10 pt-3"><p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Ten en cuenta</p><ul className="mt-1 space-y-1 text-xs text-slate-400">{result.cautions.map((caution) => <li key={caution}>◇ {caution}</li>)}</ul></div>}<label className="mt-4 flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" className="accent-amber-400" checked={chosen.includes(result.firm.slug)} onChange={(event) => setChosen((current) => event.target.checked ? [...current, result.firm.slug].slice(0, 3) : current.filter((slug) => slug !== result.firm.slug))} disabled={!chosen.includes(result.firm.slug) && chosen.length >= 3} />Comparar esta opción</label><Link href={`/prop-firms/${result.firm.slug}`} className="mt-3 inline-block text-xs text-amber-200 hover:underline">Ver ficha y fuentes</Link></article>)}</div>{matching.results.length > 3 && <button type="button" className={`${button} mt-4`} onClick={() => setShowMore(!showMore)}>{showMore ? 'Ver menos' : 'Ver más opciones'}</button>}<div className="mt-6 flex flex-wrap items-end gap-3"><label className="text-sm text-slate-300">Añadir otra firma manualmente<select className="mt-1 block w-full max-w-xs rounded-xl border border-white/15 bg-[#0a1422] p-2.5" value={manualAddition} onChange={(event) => setManualAddition(event.target.value)}><option value="">Seleccionar firma</option>{choices.filter((choice) => !chosen.includes(choice.slug)).map((choice) => <option key={choice.id} value={choice.slug}>{choice.name}</option>)}</select></label><button type="button" className={button} disabled={!manualAddition || chosen.length >= 3} onClick={() => { setChosen((current) => [...current, manualAddition]); setManualAddition('') }}>Añadir</button></div><div className="mt-5"><p className="mb-2 text-sm text-slate-400">3. Comparar en detalle · {chosen.length} de 3 opciones seleccionadas</p><button type="button" className="tg-button-gold px-5 py-3 disabled:opacity-40" disabled={chosen.length === 0 || loading} onClick={compareChosen}>Comparar estas opciones</button></div></>}</section>}
    {initial.mode === 'firms' && <><section className={`${card} mb-6`} aria-label="Seleccionar firmas">
      <div className="flex items-center gap-2"><SlidersHorizontal className="size-5 text-amber-300" /><h2 className="text-xl font-semibold">Elige hasta tres firmas</h2></div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">{Array.from({ length: Math.min(3, firms.length + 1) }, (_, index) => <div key={index}><label className="text-sm text-slate-300">Firma {index + 1}<select aria-label={`Firma ${index + 1}`} value={firms[index]?.slug ?? ''} onChange={(event) => selectFirm(index, event.target.value)} className="mt-1 block w-full rounded-xl border border-white/15 bg-[#0a1422] p-3"><option value="" disabled>Seleccionar firma</option>{choices.filter((choice) => choice.slug === firms[index]?.slug || !selectedIds.includes(choice.slug)).map((choice) => <option key={choice.id} value={choice.slug}>{choice.name} · {choice.markets.join('/') || 'Sin mercado'}</option>)}</select></label>{firms[index] && <button type="button" onClick={() => removeFirm(index)} className="mt-1 text-xs text-slate-400 underline-offset-4 hover:text-amber-200 hover:underline" aria-label={`Quitar ${firms[index].name}`}>Quitar {firms[index].name}</button>}</div>)}</div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><SearchInput value={search} onChange={setSearch} placeholder="Buscar otra Prop Firm" theme="dark" className="w-full max-w-sm" /></div>
      {search && <div className="mt-2 flex flex-wrap gap-2">{candidates.map((firm) => <button type="button" key={firm.id} className={`${button} inline-flex items-center gap-2`} onClick={() => { selectFirm(Math.min(firms.length, 2), firm.slug); setSearch('') }}><FirmLogo url={firm.logoUrl} name={firm.name} />{firm.name} · {firm.markets.join('/') || 'Sin mercado'}</button>)}</div>}
      {loading && <p role="status" className="mt-3 text-xs text-slate-400">Actualizando comparación…</p>}
    </section>
    {firms.length === 0 ? <div className={`${card} py-16 text-center`}><h2 className="text-2xl font-semibold">Empieza por elegir una firma</h2><p className="mt-2 text-slate-400">Después podrás añadir hasta dos más y comparar programas reales.</p></div> : <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><label className="inline-flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={initial.differences} onChange={(event) => update({ differences: event.target.checked ? '1' : null })} className="accent-amber-400" />Mostrar solo diferencias</label><button type="button" className={button} onClick={share}><Copy className="mr-2 inline size-4" />{copied ? 'Enlace copiado' : 'Compartir comparación'}</button></div>
      <div className={`sticky top-0 z-30 mb-5 grid gap-2 border-y border-amber-300/15 bg-[#09111f]/95 py-2 backdrop-blur ${firms.length === 3 ? 'sm:grid-cols-3' : firms.length === 2 ? 'sm:grid-cols-2' : ''}`}>{firms.map((firm, index) => <div key={firm.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-[#111e2e] p-2"><FirmLogo url={firm.logoUrl} name={firm.name} /><div className="min-w-0 text-xs"><p className="truncate font-semibold text-sm">{firm.name}</p><p className="truncate text-slate-400">{match.plans[index]?.challengeName ?? 'Sin plan'}{match.plans[index]?.variantName ? ` · ${match.plans[index]?.variantName}` : ''}</p><p className="text-slate-400">{formatSize(match.plans[index]?.size ?? null)} · {match.plans[index]?.steps ?? 'Sin dato'} fases</p></div></div>)}</div>
      {firms.length > 1 && <section className={`${card} mb-5`}><h2 className="text-xl font-semibold">Diferencias que destacan</h2><p className="mt-1 text-sm text-slate-400">Hasta cinco campos distintos entre las opciones seleccionadas; diferente no significa mejor ni peor.</p>{importantDifferences.length ? <ul className="mt-3 flex flex-wrap gap-2">{importantDifferences.map((label) => <li key={label} className="rounded-lg border border-amber-300/20 px-3 py-1.5 text-sm text-amber-100">{label}</li>)}</ul> : <p className="mt-3 text-sm text-slate-400">Sin diferencias registradas en los campos disponibles.</p>}</section>}
      <section className={`${card} mb-5`}><h2 className="text-xl font-semibold">Programas comparados</h2><p className="mt-1 text-sm text-slate-400">Selecciona otro programa o tamaño si la propuesta automática no es equivalente.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{firms.map((firm, index) => <label key={firm.id} className="text-sm text-slate-300">{firm.name} <span className="text-xs text-amber-200">{initial.plans[index] ? '· selección manual' : '· selección automática'}</span><select value={match.plans[index]?.id ?? ''} onChange={(event) => { const next = match.plans.map((plan) => plan?.id ?? ''); next[index] = event.target.value; update({ plans: next.join(',') }) }} className="mt-1 block w-full rounded-xl border border-white/15 bg-[#0a1422] p-2.5"><option value="">Sin plan</option>{firm.plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.challengeName}{plan.variantName ? ` · ${plan.variantName}` : ''} · {formatSize(plan.size)} · {plan.steps ?? '?'} fases</option>)}</select></label>)}</div>{firms.length > 1 && (match.exact ? <p className="mt-4 text-sm text-emerald-300">Comparación equivalente por mercado, tamaño, fases, tipo de programa y moneda conocidos.</p> : <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-100">Comparación aproximada. {match.notes.join(' ') || 'No encontramos un plan equivalente exacto.'}</p>)}</section>
      {insights.length > 0 && <section className={`${card} mb-5`}><h2 className="text-xl font-semibold">Lo que puede importarte</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{insights.map((insight, index) => <div key={`${insight.relatedMetric}-${index}`} className="rounded-xl border border-white/10 p-4"><span className="text-xs uppercase tracking-wide text-amber-300">{insight.type === 'review' ? 'Revisar' : 'Según tu prioridad'}</span><h3 className="mt-1 font-semibold">{insight.title}</h3><p className="mt-2 text-sm text-slate-400">{insight.description}</p></div>)}</div></section>}
      {visibleSections.map((section) => <section key={section.title} className={`${card} mb-5`}><h2 className="mb-4 text-xl font-semibold">{section.title}</h2><div className="space-y-2">{section.rows.length ? section.rows.map((row) => <div key={row.label} className="rounded-xl border border-white/10 bg-[#0b1725] p-3"><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{row.label}</div>{row.hint && <details className="mt-1 text-xs text-slate-400"><summary className="inline-flex cursor-pointer items-center gap-1 rounded focus-visible:outline-2 focus-visible:outline-amber-300"><Info className="size-3.5" />¿Qué significa?</summary><p className="mt-1 max-w-2xl">{row.hint}</p></details>}<div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{row.values.map((value, index) => <div key={firms[index].id} className="min-w-0 rounded-lg bg-white/5 px-3 py-2"><span className="block text-xs text-slate-500 sm:sr-only">{firms[index].name}</span><span className={value === null ? 'text-slate-500' : 'text-slate-100'}>{missing(value)}</span></div>)}</div></div>) : <p className="text-sm text-slate-400">Sin diferencias conocidas en esta sección.</p>}</div></section>)}
      <section className={`${card} mb-5`}><h2 className="text-xl font-semibold">Disponibilidad y antes de decidir</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{firms.map((firm) => <div key={firm.id} className="rounded-xl border border-white/10 p-4"><h3 className="font-semibold">{firm.name}</h3><div className="mt-3 flex items-center gap-2 text-sm"><CountryFlag countryCode={firm.countryCode} /><span>País de origen</span></div><p className="mt-3 text-sm text-slate-400">Países restringidos conocidos: {firm.restrictions.length ? firm.restrictions.join(', ') : 'Sin dato específico'}. La ausencia de restricciones registradas no garantiza disponibilidad.</p><p className="mt-3 text-sm text-slate-400">{firm.offer ? `Oferta activa: ${firm.offer}. No influye en la comparación.` : 'Sin oferta activa registrada.'}</p><Link href={`/prop-firms/${firm.slug}`} className="mt-4 inline-block text-sm text-amber-200 underline-offset-4 hover:underline">Ver ficha y fuentes</Link><Link href={`/go/${firm.slug}`} className="mt-4 ml-4 inline-flex items-center gap-1 text-sm text-amber-200 underline-offset-4 hover:underline">Visitar {firm.name}<ArrowUpRight className="size-4" /></Link></div>)}</div></section>
      <p className="flex items-start gap-2 text-sm text-slate-500"><Check className="mt-0.5 size-4 shrink-0" />Las reglas del programa y la evidencia de payout son datos distintos. No mostramos métricas externas agregadas como si fueran pagos individuales ni inferimos términos no documentados.</p>
    </>}</>}
  </div>
}
