'use client'

import Link from 'next/link'
import { BookOpen, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

export type DocumentationSummary = { id: string; slug: string; title: string; excerpt: string | null; section: string; subsection: string | null; audience: string; status: string; sort_order: number; updated_at: string; body_markdown: string }

const ADMIN_MODULES = ['Prop Firms', 'Payouts', 'Ofertas', 'Affiliate Links', 'Brokers', 'Exchanges', 'Herramientas', 'Comunidades', 'Blog', 'Giveaways', 'Media', 'Home', 'Usuarios y permisos']
const REFERENCE_MODULES = ['Conceptos y glosario', 'Funcionamiento de Tragadora', 'Documentación técnica', 'Mantenimiento y errores']
const DOCS_MODULES = ['Documentación']
const MODULE_DESCRIPTIONS: Record<string, string> = {
  'Prop Firms': 'Firmas, reglas, Challenges, geografía y métricas.',
  Payouts: 'Fuentes, evidencia, snapshots, mappings y collectors.',
  Ofertas: 'Promociones, códigos, vigencia y presentación pública.',
  'Affiliate Links': 'Destinos comerciales, prioridad y tracking.',
  Brokers: 'Información, mercados, regulación y presentación.',
  Exchanges: 'Tipo, productos, soporte fiat y regulación.',
  Herramientas: 'Herramientas internas, externas y próximas.',
  Comunidades: 'Canales, clasificación, enlaces y publicación.',
  Blog: 'Artículos, Markdown, categorías y publicación.',
  Giveaways: 'Campañas, premios, fechas, reveal y cierre.',
  Media: 'Archivos, categorías, logos, covers y reutilización.',
  Home: 'Firmas destacadas y contenido administrable del inicio.',
  'Usuarios y permisos': 'Roles, permisos, overrides y acceso.',
  'Conceptos y glosario': 'Términos compartidos por todo el sistema.',
  'Funcionamiento de Tragadora': 'Modelo funcional, comparador, datos y afiliación.',
  'Documentación técnica': 'Next.js, Supabase, RLS, caché y arquitectura.',
  'Mantenimiento y errores': 'Build, migraciones, Git y troubleshooting.',
  Documentación: 'Cómo buscar, crear y mantener esta Wiki.',
}

export function DocumentationWiki({ articles, canCreate, initialSection }: { articles: DocumentationSummary[]; canCreate: boolean; initialSection?: string }) {
  const [query, setQuery] = useState('')
  const [section, setSection] = useState<string | null>(initialSection && articles.some((article) => article.section === initialSection) ? initialSection : null)
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const normalizedQuery = query.trim().toLocaleLowerCase('es')
  const sections = useMemo(() => [...new Set(articles.map((article) => article.section))], [articles])
  const matching = useMemo(() => articles.filter((article) => !normalizedQuery || [article.title, article.excerpt, article.section, article.subsection, article.body_markdown].some((value) => value?.toLocaleLowerCase('es').includes(normalizedQuery))), [articles, normalizedQuery])
  const sectionArticles = section ? articles.filter((article) => article.section === section) : []

  function selectSection(value: string | null) { setSection(value); setQuery(''); setMobileNavigationOpen(false) }

  return (
    <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="h-fit rounded-xl border bg-white p-3 shadow-sm lg:sticky lg:top-5">
        <button type="button" onClick={() => setMobileNavigationOpen((current) => !current)} className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-semibold lg:hidden"><span>{section ?? 'Explorar módulos'}</span><ChevronDown className={`size-4 transition ${mobileNavigationOpen ? 'rotate-180' : ''}`} /></button>
        <div className={`${mobileNavigationOpen ? 'block' : 'hidden'} pt-2 lg:block lg:pt-0`}>
          <button onClick={() => selectSection(null)} className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold ${section === null ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'}`}>Toda la documentación</button>
          <SidebarGroup title="Administrar" items={ADMIN_MODULES} available={sections} selected={section} onSelect={selectSection} />
          <SidebarGroup title="Referencia" items={REFERENCE_MODULES} available={sections} selected={section} onSelect={selectSection} />
          <SidebarGroup title="Documentación" items={DOCS_MODULES} available={sections} selected={section} onSelect={selectSection} />
          {canCreate && <Link href="/admin/docs/new" className="mt-4 block rounded-lg bg-black px-4 py-2.5 text-center text-sm font-semibold text-white">+ Nuevo artículo</Link>}
        </div>
      </aside>

      <section className="min-w-0">
        <div className="admin-docs-header rounded-2xl p-6 sm:p-8">
          <p className="admin-docs-eyebrow text-xs font-semibold uppercase tracking-[.18em]">Base de conocimiento interna</p>
          <h1 className="mt-2 text-3xl font-bold">{section ?? 'Documentación de Tragadora'}</h1>
          <p className="mt-3 max-w-2xl text-slate-600">{section ? MODULE_DESCRIPTIONS[section] ?? 'Manual administrativo y operativo del módulo.' : 'Manual funcional, administrativo y operativo.'}</p>
          <label className="admin-docs-search mt-6 flex max-w-xl items-center gap-2 rounded-lg border bg-white px-3">
            <Search className="size-4 text-slate-500" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en todos los artículos..." className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm outline-none placeholder:text-slate-400" />
          </label>
        </div>

        {normalizedQuery ? <SearchResults articles={matching} query={query} /> : section ? <ModuleHub articles={sectionArticles} /> : <DocumentationHome articles={articles} available={sections} onSelect={selectSection} />}
      </section>
    </div>
  )
}

function SidebarGroup({ title, items, available, selected, onSelect }: { title: string; items: string[]; available: string[]; selected: string | null; onSelect: (value: string) => void }) {
  return <div className="mt-5"><p className="px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">{title}</p><nav className="mt-1 space-y-0.5">{items.filter((item) => available.includes(item)).map((item) => <button key={item} onClick={() => onSelect(item)} className={`admin-docs-nav-item flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm ${selected === item ? 'is-selected font-semibold' : 'text-slate-600'}`}><span>{item}</span><ChevronRight className="size-3.5" /></button>)}</nav></div>
}

function DocumentationHome({ articles, available, onSelect }: { articles: DocumentationSummary[]; available: string[]; onSelect: (value: string) => void }) {
  return <div className="mt-7 space-y-8"><ModuleGrid title="Administrar" items={ADMIN_MODULES} articles={articles} available={available} onSelect={onSelect} /><ModuleGrid title="Referencia" items={REFERENCE_MODULES} articles={articles} available={available} onSelect={onSelect} /><ModuleGrid title="Documentación" items={DOCS_MODULES} articles={articles} available={available} onSelect={onSelect} /></div>
}

function ModuleGrid({ title, items, articles, available, onSelect }: { title: string; items: string[]; articles: DocumentationSummary[]; available: string[]; onSelect: (value: string) => void }) {
  return <section><h2 className="text-sm font-bold uppercase tracking-[.14em] text-slate-500">{title}</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.filter((item) => available.includes(item)).map((item) => { const count = articles.filter((article) => article.section === item).length; return <button key={item} onClick={() => onSelect(item)} className="admin-docs-module-card group flex min-h-32 flex-col rounded-xl border bg-white p-4 text-left shadow-sm transition"><div className="flex items-center justify-between"><BookOpen className="admin-docs-gold-icon size-5" /><span className="text-xs text-slate-400">{count} {count === 1 ? 'artículo' : 'artículos'}</span></div><h3 className="mt-3 font-bold text-slate-950">{item}</h3><p className="mt-1 line-clamp-2 text-sm text-slate-500">{MODULE_DESCRIPTIONS[item]}</p><span className="admin-docs-card-cta mt-auto pt-3 text-xs font-semibold">Abrir manual <span aria-hidden="true">→</span></span></button> })}</div></section>
}

function ModuleHub({ articles }: { articles: DocumentationSummary[] }) {
  const groups = groupArticles(articles)
  return <div className="mt-7 space-y-7"><div className="rounded-xl border bg-white p-5 shadow-sm"><p className="text-sm leading-6 text-slate-600">Explora el manual por tarea o bloque de la pantalla. Los artículos conservan su contenido detallado y están ordenados por subsección.</p></div>{groups.map(([subsection, items]) => <section key={subsection}><h2 className="mb-3 text-sm font-bold uppercase tracking-[.12em] text-slate-500">{subsection}</h2><div className="overflow-hidden rounded-xl border bg-white shadow-sm">{items.map((article, index) => <Link key={article.id} href={`/admin/docs/${article.slug}`} className={`admin-docs-article-link flex items-center justify-between gap-4 p-4 transition ${index ? 'border-t' : ''}`}><div className="min-w-0"><h3 className="font-semibold text-slate-950">{article.title}</h3><p className="mt-1 line-clamp-2 text-sm text-slate-500">{article.excerpt || 'Sin resumen.'}</p></div><ChevronRight className="admin-docs-gold-icon size-4 shrink-0" /></Link>)}</div></section>)}</div>
}

function SearchResults({ articles, query }: { articles: DocumentationSummary[]; query: string }) {
  return <div className="mt-7"><p className="mb-3 text-sm text-slate-500">{articles.length} resultados para “{query.trim()}” en toda la documentación</p><div className="overflow-hidden rounded-xl border bg-white">{articles.map((article, index) => <Link key={article.id} href={`/admin/docs/${article.slug}`} className={`admin-docs-article-link flex items-center justify-between gap-4 p-4 ${index ? 'border-t' : ''}`}><div><p className="admin-docs-result-label text-xs font-semibold uppercase tracking-wider">{article.section}{article.subsection ? ` · ${article.subsection}` : ''}</p><h2 className="mt-1 font-semibold">{article.title}</h2><p className="mt-1 line-clamp-1 text-sm text-slate-500">{article.excerpt}</p></div><ChevronRight className="admin-docs-gold-icon size-4 shrink-0" /></Link>)}</div>{!articles.length && <div className="rounded-xl border border-dashed bg-white p-10 text-center text-slate-500">No encontramos artículos.</div>}</div>
}

function groupArticles(articles: DocumentationSummary[]) {
  const groups = new Map<string, DocumentationSummary[]>()
  for (const article of articles) { const key = article.subsection || 'Resumen'; groups.set(key, [...(groups.get(key) ?? []), article]) }
  return [...groups.entries()]
}
