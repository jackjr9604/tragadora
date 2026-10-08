import { notFound } from 'next/navigation'
import { ToolForm, type ToolFormValue } from '@/components/admin/ToolForm'
import { createClient } from '@/lib/supabase/server'
import type { ToolPricingModel, ToolStatus, ToolType } from '@/lib/tools'

type Media = { id: string; file_name: string; file_url: string; alt_text: string | null }
const first = <T,>(value: T | T[] | null): T | null => Array.isArray(value) ? value[0] ?? null : value

export default async function EditCalculatorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()
  const result = await db.from('tools').select('id, slug, name, short_description, tool_type, category, icon_key, badge, internal_path, external_url, is_featured, display_order, status, open_in_new_tab, pricing_model, has_free_plan, price_label, availability, author_name, promo_code, promo_label, is_ours, logo:logo_media_id(id, file_name, file_url, alt_text)').eq('id', id).eq('tool_type', 'internal').maybeSingle()
  if (result.error) throw new Error(result.error.message)
  if (!result.data) notFound()
  const row = result.data
  const initial: ToolFormValue = { id: row.id, slug: row.slug, name: row.name, shortDescription: row.short_description ?? '', toolType: row.tool_type as ToolType, category: row.category ?? '', iconKey: row.icon_key ?? 'calculator', badge: row.badge ?? '', internalPath: row.internal_path ?? '', externalUrl: row.external_url ?? '', isFeatured: row.is_featured, displayOrder: String(row.display_order), status: row.status as ToolStatus, openInNewTab: row.open_in_new_tab, pricingModel: (row.pricing_model ?? '') as ToolPricingModel | '', hasFreePlan: row.has_free_plan ?? false, priceLabel: row.price_label ?? '', availability: row.availability ?? '', authorName: row.author_name ?? '', promoCode: row.promo_code ?? '', promoLabel: row.promo_label ?? '', isOurs: row.is_ours ?? true, logo: first(row.logo as Media | Media[] | null) }
  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-4xl"><h1 className="mb-2 text-3xl font-bold">Editar calculadora</h1><p className="mb-8 text-sm text-slate-500">Solo contenido editorial. La ruta y la fórmula no pueden modificarse aquí.</p><ToolForm initial={initial} mode="calculator" /></div></main>
}
