import { notFound, redirect } from 'next/navigation'
import { ToolForm, type ToolFormValue } from '@/components/admin/ToolForm'
import { createClient } from '@/lib/supabase/server'
import type { ToolPricingModel, ToolStatus, ToolType } from '@/lib/tools'
import { TranslationWorkflowLink } from '@/components/admin/translations/TranslationWorkflowLink'

type MediaRelation = { id: string; file_name: string; file_url: string; alt_text: string | null }

export default async function EditToolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()
  const result = await db.from('tools').select('id, slug, name, short_description, tool_type, category, icon_key, badge, internal_path, external_url, is_featured, display_order, status, open_in_new_tab, pricing_model, has_free_plan, price_label, availability, author_name, promo_code, promo_label, is_ours, logo:logo_media_id(id, file_name, file_url, alt_text)').eq('id', id).maybeSingle()
  if (result.error) throw new Error(result.error.message)
  if (!result.data) notFound()
  const row = result.data
  if (row.tool_type === 'internal') redirect(`/admin/calculators/${row.id}/edit`)
  const logo = first(row.logo as MediaRelation | MediaRelation[] | null)
  const initial: ToolFormValue = { id: row.id, slug: row.slug, name: row.name, shortDescription: row.short_description ?? '', toolType: row.tool_type as ToolType, category: row.category ?? '', iconKey: row.icon_key ?? 'calculator', badge: row.badge ?? '', internalPath: row.internal_path ?? '', externalUrl: row.external_url ?? '', isFeatured: row.is_featured, displayOrder: String(row.display_order), status: row.status as ToolStatus, openInNewTab: row.open_in_new_tab, pricingModel: (row.pricing_model ?? '') as ToolPricingModel | '', hasFreePlan: row.has_free_plan, priceLabel: row.price_label ?? '', availability: row.availability ?? '', authorName: row.author_name ?? '', promoCode: row.promo_code ?? '', promoLabel: row.promo_label ?? '', isOurs: row.is_ours, logo }
  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-4xl"><header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><h1 className="text-3xl font-bold">Editar herramienta</h1><p className="mt-1 text-slate-500">Actualiza el catálogo y la presentación de {row.name}.</p></div><TranslationWorkflowLink resourceType="tool_translation" resourceId={row.id} returnTo={`/admin/tools/${row.id}/edit`}/></header><ToolForm initial={initial} /></div></main>
}

function first<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value }
