import Link from 'next/link'
import { ArrowRight, FileText, Languages } from 'lucide-react'
import { contentPages } from '@/lib/content-schema'

export default function ContentPage() {
  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
          <h1 className="text-3xl font-bold">Contenido</h1>
          <p className="mt-1 text-slate-500">Selecciona una página para editar sus secciones e idiomas.</p>
          </div>
          <Link href="/admin/content/languages" className="inline-flex items-center gap-2 rounded-lg bg-black px-5 py-3 text-sm font-medium text-white"><Languages className="size-4" /> Gestionar idiomas</Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {contentPages.map((page) => (
            <Link key={page.slug} href={`/admin/content/${page.slug}`} className="group rounded-xl bg-white p-6 shadow transition hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-start justify-between gap-4">
                <span className="rounded-lg bg-slate-100 p-3"><FileText className="size-5" /></span>
                <ArrowRight className="size-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-black" />
              </div>
              <h2 className="mt-5 text-lg font-semibold">{page.label}</h2>
              <p className="mt-2 text-sm text-slate-500">{page.description}</p>
              <p className="mt-5 text-xs font-medium uppercase tracking-wide text-slate-400">{page.sections.length} {page.sections.length === 1 ? 'sección' : 'secciones'}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
