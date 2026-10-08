'use client'

import { ArrowUpRight, Check, Clock3, Gift, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ToolIcon } from '@/components/tools/ToolIcon'
import type { PublicLanguage } from '@/lib/public-language'
import type { ToolPricingModel, ToolRecord } from '@/lib/tools'
import { filterTools } from '@/lib/tools-filter'

const FILTERS = [
  { value: 'all', es: 'Todas', en: 'All', pt: 'Todas' },
  { value: 'Gráficos y datos', es: 'Gráficos y datos', en: 'Charts & data', pt: 'Gráficos e dados' },
  { value: 'Indicadores', es: 'Indicadores', en: 'Indicators', pt: 'Indicadores' },
  { value: 'Noticias y calendario', es: 'Noticias y calendario', en: 'News & calendar', pt: 'Notícias e calendário' },
  { value: 'Plataformas', es: 'Plataformas', en: 'Platforms', pt: 'Plataformas' },
  { value: 'Diario de trading', es: 'Diario de trading', en: 'Trading journal', pt: 'Diário de trading' },
] as const

const COPY = {
  es: { freePlan: 'Con plan gratis', price: 'Precio', works: 'Dónde funciona', author: 'Autor', own: 'NUESTRO', visit: 'Ir al sitio oficial', soon: 'Próximamente', empty: 'No hay herramientas que coincidan con estos filtros.', clear: 'Limpiar filtros', disclaimer: 'Tradagora no garantiza la disponibilidad, precios ni resultados de servicios externos. Verifica siempre las condiciones en el sitio oficial.', promo: 'Promoción' },
  en: { freePlan: 'Free plan available', price: 'Price', works: 'Works on', author: 'Author', own: 'OURS', visit: 'Go to official site', soon: 'Coming soon', empty: 'No tools match these filters.', clear: 'Clear filters', disclaimer: 'Tradagora does not guarantee the availability, pricing, or results of external services. Always verify the terms on the official website.', promo: 'Promotion' },
  pt: { freePlan: 'Com plano grátis', price: 'Preço', works: 'Onde funciona', author: 'Autor', own: 'NOSSO', visit: 'Ir ao site oficial', soon: 'Em breve', empty: 'Nenhuma ferramenta corresponde a estes filtros.', clear: 'Limpar filtros', disclaimer: 'A Tradagora não garante disponibilidade, preços ou resultados de serviços externos. Verifique sempre as condições no site oficial.', promo: 'Promoção' },
} as const

const PRICE = {
  es: { free: 'Gratis', freemium: 'Freemium', paid: 'De pago' },
  en: { free: 'Free', freemium: 'Freemium', paid: 'Paid' },
  pt: { free: 'Grátis', freemium: 'Freemium', paid: 'Pago' },
} as const

