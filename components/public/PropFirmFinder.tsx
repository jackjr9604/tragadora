'use client'

import { type FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, ExternalLink, Info, X } from 'lucide-react'
import type { HomePlatform, PublicCountry } from '@/lib/home-data'
import { localizeFinderReason, publicFinderCopy, publicLocale, publicPath, publicUiLanguage } from '@/lib/public-i18n'
import type { PublicLanguage } from '@/lib/public-language'
import { recommendPropFirms, type RecommendableFirm, type RecommendationCriteria } from '@/lib/prop-firm-recommender'
import { PlatformLogo } from './PlatformLogo'

const fallbackCountryCodes = ['CO', 'MX', 'AR', 'CL', 'PE', 'BR', 'EC', 'PA', 'DO'] as const

export function PropFirmFinder({ firms, countries, language, initial, badge, title, subtitle, cta }: {
  firms: RecommendableFirm[]; countries: PublicCountry[]; language: PublicLanguage; initial: Partial<RecommendationCriteria>
  badge: string; title: string; subtitle: string; cta: string
}) {
  const router = useRouter()
  const copy = publicFinderCopy[publicUiLanguage(language)]
  const locale = publicLocale(language)
  const [step, setStep] = useState(1)
  const [searched, setSearched] = useState(false)
  const [criteria, setCriteria] = useState<RecommendationCriteria>({
    country: initial.country ?? '', market: initial.market ?? '', experience: initial.experience ?? '',
    budget: initial.budget ?? null, accountSize: initial.accountSize ?? null, evaluation: initial.evaluation ?? 'any',
    priority: initial.priority ?? 'payouts', styles: initial.styles ?? [], payoutPreference: initial.payoutPreference ?? 'verified',
  })
  const results = useMemo(() => searched ? recommendPropFirms(criteria, firms) : [], [criteria, firms, searched])
  const fallbackCountries: PublicCountry[] = fallbackCountryCodes.map((code) => ({ code, name: copy.countries[code] }))
  const countryOptions = countries.length ? countries : fallbackCountries
  const set = <K extends keyof RecommendationCriteria>(key: K, value: RecommendationCriteria[K]) => setCriteria((current) => ({ ...current, [key]: value }))
  const toggleStyle = (style: string) => set('styles', criteria.styles.includes(style) ? criteria.styles.filter((item) => item !== style) : [...criteria.styles, style])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (step < 4) { setStep(step + 1); return }
    setSearched(true)
    const params = new URLSearchParams(window.location.search)
    params.set('lang', language)
    if (criteria.country) params.set('country', criteria.country); else params.delete('country')
    if (criteria.market) params.set('market', criteria.market); else params.delete('market')
    if (criteria.experience) params.set('experience', criteria.experience); else params.delete('experience')
    if (criteria.budget !== null) params.set('budget', String(criteria.budget)); else params.delete('budget')
    if (criteria.accountSize !== null) params.set('account', String(criteria.accountSize)); else params.delete('account')
    router.replace(`/?${params.toString()}#resultados`, { scroll: false })
    requestAnimationFrame(() => document.getElementById('resultados')?.scrollIntoView({ behavior: 'smooth' }))
  }

  const marketOptions = [['', copy.noPreference], ['cfd', 'Forex / CFD'], ['futures', copy.futures], ['crypto', copy.crypto], ['other', copy.other]]
  const experienceOptions = [['', copy.select], ['beginner', copy.beginner], ['intermediate', copy.intermediate], ['advanced', copy.advanced]]
  const budgetOptions = [['', copy.undefined], ['49', copy.under50], ['100', '$50 - $100'], ['200', '$100 - $200'], ['500', '$200 - $500'], ['100000', copy.over500]]
  const sizeOptions = [['', copy.noPreference], ['5000', '$5K'], ['10000', '$10K'], ['25000', '$25K'], ['50000', '$50K'], ['100000', '$100K'], ['200000', '$200K+']]

  return <section className="relative z-10 mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8"><div className="overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(22,201,180,.12),rgba(17,28,46,.96)_45%,rgba(247,198,75,.08))] shadow-2xl shadow-black/20"><div className="grid lg:grid-cols-[.72fr_1.28fr]"><div className="border-b border-white/10 p-7 sm:p-10 lg:border-b-0 lg:border-r"><p className="font-mono text-xs uppercase tracking-[.2em] text-cyan-300">{badge}</p><h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2><p className="mt-4 leading-7 text-slate-400">{subtitle}</p><div className="mt-8 space-y-3">{copy.steps.map((label, index) => <button key={label} type="button" onClick={() => setStep(index + 1)} aria-current={step === index + 1 ? 'step' : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${step === index + 1 ? 'bg-white/8 text-white' : 'text-slate-500'}`}><span className={`flex size-7 items-center justify-center rounded-full font-mono text-xs ${step > index + 1 ? 'bg-cyan-300 text-slate-950' : step === index + 1 ? 'bg-[#f7c64b] text-slate-950' : 'bg-white/5'}`}>{step > index + 1 ? <Check className="size-4" aria-hidden="true" /> : index + 1}</span>{label}</button>)}</div></div>
        <form onSubmit={submit} className="p-6 sm:p-10">
          <p className="mb-6 text-sm font-semibold text-slate-300">{copy.step} {step} {copy.of} 4</p>
          {step === 1 && <div className="grid gap-5 sm:grid-cols-2"><Select label={copy.country} value={criteria.country} onChange={(value) => set('country', value)} options={[['', copy.selectCountry], ...countryOptions.map((country) => [country.code, country.name])]} /><Select label={copy.market} value={criteria.market} onChange={(value) => set('market', value)} options={marketOptions} /><Select label={copy.experience} value={criteria.experience} onChange={(value) => set('experience', value)} options={experienceOptions} /></div>}
          {step === 2 && <div className="grid gap-5 sm:grid-cols-2"><Select label={copy.maxBudget} value={criteria.budget?.toString() ?? ''} onChange={(value) => set('budget', value ? Number(value) : null)} options={budgetOptions} /><Select label={copy.accountSize} value={criteria.accountSize?.toString() ?? ''} onChange={(value) => set('accountSize', value ? Number(value) : null)} options={sizeOptions} /><Select label={copy.evaluation} value={criteria.evaluation} onChange={(value) => set('evaluation', value)} options={[['1step', '1 Step'], ['2step', '2 Step'], ['instantfunding', copy.instantFunding], ['any', copy.noPreference]]} /></div>}
          {step === 3 && <div><p className="mb-3 text-sm font-medium text-slate-300">{copy.tradingStyle}</p><div className="grid gap-3 sm:grid-cols-2">{[['ea', 'EA / Bots'], ['news', copy.news], ['weekend', copy.weekend], ['scalping', 'Scalping'], ['day', copy.dayTrading], ['copy', 'Copy Trading']].map(([value, label]) => <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${criteria.styles.includes(value) ? 'border-cyan-300/40 bg-cyan-300/8' : 'border-white/10 bg-white/[.025]'}`}><input type="checkbox" checked={criteria.styles.includes(value)} onChange={() => toggleStyle(value)} />{label}</label>)}</div></div>}
          {step === 4 && <div className="grid gap-5"><Select label={copy.priority} value={criteria.priority} onChange={(value) => set('priority', value)} options={[['price', copy.lowPrice], ['rules', copy.flexibleRules], ['split', copy.highSplit], ['payouts', copy.verifiablePayouts], ['drawdown', copy.wideDrawdown], ['time', copy.noTimeLimit]]} /><Select label={copy.payoutPreference} value={criteria.payoutPreference} onChange={(value) => set('payoutPreference', value as RecommendationCriteria['payoutPreference'])} options={[['fast', copy.fastPayout], ['verified', copy.payoutHistory], ['any', copy.notImportant]]} /></div>}
          <div className="mt-8 flex justify-between gap-3"><button type="button" aria-disabled={step === 1} onClick={() => setStep((currentStep) => Math.max(1, currentStep - 1))} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm aria-disabled:pointer-events-none aria-disabled:opacity-30"><ArrowLeft className="size-4" aria-hidden="true" /> {copy.previous}</button><button className="inline-flex items-center gap-2 rounded-xl bg-[#f7c64b] px-5 py-3 font-bold text-slate-950">{step === 4 ? cta : copy.continue} <ArrowRight className="size-4" aria-hidden="true" /></button></div>
        </form></div></div>
      {searched && <div id="resultados" className="scroll-mt-28 pt-14"><div><p className="font-mono text-xs uppercase tracking-[.2em] text-cyan-300">{copy.transparentResults}</p><h2 className="mt-3 text-3xl font-bold">{copy.bestOptions}</h2><p className="mt-2 text-slate-400">{copy.disclaimer}</p></div><div className="mt-7 grid gap-5">{results.length ? results.map((result, index) => {
        const platform: HomePlatform = { id: result.firm.id, name: result.firm.name, slug: result.firm.slug, score: result.firm.score, logoUrl: result.firm.logoUrl, logoAlt: result.firm.logoAlt, description: null, profitSplit: result.firm.profitSplit, supportsEa: result.firm.supportsEa, allowsNews: result.firm.allowsNews, allowsWeekend: result.firm.allowsWeekend, allowsScalping: result.firm.allowsScalping, allowsDayTrading: result.firm.allowsDayTrading, allowsCopyTrading: result.firm.allowsCopyTrading, markets: result.firm.markets }
        const reason = (value: string) => localizeFinderReason(value, language)
        return <article key={result.firm.id} className="rounded-2xl border border-white/10 bg-[#111c2e] p-6"><div className="grid gap-6 lg:grid-cols-[auto_1fr_auto]"><span className="font-mono text-2xl text-[#f7c64b]">#{index + 1}</span><div><div className="flex items-center gap-3"><PlatformLogo platform={platform} /><div><h3 className="text-xl font-bold">{result.firm.name}</h3><p className="text-sm text-slate-500">{reason(result.firm.verificationLabel)}</p></div></div><div className="mt-5 grid gap-5 lg:grid-cols-3"><ReasonList title={copy.matches} emptyLabel={copy.none} tone="positive" reasons={result.positives.map(reason)} /><ReasonList title={copy.incompatibilities} emptyLabel={copy.none} tone="negative" reasons={result.negatives.map(reason)} /><ReasonList title={copy.missingInformation} emptyLabel={copy.none} tone="unknown" reasons={result.unavailable.map(reason)} /></div></div><div className="lg:text-right"><strong className="text-xl text-white">{interpolate(copy.matchesCount, { matched: result.matchedPreferences, total: result.totalPreferences || 1 })}</strong><p className="text-xs text-slate-500">{copy.preferences}</p>{result.recommendedPlan && <p className="mt-4 text-sm text-slate-300">{copy.planFrom} {result.recommendedPlan.price !== null ? `$${result.recommendedPlan.price}` : copy.priceUnavailable}<br />{copy.account} {result.recommendedPlan.accountSize !== null ? `$${result.recommendedPlan.accountSize.toLocaleString(locale)}` : copy.undefinedAccount}</p>}<div className="mt-5 flex gap-2 lg:justify-end"><Link href={`/prop-firms/${result.firm.slug}?lang=${language}`} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold">{copy.details}</Link><Link href={publicPath(`/go/${result.firm.slug}`, language)} className="inline-flex items-center gap-2 rounded-lg bg-[#f7c64b] px-4 py-2 text-sm font-bold text-slate-950">{copy.visit} <ExternalLink className="size-4" aria-hidden="true" /></Link></div></div></div>{result.firm.activeOffer && <p className="mt-5 rounded-lg bg-amber-300/10 px-4 py-3 text-sm text-amber-200">{copy.activeOffer}: {result.firm.activeOffer.title}</p>}</article>
      }) : <p className="rounded-2xl border border-white/10 p-8 text-slate-400">{copy.noResults}</p>}</div></div>}
    </section>
}

function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template)
}

function ReasonList({ title, emptyLabel, tone, reasons }: { title: string; emptyLabel: string; tone: 'positive' | 'negative' | 'unknown'; reasons: string[] }) {
  const Icon = tone === 'positive' ? Check : tone === 'negative' ? X : Info
  const color = tone === 'positive' ? 'text-emerald-400' : tone === 'negative' ? 'text-rose-400' : 'text-slate-500'
  return <div><p className={`text-xs font-semibold uppercase ${color}`}>{title}</p>{reasons.length ? reasons.slice(0, 5).map((reason) => <p key={reason} className="mt-2 flex gap-2 text-sm text-slate-300"><Icon className={`mt-0.5 size-4 shrink-0 ${color}`} aria-hidden="true" />{reason}</p>) : <p className="mt-2 text-sm text-slate-600">{emptyLabel}</p>}</div>
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <label className="grid gap-2 text-sm text-slate-300">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-white/10 bg-[#131f31] px-4 py-3 text-white outline-none focus:border-cyan-300/50">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>
}
