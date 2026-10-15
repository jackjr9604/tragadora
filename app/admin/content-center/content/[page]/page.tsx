import { notFound } from 'next/navigation'
import { PageContentEditor } from '@/components/admin/content/PageContentEditor'
import { getContentPage } from '@/lib/content-schema'

export default async function ContentCenterPageEditor({ params }: { params: Promise<{ page: string }> }) {
  const { page: slug } = await params
  const page = getContentPage(slug)
  if (!page) notFound()
  return <section className="mt-6"><div className="mb-6"><p className="text-sm font-medium text-slate-500">Contenido / {page.label}</p><h2 className="mt-1 text-2xl font-bold">Editar {page.label}</h2><p className="mt-2 text-sm text-slate-500">Administra la fuente y abre cada traducción en el workflow editorial común.</p></div><PageContentEditor page={page} /></section>
}
