import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { TranslationResourceEditor } from '@/components/admin/translations/TranslationResourceEditor'
import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'
import { publicAiEngineStatus } from '@/lib/admin-translation-ai'
import { getTranslationResourceDetail, makeResourceKey } from '@/lib/admin-translation-inventory'
import { TRANSLATION_RESOURCES, type TranslationResourceType } from '@/lib/admin-translation-inventory-policy'
import { safeContentCenterReturn } from '@/lib/admin-content-center-navigation'

export default async function TranslationResourcePage({ params, searchParams }: { params: Promise<{ resourceType: string; resourceId: string }>; searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const [{ resourceType, resourceId }, raw, access] = await Promise.all([params, searchParams, getCurrentAdminPermissions()])
  if (!(resourceType in TRANSLATION_RESOURCES)) notFound()
  const type = resourceType as TranslationResourceType
  const detail = await getTranslationResourceDetail(makeResourceKey(type, resourceId), access.permissions)
  if (!detail) notFound()
  const returnTo = safeContentCenterReturn(first(raw.returnTo))
  const ai = publicAiEngineStatus()
  return <section className="mt-6"><div className="mb-5 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-700">{TRANSLATION_RESOURCES[detail.resourceType].label}</p><h2 className="mt-1 text-2xl font-bold">{detail.origin.label}</h2><p className="mt-2 text-sm text-slate-500">{detail.summary.total} campos · {detail.summary.published} publicados · {detail.summary.pending} pendientes · {detail.summary.stale} desactualizados</p></div><div className="flex flex-wrap gap-2"><Link href={detail.origin.href} className="admin-secondary-button gap-2 px-4 py-2 text-sm">Abrir origen <ExternalLink className="size-4" /></Link><Link href={returnTo} className="admin-secondary-button px-4 py-2 text-sm">Volver al listado</Link></div></div><TranslationResourceEditor resourceKey={makeResourceKey(detail.resourceType, detail.resourceId)} fields={detail.fields} canEdit={detail.canEdit} workflowAvailable={detail.workflowAvailable} aiEnabled={ai.enabled} aiProvider={ai.provider} aiMessage={ai.message} /></section>
}

function first(value:string|string[]|undefined) { return Array.isArray(value)?value[0]:value }
