import { redirect } from 'next/navigation'
import { BrandingManager } from '@/components/admin/BrandingManager'
import { getCurrentAdminPermissions, hasPermission } from '@/lib/admin-permissions-server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBranding } from '@/lib/branding'
import type { BrandingSlotKey } from '@/lib/branding-config'

type Row = { key: BrandingSlotKey; alt_text: string | null; media: { id: string; file_name: string; file_url: string; alt_text: string | null } | Array<{ id: string; file_name: string; file_url: string; alt_text: string | null }> | null }

export default async function BrandingPage() {
  const access = await getCurrentAdminPermissions()
  if (!hasPermission(access, 'branding.view')) redirect('/admin/denied')
  const [result, resolved] = await Promise.all([
    createAdminClient().from('branding_assets').select('key, alt_text, media:media_id(id, file_name, file_url, alt_text)'),
    getBranding(),
  ])
  const initial = Object.fromEntries(((result.data ?? []) as unknown as Row[]).flatMap((row) => {
    const media = Array.isArray(row.media) ? row.media[0] : row.media
    return media ? [[row.key, { ...media, alt_text: row.alt_text ?? media.alt_text }]] : []
  }))
  return <main className="p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-[1500px]"><header className="mb-6"><h1 className="text-3xl font-bold">Identidad visual</h1><p className="mt-1 text-sm text-slate-500">Asigna archivos de Multimedia a cada uso global de la marca. Los slots vacíos conservan fallbacks seguros.</p></header>{result.error ? <p className="rounded-lg bg-red-50 p-4 text-red-700">No se pudo cargar Branding: {result.error.message}. Aplica primero la migración correspondiente.</p> : <BrandingManager initial={initial} resolved={resolved} canCreate={hasPermission(access, 'branding.create')} canUpdate={hasPermission(access, 'branding.update')} canDelete={hasPermission(access, 'branding.delete')} canUploadMedia={hasPermission(access, 'media.create')} />}</div></main>
}
