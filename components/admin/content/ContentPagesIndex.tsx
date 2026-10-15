import Link from 'next/link'
import { ArrowRight, FileText } from 'lucide-react'
import { contentPages } from '@/lib/content-schema'

export function ContentPagesIndex() {
  return <section className="mt-6"><div className="mb-6"><h2 className="text-2xl font-bold">Contenido fuente</h2><p className="mt-1 text-sm text-slate-500">Selecciona una página para editar sus secciones y configuración global.</p></div><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{contentPages.map((page) => <Link key={page.slug} href={`/admin/content-center/content/${page.slug}`} className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-amber-300 hover:shadow-md"><div className="flex items-start justify-between gap-4"><span className="rounded-lg bg-slate-100 p-3"><FileText className="size-5" /></span><ArrowRight className="size-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-black" /></div><h3 className="mt-5 text-lg font-semibold">{page.label}</h3><p className="mt-2 text-sm text-slate-500">{page.description}</p><p className="mt-5 text-xs font-medium uppercase tracking-wide text-slate-400">{page.sections.length} {page.sections.length === 1 ? 'sección' : 'secciones'}</p></Link>)}</div></section>
}
