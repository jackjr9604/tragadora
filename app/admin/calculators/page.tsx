import Link from 'next/link'
import { AdminAction } from '@/components/admin/AdminPermissionsProvider'
import { AdminFirmIdentity } from '@/components/admin/AdminDirectory'
import { createClient } from '@/lib/supabase/server'

export default async function AdminCalculatorsPage() {
  const db = await createClient()
  const result = await db.from('tools').select('id, slug, name, category, display_order, status, logo:logo_media_id(file_url, alt_text)').eq('tool_type', 'internal').order('display_order').order('name')
  if (result.error) throw new Error(result.error.message)

  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-5xl"><header className="mb-8"><h1 className="text-3xl font-bold">Calculadoras</h1><p className="mt-1 text-slate-500">Contenido editorial, visibilidad y orden de las calculadoras internas. Las fórmulas permanecen en código.</p></header>
    <div className="overflow-hidden rounded-xl bg-white shadow"><div className="hidden grid-cols-[1.5fr_1fr_100px_100px] gap-4 border-b bg-slate-50 px-5 py-3 text-xs font-semibold uppercase text-slate-500 md:grid"><span>Calculadora</span><span>Categoría</span><span>Estado</span><span></span></div>{(result.data ?? []).map((calculator) => <div key={calculator.id} className="grid gap-3 border-b px-5 py-4 last:border-0 md:grid-cols-[1.5fr_1fr_100px_100px] md:items-center"><div><AdminFirmIdentity name={calculator.name} media={calculator.logo} /><p className="ml-[52px] text-xs text-slate-500">/{calculator.slug} · orden {calculator.display_order}</p></div><span className="text-sm text-slate-600">{calculator.category || '—'}</span><span className="text-sm">{calculator.status === 'published' ? 'Visible' : 'Oculta'}</span><AdminAction permission="tools.update"><Link href={`/admin/calculators/${calculator.id}/edit`} className="rounded-lg border px-3 py-2 text-center text-sm font-medium">Editar</Link></AdminAction></div>)}{!result.data?.length && <p className="p-10 text-center text-slate-500">No hay calculadoras internas registradas.</p>}</div>
  </div></main>
}
