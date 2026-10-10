'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight, Check, Copy, Info, SlidersHorizontal } from 'lucide-react'
import { CountryFlag } from '@/components/shared/CountryFlag'
import { CountryPicker } from '@/components/shared/CountryPicker'
import { SearchInput } from '@/components/shared/SearchInput'
import { resolveAvailability, type AvailabilityRule } from '@/lib/platform-availability'
import { buildComparisonInsights, findComparablePlans, formatSize, valuesDiffer, type ComparisonFirm, type ComparisonPlan, type Priority } from '@/lib/comparison-engine'
import type { FirmChoice } from '@/lib/comparison-data'
import type { MatchResult } from '@/lib/preference-matches'
import { comparatorText, getPublicUi, localizeComparatorOutput, publicComparatorCopy, publicLocale, publicPath, publicTradingRuleCopy, publicUiLanguage } from '@/lib/public-i18n'

type Initial = { plans: string[]; size: string; priorities: string[]; styles: string[]; market: string; budget: string; platform: string; country: string; mode: 'personal' | 'firms'; showMatches: boolean; differences: boolean }
type Row = { label: string; values: Array<string | number | null>; hint?: string }
const card = 'rounded-2xl border border-amber-300/15 bg-[#111e2e] p-4 sm:p-5'
const button = 'rounded-xl border border-amber-300/20 px-4 py-2.5 text-sm text-slate-200 hover:border-amber-300/50 focus-visible:outline-2 focus-visible:outline-amber-300'
const toggle = (active: boolean) => active
  ? 'inline-flex items-center gap-2 rounded-xl border-2 border-amber-200 bg-amber-300 px-4 py-2.5 text-sm font-bold text-[#102035] shadow-[0_0_0_2px_rgba(251,191,36,0.12)] focus-visible:outline-2 focus-visible:outline-amber-100'
  : `${button} bg-[#0a1422] font-medium`
const percentage = (value: number | null) => value === null ? null : `${value}%`
const normalizedSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
const editorialPairSlugs = [['fundednext', 'fundingpips'], ['ftmo', 'the5ers'], ['tradeify', 'myfundedfutures']]

