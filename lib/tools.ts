import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getPublicToolTranslations } from '@/lib/public-tool-translations'

export type ToolType = 'internal' | 'external' | 'coming_soon'
export type ToolStatus = 'draft' | 'published'
export type ToolPricingModel = 'free' | 'freemium' | 'paid'

type MediaRelation = { file_url: string; alt_text: string | null }

type ToolRow = {
  id: string
  slug: string
  name: string
  short_description: string | null
  tool_type: ToolType
  category: string | null
  icon_key: string | null
  badge: string | null
  internal_path: string | null
  external_url: string | null
  is_featured: boolean
  display_order: number
  status: ToolStatus
  open_in_new_tab: boolean
  pricing_model: ToolPricingModel | null
  has_free_plan: boolean
  price_label: string | null
  availability: string | null
  author_name: string | null
  promo_code: string | null
  promo_label: string | null
  is_ours: boolean
  logo_media_id: string | null
  logo: MediaRelation | MediaRelation[] | null
}

export type ToolRecord = Omit<ToolRow, 'logo'> & {
  logo_url: string | null
  logo_alt: string | null
  category_label?: string | null
  seo_title?: string | null
  seo_description?: string | null
}

export const TOOL_SELECT = `
  id, slug, name, short_description, tool_type, category, icon_key, badge,
  internal_path, external_url, is_featured, display_order, status,
  open_in_new_tab, pricing_model, has_free_plan, price_label, availability,
  author_name, promo_code, promo_label, is_ours, logo_media_id,
  logo:logo_media_id(file_url, alt_text)
`

export async function getPublishedTools(language = 'es'): Promise<ToolRecord[]> {
  const db = await createClient()
  const result = await db.from('tools').select(TOOL_SELECT).eq('status', 'published').in('tool_type', ['external', 'coming_soon']).order('is_featured', { ascending: false }).order('display_order').order('name')
  if (result.error) throw new Error(result.error.message)
  return localizeTools(mapTools(result.data as ToolRow[] | null), language)
}

export async function getPublishedCalculators(language = 'es'): Promise<ToolRecord[]> {
  const db = await createClient()
  const result = await db.from('tools').select(TOOL_SELECT).eq('status', 'published').eq('tool_type', 'internal').order('display_order').order('name')
  if (result.error) throw new Error(result.error.message)
  return localizeTools(mapTools(result.data as ToolRow[] | null), language)
}

export async function getPublishedTool(slug: string, language = 'es'): Promise<ToolRecord | null> {
  const db = await createClient()
  const result = await db.from('tools').select(TOOL_SELECT).eq('slug', slug).eq('status', 'published').maybeSingle()
  if (result.error) throw new Error(result.error.message)
  if (!result.data) return null
  return (await localizeTools([mapTool(result.data as ToolRow)], language))[0] ?? null
}

async function localizeTools(tools: ToolRecord[], language: string): Promise<ToolRecord[]> {
  const translations = await getPublicToolTranslations(tools, language)
  return tools.map((tool) => ({ ...tool, ...translations.get(tool.id) }))
}

function mapTools(rows: ToolRow[] | null): ToolRecord[] {
  return (rows ?? []).map(mapTool)
}

function mapTool(row: ToolRow): ToolRecord {
  const { logo: relation, ...tool } = row
  const logo = Array.isArray(relation) ? relation[0] ?? null : relation
  return { ...tool, logo_url: logo?.file_url ?? null, logo_alt: logo?.alt_text ?? row.name }
}
