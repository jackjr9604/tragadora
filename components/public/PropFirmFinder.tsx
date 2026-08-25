'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, ExternalLink, Info, X } from 'lucide-react'
import type { PublicCountry } from '@/lib/home-data'
import { recommendPropFirms, type RecommendableFirm, type RecommendationCriteria } from '@/lib/prop-firm-recommender'
import type { PublicLanguage } from '@/lib/public-language'
import { PlatformLogo } from './PlatformLogo'
import type { HomePlatform } from '@/lib/home-data'

const fallbackCountries: PublicCountry[] = [
  { code: 'CO', name: 'Colombia' }, { code: 'MX', name: 'México' }, { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' }, { code: 'PE', name: 'Perú' }, { code: 'BR', name: 'Brasil' },
  { code: 'EC', name: 'Ecuador' }, { code: 'PA', name: 'Panamá' }, { code: 'DO', name: 'República Dominicana' },
]

export function PropFirmFinder({ firms, countries, language, initial, badge, title, subtitle, cta }: {
  firms: RecommendableFirm[]; countries: PublicCountry[]; language: PublicLanguage; initial: Partial<RecommendationCriteria>
  badge: string; title: string; subtitle: string; cta: string
}) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [searched, setSearched] = useState(false)
  const [criteria, setCriteria] = useState<RecommendationCriteria>({
    country: initial.country ?? '', market: initial.market ?? '', experience: initial.experience ?? '',
    budget: initial.budget ?? null, accountSize: initial.accountSize ?? null, evaluation: initial.evaluation ?? 'any',
    priority: initial.priority ?? 'payouts', styles: initial.styles ?? [], payoutPreference: initial.payoutPreference ?? 'verified',
  })
  const results = useMemo(() => searched ? recommendPropFirms(criteria, firms) : [], [criteria, firms, searched])
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

  return <section className="relative z-10 mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8"><div className="overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(22,201,180,.12),rgba(17,28,46,.96)_45%,rgba(247,198,75,.08))] shadow-2xl shadow-black/20"><div className="grid lg:grid-cols-[.72fr_1.28fr]"><div className="border-b border-white/10 p-7 sm:p-10 lg:border-b-0 lg:border-r"><p className="font-mono text-xs uppercase tracking-[.2em] text-cyan-300">{badge}</p><h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2><p className="mt-4 leading-7 text-slate-400">{subtitle}</p><div className="mt-8 space-y-3">{['Qué quieres operar', 'Cuánto quieres invertir', 'Cómo operas', 'Qué priorizas'].map((label, index) => <button key={label} type="button" onClick={() => setStep(index + 1)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${step === index + 1 ? 'bg-white/8 text-white' : 'text-slate-500'}`}><span className={`flex size-7 items-center justify-center rounded-full font-mono text-xs ${step > index + 1 ? 'bg-cyan-300 text-slate-950' : step === index + 1 ? 'bg-[#f7c64b] text-slate-950' : 'bg-white/5'}`}>{step > index + 1 ? <Check className="size-4" /> : index + 1}</span>{label}</button>)}</div></div>
        <form onSubmit={submit} className="p-6 sm:p-10">
          <p className="mb-6 text-sm font-semibold text-slate-300">Paso {step} de 4</p>
          {step === 1 && <div className="grid gap-5 sm:grid-cols-2"><Select label="País" value={criteria.country} onChange={(value) => set('country', value)} options={[['', 'Seleccionar país'], ...countryOptions.map((country) => [country.code, country.name])]} /><Select label="Mercado" value={criteria.market} onChange={(value) => set('market', value)} options={[['', 'Sin preferencia'], ['cfd', 'Forex / CFD'], ['futures', 'Futuros'], ['crypto', 'Cripto'], ['other', 'Otros']]} /><Select label="Experiencia" value={criteria.experience} onChange={(value) => set('experience', value)} options={[['', 'Seleccionar'], ['beginner', 'Principiante'], ['intermediate', 'Intermedio'], ['advanced', 'Avanzado']]} /></div>}
          {step === 2 && <div className="grid gap-5 sm:grid-cols-2"><Select label="Presupuesto máximo" value={criteria.budget?.toString() ?? ''} onChange={(value) => set('budget', value ? Number(value) : null)} options={[['', 'Sin definir'], ['49', 'Menos de $50'], ['100', '$50 - $100'], ['200', '$100 - $200'], ['500', '$200 - $500'], ['100000', 'Más de $500']]} /><Select label="Tamaño de cuenta deseado" value={criteria.accountSize?.toString() ?? ''} onChange={(value) => set('accountSize', value ? Number(value) : null)} options={[['', 'Sin preferencia'], ['5000', '$5K'], ['10000', '$10K'], ['25000', '$25K'], ['50000', '$50K'], ['100000', '$100K'], ['200000', '$200K+']]} /><Select label="Tipo de evaluación" value={criteria.evaluation} onChange={(value) => set('evaluation', value)} options={[['1step', '1 Step'], ['2step', '2 Step'], ['instantfunding', 'Instant Funding'], ['any', 'Sin preferencia']]} /></div>}
          {step === 3 && <div><p className="mb-3 text-sm font-medium text-slate-300">Estilo de trading</p><div className="grid gap-3 sm:grid-cols-2">{[['ea', 'EA / Bots'], ['news', 'Noticias'], ['weekend', 'Swing / fin de semana'], ['scalping', 'Scalping'], ['day', 'Day trading']].map(([value, label]) => <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${criteria.styles.includes(value) ? 'border-cyan-300/40 bg-cyan-300/8' : 'border-white/10 bg-white/[.025]'}`}><input type="checkbox" checked={criteria.styles.includes(value)} onChange={() => toggleStyle(value)} />{label}</label>)}</div></div>}
          {step === 4 && <div className="grid gap-5"><Select label="Prioridad principal" value={criteria.priority} onChange={(value) => set('priority', value)} options={[['price', 'Precio bajo'], ['rules', 'Reglas flexibles'], ['split', 'Profit split alto'], ['payouts', 'Payouts comprobables'], ['drawdown', 'Drawdown amplio'], ['time', 'Sin límite de tiempo']]} /><Select label="Preferencia de payouts" value={criteria.payoutPreference} onChange={(value) => set('payoutPreference', value as 'verified' | 'any')} options={[['verified', 'Priorizar payouts verificables'], ['any', 'No es importante']]} /></div>}
          <div className="mt-8 flex justify-between gap-3"><button type="button" aria-disabled={step === 1} onClick={() => setStep((currentStep) => Math.max(1, currentStep - 1))} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm aria-disabled:pointer-events-none aria-disabled:opacity-30"><ArrowLeft className="size-4" /> Anterior</button><button className="inline-flex items-center gap-2 rounded-xl bg-[#f7c64b] px-5 py-3 font-bold text-slate-950">{step === 4 ? cta : 'Continuar'} <ArrowRight className="size-4" /></button></div>
        </form></div></div>
      {searched && <div id="resultados" className="scroll-mt-28 pt-14"><div><p className="font-mono text-xs uppercase tracking-[.2em] text-cyan-300">Resultados transparentes</p><h2 className="mt-3 text-3xl font-bold">Tus mejores opciones</h2><p className="mt-2 text-slate-400">El porcentaje considera únicamente los datos disponibles. No es asesoría financiera.</p></div><div className="mt-7 grid gap-5">{results.length ? results.map((result, index) => {
        const platform: HomePlatform = { id: result.firm.id, name: result.firm.name, slug: result.firm.slug, score: result.firm.score, logoUrl: result.firm.logoUrl, logoAlt: result.firm.logoAlt, description: null, profitSplit: result.firm.profitSplit, supportsEa: result.firm.supportsEa, allowsNews: result.firm.allowsNews, allowsWeekend: result.firm.allowsWeekend }
        return <article key={result.firm.id} className="rounded-2xl border border-white/10 bg-[#111c2e] p-6"><div className="grid gap-6 lg:grid-cols-[auto_1fr_auto]"><span className="font-mono text-2xl text-[#f7c64b]">#{index + 1}</span><div><div className="flex items-center gap-3"><PlatformLogo platform={platform} /><div><h3 className="text-xl font-bold">{result.firm.name}</h3><p className="text-sm text-slate-500">Score público {result.firm.score ?? 'Dato no disponible'} · {result.firm.verificationLabel}</p></div></div><div className="mt-5 grid gap-4 md:grid-cols-2"><div><p className="text-xs font-semibold uppercase text-emerald-400">Coincidencias</p>{result.positives.slice(0, 5).map((reason) => <p key={reason} className="mt-2 flex gap-2 text-sm text-slate-300"><Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />{reason}</p>)}</div><div>{result.negatives.map((reason) => <p key={reason} className="mt-2 flex gap-2 text-sm text-slate-400"><X className="mt-0.5 size-4 shrink-0 text-rose-400" />{reason}</p>)}{result.unavailable.slice(0, 3).map((reason) => <p key={reason} className="mt-2 flex gap-2 text-sm text-slate-500"><Info className="mt-0.5 size-4 shrink-0" />{reason}</p>)}</div></div></div><div className="lg:text-right"><strong className="font-mono text-4xl text-emerald-400">{result.compatibility}%</strong><p className="text-xs text-slate-500">compatibilidad</p>{result.recommendedPlan && <p className="mt-4 text-sm text-slate-300">Plan desde {result.recommendedPlan.price !== null ? `$${result.recommendedPlan.price}` : 'precio no disponible'}<br />Cuenta {result.recommendedPlan.accountSize !== null ? `$${result.recommendedPlan.accountSize.toLocaleString()}` : 'por definir'}</p>}<div className="mt-5 flex gap-2 lg:justify-end"><Link href={`/prop-firms?lang=${language}`} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold">Ver detalles</Link><Link href={`/go/${result.firm.slug}`} className="inline-flex items-center gap-2 rounded-lg bg-[#f7c64b] px-4 py-2 text-sm font-bold text-slate-950">Visitar <ExternalLink className="size-4" /></Link></div></div></div>{result.firm.activeOffer && <p className="mt-5 rounded-lg bg-amber-300/10 px-4 py-3 text-sm text-amber-200">Oferta activa: {result.firm.activeOffer.title}</p>}</article>
      }) : <p className="rounded-2xl border border-white/10 p-8 text-slate-400">No encontramos firmas compatibles con los filtros obligatorios.</p>}</div></div>}
    </section>
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <label className="grid gap-2 text-sm text-slate-300">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-white/10 bg-[#131f31] px-4 py-3 text-white outline-none focus:border-cyan-300/50">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>
}