function FirmLogo({ url, name, size = 36 }: { url: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  return url && !failed
    ? <Image unoptimized src={url} alt="" width={size} height={size} onError={() => setFailed(true)} className="size-9 shrink-0 rounded-lg bg-white object-contain p-1" />
    : <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 font-semibold">{name.slice(0, 2).toUpperCase()}</span>
}
export function Comparator({ choices, firms, initial, filterOptions, matching, countries }: { choices: FirmChoice[]; firms: ComparisonFirm[]; initial: Initial; filterOptions: { sizes: number[]; platforms: string[] }; matching: { results: MatchResult[]; hasExactRequirements: boolean; eligibleFirmCount: number; excludedByCountryCount: number }; countries: Array<{ code: string; name: string }> }) {
  const router = useRouter()
  const language = publicUiLanguage(useSearchParams().get('lang'))
  const copy = publicComparatorCopy[language]
  const ruleCopy = publicTradingRuleCopy[language]
  const t = getPublicUi(language)
  const locale = publicLocale(language)
  const priorityLabels: Record<Priority, string> = copy.priorities
  const missing = (value: string | number | null | undefined) => value === null || value === undefined || value === '' ? copy.noData : String(value)
  const money = (value: number | null, currency: string | null) => value === null ? null : `${currency ?? copy.currencyUnknown} ${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)}`
  const formatAccountSize = (value: number | null) => value === null ? copy.noData : formatSize(value)
  const phases = (plan: ComparisonPlan | null, key: 'profitTarget' | 'dailyDrawdown' | 'maxDrawdown') => plan?.phases.map((phase) => phase[key] === null ? `${copy.phase}${phase.phaseNumber}: ${copy.noData}` : `${copy.phase}${phase.phaseNumber}: ${phase[key]}%`).join(' · ') ?? null
  const availabilityLabel = (status: 'available' | 'restricted' | 'unknown') => status === 'available' ? copy.available : status === 'restricted' ? copy.restricted : copy.unverified
  const localizedOutput = (value: string) => localizeComparatorOutput(value, language)
  const [search, setSearch] = useState('')
  const [pickerIndex, setPickerIndex] = useState<number | null>(null)
  const [pickerMarket, setPickerMarket] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [chosenCountry, setChosenCountry] = useState(initial.country)
  const [copied, setCopied] = useState(false)
  const [loading, startTransition] = useTransition()
  const [showMore, setShowMore] = useState(false)
  const [chosen, setChosen] = useState<string[]>(() => matching.results.slice(0, 3).map((result) => result.firm.slug))
  const [manualAddition, setManualAddition] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => ({ market: initial.market, size: initial.size, budget: initial.budget, platform: initial.platform,
    priorities: initial.priorities.filter((value): value is Priority => value in priorityLabels && value !== 'rules' && value !== 'platform').slice(0, 3),
    styles: initial.styles.filter((value): value is 'ea' | 'news' | 'weekend' => ['ea', 'news', 'weekend'].includes(value)),
  }))
  const priorities = draft.priorities
  const styles = draft.styles
  const configuring = initial.mode === 'personal' && (!initial.showMatches || editing)
  const showingMatches = initial.mode === 'personal' && initial.showMatches && !editing && !loading
  const size = initial.size && Number.isFinite(Number(initial.size)) ? Number(initial.size) : null
  const budget = initial.budget && Number.isFinite(Number(initial.budget)) ? Number(initial.budget) : null
  const selectedIds = firms.map((firm) => firm.slug)
  const match = useMemo(() => findComparablePlans(firms, size, initial.plans), [firms, size, initial.plans])
  const insights = useMemo(() => buildComparisonInsights(firms, match.plans, priorities, initial.platform || null), [firms, match.plans, priorities, initial.platform])
  const allSizes = initial.mode === 'personal' ? filterOptions.sizes : [...new Set(firms.flatMap((firm) => firm.plans.flatMap((plan) => plan.size === null ? [] : [plan.size])))].sort((a, b) => a - b)
  const allMarkets = [...new Set(choices.flatMap((firm) => firm.markets))].sort()
  const allPlatforms = initial.mode === 'personal' ? filterOptions.platforms : [...new Set(firms.flatMap((firm) => firm.tradingPlatforms))].sort()
  const countryName = countries.find((item) => item.code === chosenCountry)?.name ?? chosenCountry
  const availabilityFor = (firm: { id: string; markets: string[]; availabilityRules: AvailabilityRule[] }) =>
    resolveAvailability(firm.availabilityRules, firm.id, chosenCountry, initial.market
      ? initial.market : firm.markets.length === 1 ? firm.markets[0] : null)
  const availabilityForResult = (firmId: string) => {
    const choice = choices.find((item) => item.id === firmId)
    return choice ? availabilityFor(choice) : resolveAvailability([], firmId, chosenCountry)
  }
  const candidates = choices.filter((firm) => normalizedSearch(firm.name).includes(normalizedSearch(search)) && (!pickerMarket || firm.markets.includes(pickerMarket))).slice(0, 60)
  const editorialPairs = editorialPairSlugs.flatMap(([a, b]) => {
    const left = choices.find((choice) => choice.slug === a), right = choices.find((choice) => choice.slug === b)
    return left && right ? [[left, right]] : []
  })
  const suggested = [...new Set(editorialPairs.flatMap((pair) => pair.map((choice) => choice.slug)))].flatMap((slug) => choices.find((choice) => choice.slug === slug) ?? [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (pickerIndex !== null && !dialog.open) dialog.showModal()
    if (pickerIndex === null && dialog.open) dialog.close()
  }, [pickerIndex])

  function update(changes: Record<string, string | null>) {
    const url = new URL(window.location.href)
    for (const [key, value] of Object.entries(changes)) { if (value) url.searchParams.set(key, value); else url.searchParams.delete(key) }
    if (`${url.pathname}${url.search}` === `${window.location.pathname}${window.location.search}`) return
    startTransition(() => router.push(`${url.pathname}${url.search}`, { scroll: false }))
  }
  function selectFirm(index: number, slug: string) {
    setPickerIndex(null)
    setSearch('')
    const next = [...selectedIds]
    if (index >= next.length) next.push(slug)
    else next[index] = slug
    const nextPlans = match.plans.map((plan) => plan?.id ?? '')
    nextPlans[index] = ''
    update({ firms: [...new Set(next)].slice(0, 3).join(','), plans: nextPlans.join(','), country: chosenCountry })
  }
  function removeFirm(index: number) {
    update({ firms: selectedIds.filter((_, position) => position !== index).join(','), plans: match.plans.filter((_, position) => position !== index).map((plan) => plan?.id ?? '').join(','), country: chosenCountry })
  }
  async function share() {
    const url = new URL(window.location.href)
    if (chosenCountry) url.searchParams.set('country', chosenCountry)
    else url.searchParams.delete('country')
    const link = url.href
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
      if (!success) window.prompt(copy.copyPrompt, link)
    }
  }
  function changePriority(priority: Priority) {
    const next = priorities.includes(priority) ? priorities.filter((item) => item !== priority) : [...priorities, priority].slice(0, 3)
    setDraft((current) => ({ ...current, priorities: next }))
  }
  function editPreferences() {
    setEditing(true)
    const url = new URL(window.location.href)
    url.searchParams.delete('view')
    window.history.replaceState(null, '', `${url.pathname}${url.search}`)
  }
  function searchMatches() {
    update({ mode: 'personal', view: 'matches', firms: null, plans: null, country: chosenCountry, market: draft.market, size: draft.size,
      budget: draft.budget, platform: draft.platform, priorities: priorities.join(','), styles: styles.join(',') })
    setEditing(false)
  }
  function compareChosen() {
    const selected = chosen.slice(0, 3)
    update({ mode: null, view: null, country: chosenCountry, firms: selected.join(','), plans: selected.map((slug) => matching.results.find((result) => result.firm.slug === slug)?.plan.id ?? '').join(',') })
  }
  const sections: Array<{ title: string; rows: Row[] }> = [
    { title: copy.sectionCost, rows: [
      { label: copy.accountSize, values: match.plans.map((plan) => plan ? formatSize(plan.size) : null) },
      { label: copy.challengePrice, values: match.plans.map((plan) => plan ? money(plan.price, plan.currency) : null), hint: copy.challengePriceHint },
      { label: copy.program, values: match.plans.map((plan) => plan?.challengeName ?? null) },
      { label: copy.variant, values: match.plans.map((plan) => plan?.variantName ?? null) },
      { label: copy.phases, values: match.plans.map((plan) => plan?.steps ?? null) },
    ] },
    { title: copy.sectionRisk, rows: [
      { label: copy.targetPhase, values: match.plans.map((plan) => phases(plan, 'profitTarget')) },
      { label: copy.dailyLoss, values: match.plans.map((plan) => phases(plan, 'dailyDrawdown')), hint: copy.dailyLossHint },
      { label: copy.maxLoss, values: match.plans.map((plan) => phases(plan, 'maxDrawdown')), hint: copy.maxLossHint },
      { label: copy.drawdownType, values: match.plans.map((plan) => plan?.phases.map((phase) => phase.drawdownType ?? copy.noData).join(' · ') ?? null) },
      { label: copy.drawdownBasis, values: match.plans.map((plan) => plan?.phases.map((phase) => phase.drawdownBasis ?? copy.noData).join(' · ') ?? null) },
      { label: copy.minTradingDays, values: match.plans.map((plan) => plan?.phases.map((phase) => phase.minTradingDays === null ? copy.noData : `${copy.phase}${phase.phaseNumber}: ${phase.minTradingDays}`).join(' · ') ?? null) },
    ] },
    { title: copy.sectionRewards, rows: [
      { label: copy.rewardShown, values: match.plans.map((plan) => plan?.rewardName ?? null) },
      { label: 'Profit split', values: match.plans.map((plan) => percentage(plan?.split ?? null)) },
      { label: copy.payoutFrequency, values: match.plans.map((plan) => plan?.payoutFrequency ?? null) },
      { label: copy.minPayoutDays, values: match.plans.map((plan) => plan?.payoutDays ?? null) },
      { label: copy.rewardOptions, values: match.plans.map((plan) => plan?.rewardNames.join(' · ') || null) },
    ] },
    { title: copy.sectionFreedom, rows: ([[ruleCopy.automatedTrading, 'ea'], [copy.news, 'news'], [ruleCopy.weekendHolding, 'weekend'], [ruleCopy.copyTrading, 'copy'], [ruleCopy.scalping, 'scalping']] as const).map(([label, key]) => ({ label, values: firms.map((firm) => firm.rules[key] === null ? null : firm.rules[key] ? copy.allowed : copy.notAllowed) })) },
    { title: copy.sectionMarkets, rows: [
      { label: copy.markets, values: firms.map((firm) => firm.markets.join(' · ') || null) },
      { label: copy.platforms, values: firms.map((firm) => firm.tradingPlatforms.join(' · ') || null) },
      { label: copy.instruments, values: firms.map((firm) => firm.instruments.join(' · ') || null) },
      { label: copy.withdrawalMethods, values: firms.map((firm) => firm.payoutMethods.join(' · ') || null) },
    ] },
    { title: copy.sectionEvidence, rows: [
      { label: copy.verifiedPayouts, values: firms.map((firm) => firm.evidence?.count ?? copy.noVerifiedData), hint: copy.verifiedPayoutsHint },
      { label: copy.verifiedAmount, values: firms.map((firm) => firm.evidence ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(firm.evidence.amount) : copy.noVerifiedData) },
      { label: copy.lastEvidence, values: firms.map((firm) => firm.evidence?.lastAt ? new Date(firm.evidence.lastAt).toLocaleDateString(locale) : copy.noVerifiedData) },
    ] },
  ]
  const visibleSections = sections.map((section) => ({ ...section, rows: section.rows.filter((row) => !initial.differences || valuesDiffer(row.values)) }))
  const importantDifferences = sections.flatMap((section) => section.rows.filter((row) => valuesDiffer(row.values)).map((row) => row.label)).slice(0, 5)

  return <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
    <div className={`${card} mb-6`}>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={initial.mode === 'firms' ? 'tg-button-gold px-4 py-2' : button} onClick={() => update({ mode: null, view: null, country: chosenCountry })}>{copy.compareFirms}</button>
        <button type="button" className={initial.mode === 'personal' ? 'tg-button-gold px-4 py-2' : button} onClick={() => initial.mode === 'personal' ? editPreferences() : update({ mode: 'personal', view: null, firms: null, plans: null, country: chosenCountry })}>{copy.compareForMe}</button>
      </div>
      {configuring && <>
        <h2 className="mt-6 text-xl font-semibold text-white">{copy.tellUs}</h2>
        <p className="mt-1 text-sm text-slate-400">{copy.requirementsHelp}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4"><CountryPicker countries={countries} value={chosenCountry} onChange={setChosenCountry} label={t('country.question')} /></div>
          <label className="text-sm text-slate-300">{copy.market}<select className="mt-1 block w-full rounded-xl border border-white/15 bg-[#0a1422] p-2.5" value={draft.market} onChange={(event) => setDraft((current) => ({ ...current, market: event.target.value }))}><option value="">{copy.any}</option>{allMarkets.map((market) => <option key={market} value={market}>{market.toUpperCase()}</option>)}</select></label>
          <label className="text-sm text-slate-300">{copy.desiredSize}<select className="mt-1 block w-full rounded-xl border border-white/15 bg-[#0a1422] p-2.5" value={draft.size} onChange={(event) => setDraft((current) => ({ ...current, size: event.target.value }))}><option value="">{copy.any}</option>{allSizes.map((item) => <option key={item} value={item}>{formatSize(item)}</option>)}</select></label>
          <label className="text-sm text-slate-300">{copy.maxBudget}<input type="number" min="0" inputMode="numeric" value={draft.budget} onChange={(event) => setDraft((current) => ({ ...current, budget: event.target.value }))} placeholder={copy.noLimit} className="mt-1 block w-full rounded-xl border border-white/15 bg-[#0a1422] p-2.5" /></label>
          <label className="text-sm text-slate-300">{copy.platform}<select className="mt-1 block w-full rounded-xl border border-white/15 bg-[#0a1422] p-2.5" value={draft.platform} onChange={(event) => setDraft((current) => ({ ...current, platform: event.target.value }))}><option value="">{copy.any}</option>{allPlatforms.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        </div>
        <fieldset className="mt-5"><legend className="text-sm text-slate-300">{copy.prioritiesQuestion}</legend><div className="mt-2 flex flex-wrap gap-2">{(['price', 'payout', 'drawdown', 'split'] as Priority[]).map((key) => <button key={key} type="button" aria-pressed={priorities.includes(key)} disabled={!priorities.includes(key) && priorities.length >= 3} onClick={() => changePriority(key)} className={`${toggle(priorities.includes(key))} disabled:cursor-not-allowed disabled:opacity-40`}><span aria-hidden="true">{priorities.includes(key) ? '✓' : '+'}</span>{priorityLabels[key]}</button>)}</div>{priorities.length >= 3 && <p className="mt-2 text-xs text-slate-400">{copy.maxPriorities}</p>}</fieldset>
        <fieldset className="mt-5"><legend className="text-sm text-slate-300">{copy.tradingQuestion}</legend><div className="mt-2 flex flex-wrap gap-2">{([['ea', copy.useEa], ['news', copy.tradeNews], ['weekend', copy.holdWeekend]] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={styles.includes(key)} className={toggle(styles.includes(key))} onClick={() => setDraft((current) => ({ ...current, styles: current.styles.includes(key) ? current.styles.filter((item) => item !== key) : [...current.styles, key] }))}><span aria-hidden="true">{styles.includes(key) ? '✓' : '+'}</span>{label}</button>)}</div></fieldset>
        <button type="button" className="tg-button-gold mt-6 px-5 py-3 disabled:opacity-60" disabled={loading} onClick={searchMatches}>{loading ? copy.searching : copy.viewMatches}</button>
        {loading && <p role="status" className="mt-2 text-sm text-slate-400">{copy.analyzing}</p>}
      </>}
    </div>
    {initial.mode === 'personal' && initial.showMatches && !editing && loading && <div className={`${card} mb-6`} role="status">{copy.searching}</div>}
{showingMatches && <section className={`${card} mb-6`} aria-label={copy.matchesAria}><p className="tg-eyebrow">{copy.matchesStep}</p><h2 className="mt-2 text-2xl font-semibold">{copy.exploreOptions}</h2><p className="mt-2 text-sm text-slate-400">{copy.basedOn} {chosenCountry ? `${countryName} · ` : ''}{initial.market ? initial.market.toUpperCase() : copy.anyMarket}{size ? ` · ${formatAccountSize(size)}` : ''}{budget ? ` · ${comparatorText(copy.upTo, { value: budget })}` : ''}{priorities.length ? ` · ${priorities.map((priority) => priorityLabels[priority]).join(', ')}` : ''}.</p><p className="mt-2 text-sm text-slate-400">{copy.resultsHelp}</p><p className="mt-2 text-xs text-slate-500">{copy.resultsDisclaimer}</p><button type="button" className={`${button} mt-4`} onClick={editPreferences}>{copy.editPreferences}</button>{!matching.hasExactRequirements && matching.results.length > 0 && <p className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-100">{copy.noExact}</p>}{matching.results.length === 0 ? <p className="mt-6 text-slate-300">{chosenCountry && matching.excludedByCountryCount > 0 ? comparatorText(copy.noneCountry, { country: countryName }) : copy.nonePrograms}</p> : <><div className="mt-5 grid gap-3 lg:grid-cols-3">{matching.results.slice(0, showMore ? 9 : 3).map((result) => <article key={result.firm.id} className="min-w-0 rounded-xl border border-amber-300/15 bg-[#0b1725] p-4"><div className="flex items-start gap-3"><FirmLogo url={result.firm.logoUrl} name={result.firm.name} /><div className="min-w-0"><h3 className="font-semibold text-white">{result.firm.name}</h3><p className="text-sm text-slate-400">{result.plan.challengeName}{result.plan.variantName ? ` · ${result.plan.variantName}` : ''}</p></div></div>{size !== null && <span className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${result.exactSize ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-300/10 text-amber-200"}`}>{result.exactSize ? copy.exactPlan : copy.closestPlan}</span>}{chosenCountry && <p className="mt-3 text-xs text-amber-100">{comparatorText(copy.availabilityIn, { country: countryName, status: availabilityLabel(availabilityForResult(result.firm.id).status) })}</p>}<p className="mt-3 text-sm text-slate-200">{formatAccountSize(result.plan.size)} · {money(result.plan.price, result.plan.currency) ?? copy.priceUnknown}</p><p className="mt-3 text-sm font-medium text-amber-200">{comparatorText(copy.matchesEvaluable, { matched: result.matched, evaluable: result.evaluable })}</p>{priorities.length + styles.length + (draft.platform ? 1 : 0) - result.evaluable > 0 && <p className="mt-1 text-xs text-slate-400">{comparatorText(copy.missingCriteria, { count: priorities.length + styles.length + (draft.platform ? 1 : 0) - result.evaluable })}</p>}<ul className="mt-3 space-y-1 text-sm text-slate-200">{result.reasons.map((reason) => <li key={reason}>✓ {localizedOutput(reason)}</li>)}</ul>{result.cautions.length > 0 && <div className="mt-3 border-t border-white/10 pt-3"><p className="text-xs font-semibold uppercase tracking-wide text-amber-200">{copy.consider}</p><ul className="mt-1 space-y-1 text-xs text-slate-400">{result.cautions.map((caution) => <li key={caution}>◇ {localizedOutput(caution)}</li>)}</ul></div>}<label className="mt-4 flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" className="accent-amber-400" checked={chosen.includes(result.firm.slug)} onChange={(event) => setChosen((current) => event.target.checked ? [...current, result.firm.slug].slice(0, 3) : current.filter((slug) => slug !== result.firm.slug))} disabled={!chosen.includes(result.firm.slug) && chosen.length >= 3} />{copy.compareOption}</label><Link href={`/prop-firms/${result.firm.slug}?lang=${publicUiLanguage(language)}`} className="mt-3 inline-block text-xs text-amber-200 hover:underline">{copy.viewSources}</Link></article>)}</div>{matching.results.length > 3 && <button type="button" className={`${button} mt-4`} onClick={() => setShowMore(!showMore)}>{showMore ? copy.less : copy.moreOptions}</button>}<div className="mt-6 flex flex-wrap items-end gap-3"><label className="text-sm text-slate-300">{copy.addFirm}<select className="mt-1 block w-full max-w-xs rounded-xl border border-white/15 bg-[#0a1422] p-2.5" value={manualAddition} onChange={(event) => setManualAddition(event.target.value)}><option value="">{copy.selectFirm}</option>{choices.filter((choice) => !chosen.includes(choice.slug)).map((choice) => <option key={choice.id} value={choice.slug}>{choice.name}</option>)}</select></label><button type="button" className={button} disabled={!manualAddition || chosen.length >= 3} onClick={() => { setChosen((current) => [...current, manualAddition]); setManualAddition('') }}>{copy.add}</button></div><div className="mt-5"><p className="mb-2 text-sm text-slate-400">{comparatorText(copy.compareDetail, { count: chosen.length })}</p><button type="button" className="tg-button-gold px-5 py-3 disabled:opacity-40" disabled={chosen.length === 0 || loading} onClick={compareChosen}>{copy.compareThese}</button></div></>}</section>}
    {initial.mode === 'firms' && <><section className={`${card} mb-6`} aria-label={copy.selectFirmsAria}>
      <div className="flex items-center gap-2"><SlidersHorizontal className="size-5 text-amber-300" aria-hidden="true" /><h2 className="text-xl font-semibold">{copy.chooseThree}</h2></div>
      <div className="mt-5"><CountryPicker countries={countries} value={chosenCountry} onChange={setChosenCountry} label={t('country.question')} /></div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">{[0, 1, 2].map((index) => {
        const firm = firms[index]
        return <div key={index} className="min-w-0 rounded-xl border border-amber-300/15 bg-[#0a1422] p-3">
          <button type="button" disabled={loading || index > firms.length} onClick={() => { setPickerIndex(index); setSearch(''); setPickerMarket('') }} className="flex w-full min-h-20 items-center gap-3 text-left disabled:opacity-40" aria-label={`${firm ? copy.change : copy.choose} ${copy.firm} ${['A', 'B', 'C'][index]}`}>
            {firm ? <FirmLogo url={firm.logoUrl} name={firm.name} /> : <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-amber-300/40 text-amber-200">+</span>}
            <span className="min-w-0"><span className="block text-xs uppercase tracking-wide text-amber-300">{copy.firm} {['A', 'B', 'C'][index]}{index === 2 ? ` · ${copy.optional}` : ''}</span><span className="mt-1 block truncate font-semibold text-white">{firm?.name ?? copy.selectFirm}</span><span className="block text-xs text-slate-400">{firm?.markets.join(' · ') || copy.searchCatalog}{firm && chosenCountry ? ` · ${availabilityLabel(availabilityFor(firm).status)}` : ''}</span></span>
          </button>
          {firm && <button type="button" onClick={() => removeFirm(index)} className="mt-1 text-xs text-slate-400 hover:text-amber-200" aria-label={`${copy.remove} ${firm.name}`}>{copy.remove}</button>}
        </div>
      })}</div>
      {editorialPairs.length > 0 && <div className="mt-5"><h3 className="text-sm font-semibold text-amber-100">{copy.suggestedComparisons}</h3><p className="mt-1 text-xs text-slate-400">{copy.suggestedHelp}</p><div className="mt-2 flex flex-wrap gap-2">{editorialPairs.map(([left, right]) => <button type="button" key={`${left.id}-${right.id}`} className={button} onClick={() => update({ firms: `${left.slug},${right.slug}`, plans: null })}>{left.name} vs {right.name}</button>)}</div></div>}
      {loading && <p role="status" className="mt-3 text-xs text-slate-400">{copy.updating}</p>}
    </section>
    <dialog ref={dialogRef} onClose={() => setPickerIndex(null)} onClick={(event) => { if (event.target === dialogRef.current) setPickerIndex(null) }} className="m-auto max-h-[85vh] w-[min(94vw,640px)] overflow-y-auto rounded-2xl border border-amber-300/25 bg-[#111e2e] p-4 text-white shadow-2xl backdrop:bg-black/75 sm:p-6" aria-label={copy.selectPropFirm}>
      <div className="flex items-center justify-between gap-3"><div><p className="tg-eyebrow">{copy.chooseFirm}</p><h2 className="mt-1 text-xl font-semibold">{copy.firm} {pickerIndex === null ? '' : ['A', 'B', 'C'][pickerIndex]}</h2></div><button type="button" className={button} onClick={() => setPickerIndex(null)} aria-label={copy.closeSelector}>{copy.close}</button></div>
      <div className="mt-4"><SearchInput value={search} onChange={setSearch} placeholder={copy.searchFirm} theme="dark" className="w-full" /></div>
      <div className="mt-3 flex flex-wrap gap-2">{['', ...allMarkets].map((market) => <button type="button" key={market} aria-pressed={pickerMarket === market} className={toggle(pickerMarket === market)} onClick={() => setPickerMarket(market)}>{market ? market.toUpperCase() : copy.all}</button>)}</div>
      {!search && !pickerMarket && suggested.length > 0 && <div className="mt-5"><p className="text-xs font-semibold uppercase tracking-wide text-amber-200">{copy.editorialSuggestions}</p><div className="mt-2 flex flex-wrap gap-2">{suggested.map((firm) => <button type="button" key={firm.id} disabled={selectedIds.includes(firm.slug) && firms[pickerIndex ?? 0]?.slug !== firm.slug} className={`${button} disabled:opacity-40`} onClick={() => pickerIndex !== null && selectFirm(pickerIndex, firm.slug)}>{firm.name}</button>)}</div></div>}
      <div className="mt-5 max-h-[42vh] space-y-2 overflow-y-auto pr-1" aria-label={copy.availableFirms}>{candidates.map((firm) => { const selectedElsewhere = selectedIds.includes(firm.slug) && firms[pickerIndex ?? 0]?.slug !== firm.slug; return <button type="button" key={firm.id} disabled={selectedElsewhere} onClick={() => pickerIndex !== null && selectFirm(pickerIndex, firm.slug)} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#0a1422] p-3 text-left hover:border-amber-300/50 disabled:opacity-40"><FirmLogo url={firm.logoUrl} name={firm.name} /><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{firm.name}</span><span className="block text-xs text-slate-400">{firm.markets.join(' · ') || copy.marketUnknown}{chosenCountry ? ` · ${availabilityLabel(availabilityFor(firm).status)}` : ''}</span></span>{selectedElsewhere && <span className="text-xs text-amber-200">{copy.alreadyChosen}</span>}</button> })}{!candidates.length && <p className="py-8 text-center text-sm text-slate-400">{copy.noFilterResults}</p>}</div>
    </dialog>
    {firms.length === 0 ? <div className={`${card} py-16 text-center`}><h2 className="text-2xl font-semibold">{copy.startChoosing}</h2><p className="mt-2 text-slate-400">{copy.startHelp}</p></div> : <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><label className="inline-flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={initial.differences} onChange={(event) => update({ differences: event.target.checked ? '1' : null })} className="accent-amber-400" />{copy.differencesOnly}</label><button type="button" className={button} onClick={share}><Copy className="mr-2 inline size-4" aria-hidden="true" />{copied ? copy.copied : copy.share}</button></div>
      <div className={`sticky top-0 z-30 mb-5 grid gap-2 border-y border-amber-300/15 bg-[#09111f]/95 py-2 backdrop-blur ${firms.length === 3 ? 'sm:grid-cols-3' : firms.length === 2 ? 'sm:grid-cols-2' : ''}`}>{firms.map((firm, index) => <div key={firm.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-[#111e2e] p-2"><FirmLogo url={firm.logoUrl} name={firm.name} /><div className="min-w-0 text-xs"><p className="truncate font-semibold text-sm">{firm.name}</p><p className="truncate text-slate-400">{match.plans[index]?.challengeName ?? copy.noPlan}{match.plans[index]?.variantName ? ` · ${match.plans[index]?.variantName}` : ''}</p><p className="text-slate-400">{formatAccountSize(match.plans[index]?.size ?? null)} · {match.plans[index]?.steps ?? copy.noData} {copy.phases}</p></div></div>)}</div>
      {firms.length > 1 && <section className={`${card} mb-5`}><h2 className="text-xl font-semibold">{copy.highlightedDifferences}</h2><p className="mt-1 text-sm text-slate-400">{copy.differencesHelp}</p>{importantDifferences.length ? <ul className="mt-3 flex flex-wrap gap-2">{importantDifferences.map((label) => <li key={label} className="rounded-lg border border-amber-300/20 px-3 py-1.5 text-sm text-amber-100">{label}</li>)}</ul> : <p className="mt-3 text-sm text-slate-400">{copy.noDifferences}</p>}</section>}
      <section className={`${card} mb-5`}><h2 className="text-xl font-semibold">{copy.comparedPrograms}</h2><p className="mt-1 text-sm text-slate-400">{copy.programsHelp}</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{firms.map((firm, index) => <label key={firm.id} className="text-sm text-slate-300">{firm.name} <span className="text-xs text-amber-200">· {initial.plans[index] ? copy.manualSelection : copy.automaticSelection}</span><select value={match.plans[index]?.id ?? ''} onChange={(event) => { const next = match.plans.map((plan) => plan?.id ?? ''); next[index] = event.target.value; update({ plans: next.join(',') }) }} className="mt-1 block w-full rounded-xl border border-white/15 bg-[#0a1422] p-2.5"><option value="">{copy.noPlan}</option>{firm.plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.challengeName}{plan.variantName ? ` · ${plan.variantName}` : ''} · {formatAccountSize(plan.size)} · {plan.steps ?? '?'} {copy.phases}</option>)}</select></label>)}</div>{firms.length > 1 && (match.exact ? <p className="mt-4 text-sm text-emerald-300">{copy.exactComparison}</p> : <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-100">{copy.approximateComparison} {match.notes.map(localizedOutput).join(' ') || copy.noEquivalent}</p>)}</section>
      {insights.length > 0 && <section className={`${card} mb-5`}><h2 className="text-xl font-semibold">{copy.important}</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{insights.map((insight, index) => <div key={`${insight.relatedMetric}-${index}`} className="rounded-xl border border-white/10 p-4"><span className="text-xs uppercase tracking-wide text-amber-300">{insight.type === 'review' ? copy.review : copy.accordingPriority}</span><h3 className="mt-1 font-semibold">{localizedOutput(insight.title)}</h3><p className="mt-2 text-sm text-slate-400">{localizedOutput(insight.description)}</p></div>)}</div></section>}
      {visibleSections.map((section) => <section key={section.title} className={`${card} mb-5`}><h2 className="mb-4 text-xl font-semibold">{section.title}</h2><div className="space-y-2">{section.rows.length ? section.rows.map((row) => <div key={row.label} className="rounded-xl border border-white/10 bg-[#0b1725] p-3"><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{row.label}</div>{row.hint && <details className="mt-1 text-xs text-slate-400"><summary className="inline-flex cursor-pointer items-center gap-1 rounded focus-visible:outline-2 focus-visible:outline-amber-300"><Info className="size-3.5" aria-hidden="true" />{copy.meaning}</summary><p className="mt-1 max-w-2xl">{row.hint}</p></details>}<div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{row.values.map((value, index) => <div key={firms[index].id} className="min-w-0 rounded-lg bg-white/5 px-3 py-2"><span className="block text-xs text-slate-500 sm:sr-only">{firms[index].name}</span><span className={value === null ? 'text-slate-500' : 'text-slate-100'}>{missing(value)}</span></div>)}</div></div>) : <p className="text-sm text-slate-400">{copy.noSectionDifferences}</p>}</div></section>)}
      <section className={`${card} mb-5`}><h2 className="text-xl font-semibold">{copy.availabilityDecision}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{firms.map((firm) => { const availability = availabilityFor(firm); return <div key={firm.id} className="rounded-xl border border-white/10 p-4"><h3 className="font-semibold">{firm.name}</h3><div className="mt-3 flex items-center gap-2 text-sm"><CountryFlag countryCode={firm.countryCode} language={language} /><span>{copy.originCountry}</span></div>{chosenCountry ? <><p className={`mt-3 text-sm font-semibold ${availability.status === 'restricted' ? 'text-red-300' : availability.status === 'available' ? 'text-emerald-300' : 'text-slate-300'}`}>{availability.status === 'available' ? '✓' : availability.status === 'restricted' ? '✕' : '—'} {availabilityLabel(availability.status)} {availability.status === 'unknown' ? copy.availabilityFor : copy.availabilityAt} {countryName}</p>{availability.warning && <p className="mt-1 text-xs text-slate-400">{localizedOutput(availability.warning)}</p>}</> : <p className="mt-3 text-sm text-slate-400">{copy.chooseCountry}</p>}<p className="mt-3 text-sm text-slate-400">{firm.offer ? comparatorText(copy.activeOffer, { offer: firm.offer }) : copy.noActiveOffer}</p><Link href={`/prop-firms/${firm.slug}?lang=${publicUiLanguage(language)}`} className="mt-4 inline-block text-sm text-amber-200 underline-offset-4 hover:underline">{copy.viewSources}</Link><Link href={publicPath(`/go/${firm.slug}`, language)} className="mt-4 ml-4 inline-flex items-center gap-1 text-sm text-amber-200 underline-offset-4 hover:underline">{comparatorText(copy.visit, { name: firm.name })}<ArrowUpRight className="size-4" aria-hidden="true" /></Link></div> })}</div></section>
      <p className="flex items-start gap-2 text-sm text-slate-500"><Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{copy.evidenceNotice}</p>
    </>}</>}
  </div>
}
