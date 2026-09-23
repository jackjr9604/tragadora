'use client'

import Link from 'next/link'
import { ArrowUpRight, Clock3 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SearchInput } from '@/components/shared/SearchInput'
import { ToolIcon } from '@/components/tools/ToolIcon'
import type { ToolRecord } from '@/lib/tools'

export function ToolsDirectory({ tools }: { tools: ToolRecord[] }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todas')
  const categories = useMemo(() => [...new Set(tools.map((tool) => tool.category).filter((value): value is string => Boolean(value)))], [tools])
  const visible = useMemo(() => { const query = search.trim().toLocaleLowerCase('es'); return tools.filter((tool) => category === 'Todas' || tool.category === category).filter((tool) => !query || [tool.name, tool.short_description, tool.category].some((value) => value?.toLocaleLowerCase('es').includes(query))) }, [category, search, tools])
  const featured = tools.filter((tool) => tool.is_featured).slice(0, 4)
  return <div>
    {featured.length > 0 && <section aria-labelledby="featured-tools"><p className="tg-eyebrow">Selección útil</p><h2 id="featured-tools" className="mt-2 text-2xl font-bold text-white">Herramientas destacadas</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{featured.map((tool) => <ToolCard key={tool.id} tool={tool} featured />)}</div></section>}
    <section className={featured.length ? 'mt-10' : ''} aria-labelledby="tools-catalog"><p className="tg-eyebrow">Catálogo</p><h2 id="tools-catalog" className="mt-2 text-2xl font-bold text-white">Todas las herramientas</h2>
      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#111c2e] p-3 lg:flex-row lg:items-center"><SearchInput value={search} onChange={setSearch} placeholder="Buscar herramientas..." theme="dark" className="flex-1" />{categories.length > 1 && <div className="flex flex-wrap gap-2">{['Todas', ...categories].map((value) => <button key={value} type="button" onClick={() => setCategory(value)} className={`rounded-lg border px-3.5 py-2.5 text-sm font-semibold transition ${category === value ? 'border-amber-200/55 bg-[linear-gradient(110deg,#a97313,#e8bb49_55%,#f8d779)] text-slate-950' : 'border-white/10 bg-white/5 text-slate-300 hover:border-amber-300/30'}`}>{value}</button>)}</div>}</div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map((tool) => <ToolCard key={tool.id} tool={tool} />)}</div>
      {!visible.length && <div className="tg-empty mt-5 rounded-2xl p-10 text-center text-slate-400">{tools.length ? 'No encontramos herramientas con estos filtros.' : 'Todavía no hay herramientas publicadas.'}</div>}
    </section>
  </div>
}

function ToolCard({ tool, featured = false }: { tool: ToolRecord; featured?: boolean }) {
  const destination = tool.tool_type === 'internal' ? tool.internal_path : tool.tool_type === 'external' ? tool.external_url : null
  const content = <><div className="flex items-start justify-between gap-3"><span className="flex size-11 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/[.07] text-amber-300"><ToolIcon iconKey={tool.icon_key} /></span>{tool.badge && <span className="rounded-full border border-amber-300/20 bg-amber-300/[.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-200">{tool.badge}</span>}</div><div className="mt-4"><p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-500">{tool.category || 'Recurso'}</p><h3 className="mt-1 text-lg font-bold text-white">{tool.name}</h3><p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">{tool.short_description || 'Recurso disponible en Tradagora.'}</p></div><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-amber-300">{tool.tool_type === 'internal' ? 'Usar herramienta' : tool.tool_type === 'external' ? 'Abrir recurso' : 'Próximamente'}{tool.tool_type === 'coming_soon' ? <Clock3 className="size-4" /> : <ArrowUpRight className="size-4" />}</span></>
  const className = `block rounded-2xl border bg-[#111c2e] p-5 transition ${featured ? 'border-amber-300/20 hover:border-amber-300/45' : 'border-white/10 hover:border-amber-300/30'} ${destination ? 'hover:-translate-y-0.5' : 'opacity-80'}`
  if (!destination) return <article className={className}>{content}</article>
  if (tool.tool_type === 'external') return <a href={destination} target={tool.open_in_new_tab ? '_blank' : undefined} rel={tool.open_in_new_tab ? 'noopener noreferrer' : undefined} className={className}>{content}</a>
  return <Link href={destination} className={className}>{content}</Link>
}
