import { notFound } from 'next/navigation'
import { PageContentEditor } from '@/components/admin/content/PageContentEditor'
import { getContentPage } from '@/lib/content-schema'

export default async function AdminContentPage({ params }: { params: Promise<{ page: string }> }) {
  const { page: slug } = await params
  const page = getContentPage(slug)
  if (!page) notFound()
  return <main className="min-h-screen bg-slate-100 p-8"><div className="mx-auto max-w-7xl"><div className="mb-8"><p className="text-sm font-medium text-slate-500">Contenido / {page.label}</p><h1 className="mt-1 text-3xl font-bold">Editar {page.label}</h1><p className="mt-2 text-slate-500">Administra cada sección sin trabajar directamente con claves técnicas.</p></div><PageContentEditor page={page} /></div></main>
}