export function ToolsDirectory({ tools, language = 'es' }: { tools: ToolRecord[]; language?: PublicLanguage }) {
  const locale = language in COPY ? language as keyof typeof COPY : 'es'
  const text = COPY[locale]
  const [category, setCategory] = useState('all')
  const [freeOnly, setFreeOnly] = useState(false)
  const visible = useMemo(() => filterTools(tools, category, freeOnly), [category, freeOnly, tools])

  return <div>
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#101b2d]/95 p-3 shadow-[0_18px_50px_rgba(0,0,0,.2)] lg:flex-row lg:items-center lg:justify-between">
      <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0">
        {FILTERS.map((filter) => <button key={filter.value} type="button" onClick={() => setCategory(filter.value)} aria-pressed={category === filter.value} className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${category === filter.value ? 'border-amber-200/55 bg-[linear-gradient(115deg,#a97313,#edc55e_58%,#f9dc8b)] text-slate-950 shadow-[0_8px_25px_rgba(224,171,52,.16)]' : 'border-white/10 bg-white/[.035] text-slate-300 hover:border-amber-300/30 hover:text-white'}`}>{filter[locale]}</button>)}
      </div>
      <button type="button" onClick={() => setFreeOnly((current) => !current)} aria-pressed={freeOnly} className={`inline-flex shrink-0 items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm font-semibold transition lg:justify-center ${freeOnly ? 'border-emerald-300/35 bg-emerald-300/[.09] text-emerald-200' : 'border-white/10 bg-[#081321] text-slate-300 hover:border-amber-300/25'}`}><span className={`flex size-5 items-center justify-center rounded-md border ${freeOnly ? 'border-emerald-300 bg-emerald-300 text-[#07111e]' : 'border-white/20'}`}>{freeOnly && <Check className="size-3.5" />}</span>{text.freePlan}</button>
    </div>

    <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visible.map((tool) => <ToolCard key={tool.id} tool={tool} language={locale} />)}</div>
    {!visible.length && <div className="tg-empty mt-6 rounded-2xl border border-dashed border-white/12 p-12 text-center"><SlidersHorizontal className="mx-auto size-8 text-amber-300/70" /><p className="mt-4 text-base font-semibold text-white">{text.empty}</p><button type="button" onClick={() => { setCategory('all'); setFreeOnly(false) }} className="mt-4 text-sm font-semibold text-amber-300 hover:text-amber-200">{text.clear}</button></div>}

    <p className="mt-8 rounded-2xl border border-white/8 bg-white/[.025] px-5 py-4 text-xs leading-5 text-slate-500">{text.disclaimer}</p>
  </div>
}

function ToolCard({ tool, language }: { tool: ToolRecord; language: keyof typeof COPY }) {
  const text = COPY[language]
  const pricing = tool.pricing_model ? PRICE[language][tool.pricing_model] : null
  const destination = tool.tool_type === 'external' ? tool.external_url : null
  return <article className="group relative flex min-h-[390px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(22,36,58,.98),rgba(10,20,35,.98))] p-5 transition duration-300 hover:-translate-y-1 hover:border-amber-300/40 hover:shadow-[0_22px_55px_rgba(0,0,0,.3)]">
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(240,196,84,.75),transparent)] opacity-0 transition group-hover:opacity-100" />
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">{tool.logo_url ? <ToolLogo src={tool.logo_url} alt={tool.logo_alt || tool.name} /> : <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/[.07] text-amber-300"><ToolIcon iconKey={tool.icon_key} className="size-6" /></span>}<div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-lg font-bold text-white">{tool.name}</h2>{tool.is_ours && <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[9px] font-black tracking-[.12em] text-slate-950">{text.own}</span>}</div>{tool.category && <p className="mt-1 text-xs font-semibold uppercase tracking-[.13em] text-slate-500">{tool.category}</p>}</div></div>
      {(pricing || tool.badge) && <span className="shrink-0 rounded-full border border-amber-300/25 bg-amber-300/[.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-amber-200">{pricing || tool.badge}</span>}
    </div>
    <p className="mt-5 text-sm leading-6 text-slate-400">{tool.short_description || 'Recurso para complementar tu operativa y análisis.'}</p>
    <dl className="mt-5 divide-y divide-white/8 border-y border-white/8 text-sm">
      <Spec label={text.price} value={tool.price_label || pricing || '—'} />
      <Spec label={text.works} value={tool.availability || '—'} />
      {tool.author_name && <Spec label={text.author} value={tool.author_name} />}
    </dl>
    {(tool.promo_code || tool.promo_label) && <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[.055] p-3"><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-amber-300"><Gift className="size-3.5" />{text.promo}</p><div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-slate-300">{tool.promo_label || 'Código disponible'}</span>{tool.promo_code && <code className="rounded-md border border-amber-300/20 bg-[#07111e] px-2 py-1 text-xs font-bold text-amber-200">{tool.promo_code}</code>}</div></div>}
    <div className="mt-auto pt-5">{destination ? <a href={destination} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/[.08] px-4 py-3 text-sm font-bold text-amber-200 transition hover:bg-amber-300 hover:text-slate-950">{text.visit}<ArrowUpRight className="size-4" /></a> : <span className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/8 bg-white/[.025] px-4 py-3 text-sm font-semibold text-slate-500">{text.soon}<Clock3 className="size-4" /></span>}</div>
  </article>
}

function Spec({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 py-3"><dt className="text-slate-500">{label}</dt><dd className="text-right font-medium text-slate-200">{value}</dd></div> }

function ToolLogo({ src, alt }: { src: string; alt: string }) {
  // URLs administradas desde Multimedia/Supabase Storage.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="size-12 shrink-0 rounded-xl border border-white/10 bg-white object-contain p-1.5" />
}

export function pricingLabel(model: ToolPricingModel | null, language: keyof typeof PRICE = 'es') {
  return model ? PRICE[language][model] : null
}
