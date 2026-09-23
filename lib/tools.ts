import 'server-only'
import { createClient } from '@/lib/supabase/server'

export type ToolType = 'internal' | 'external' | 'coming_soon'
export type ToolStatus = 'draft' | 'published'

export type ToolRecord = {
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
}

const TOOL_FIELDS = 'id, slug, name, short_description, tool_type, category, icon_key, badge, internal_path, external_url, is_featured, display_order, status, open_in_new_tab'

export async function getPublishedTools(): Promise<ToolRecord[]> {
  const db = await createClient()
  const result = await db.from('tools').select(TOOL_FIELDS).eq('status', 'published').order('display_order').order('name')
  if (result.error) throw new Error(result.error.message)
  return (result.data ?? []) as ToolRecord[]
}

export async function getPublishedTool(slug: string): Promise<ToolRecord | null> {
  const db = await createClient()
  const result = await db.from('tools').select(TOOL_FIELDS).eq('slug', slug).eq('status', 'published').maybeSingle()
  if (result.error) throw new Error(result.error.message)
  return result.data as ToolRecord | null
}
