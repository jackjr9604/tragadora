import 'server-only'

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export type PublicSearchItem = {
  id: string
  name: string
  slug: string
  type: 'prop_firm' | 'broker' | 'exchange' | 'tool' | 'calculator'
  logoUrl: string | null
  logoAlt: string | null
}

type MediaRelation = { file_url: string; alt_text: string | null }

async function queryPublicSearchIndex(): Promise<PublicSearchItem[]> {
  const db = createAdminClient()
  const [platformResult, toolResult] = await Promise.all([
    db
      .from('platforms')
      .select('id, name, slug, type, logo_url, media:logo_media_id(file_url, alt_text)')
      .in('type', ['prop_firm', 'broker', 'exchange'])
      .eq('status', 'active')
      .order('name'),
    db
      .from('tools')
      .select('id, name, slug, tool_type')
      .in('tool_type', ['internal', 'external'])
      .eq('status', 'published')
      .order('name'),
  ])

  if (platformResult.error) throw new Error(`PUBLIC_SEARCH_QUERY_FAILED ${platformResult.error.message}`)
  if (toolResult.error) throw new Error(`PUBLIC_SEARCH_TOOLS_QUERY_FAILED ${toolResult.error.message}`)

  const platforms = (platformResult.data ?? []).flatMap((row) => {
    if (row.type !== 'prop_firm' && row.type !== 'broker' && row.type !== 'exchange') return []
    const media = first(row.media as MediaRelation | MediaRelation[] | null)
    return [{
      id: row.id,
      name: row.name,
      slug: row.slug,
      type: row.type,
      logoUrl: media?.file_url ?? row.logo_url ?? null,
      logoAlt: media?.alt_text ?? row.name,
    }]
  })

  const tools: PublicSearchItem[] = (toolResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.tool_type === 'internal' ? 'calculator' : 'tool',
    logoUrl: null,
    logoAlt: row.name,
  }))

  return [...platforms, ...tools]
}

export const getPublicSearchIndex = unstable_cache(
  queryPublicSearchIndex,
  ['public-global-search-v2'],
  { revalidate: 300, tags: ['public-platform-search'] },
)

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}
