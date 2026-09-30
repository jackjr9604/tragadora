import 'server-only'
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { BRANDING_CACHE_TAG, BRANDING_SLOTS, type BrandingAsset, type BrandingConfig, type BrandingSlotKey } from '@/lib/branding-config'

type MediaJoin = { id: string; file_name: string; file_url: string; file_type: string | null; alt_text: string | null }
type BrandingRow = { key: BrandingSlotKey; media_id: string; alt_text: string | null; media: MediaJoin | MediaJoin[] | null }

function first<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value }

function staticAsset(key: BrandingSlotKey, url: string): BrandingAsset {
  return { key, mediaId: null, fileName: url.split('/').pop() ?? 'Tradagora', url, alt: 'Tradagora', fileType: 'image/png', configured: false }
}

async function queryBranding(): Promise<BrandingConfig> {
  let rows: BrandingRow[] = []
  try {
    const result = await createAdminClient().from('branding_assets').select('key, media_id, alt_text, media:media_id(id, file_name, file_url, file_type, alt_text)')
    if (!result.error) rows = (result.data ?? []) as unknown as BrandingRow[]
  } catch {
    // La aplicación conserva assets estáticos antes de aplicar la migración o ante una caída externa.
  }

  const configured = new Map<BrandingSlotKey, BrandingAsset>()
  for (const row of rows) {
    const media = first(row.media)
    if (!media?.file_url) continue
    configured.set(row.key, { key: row.key, mediaId: media.id, fileName: media.file_name, url: media.file_url, alt: row.alt_text || media.alt_text || 'Tradagora', fileType: media.file_type, configured: true })
  }

  const resolved = {} as BrandingConfig
  function resolve(key: BrandingSlotKey, trail = new Set<BrandingSlotKey>()): BrandingAsset {
    const direct = configured.get(key)
    if (direct) return direct
    const slot = BRANDING_SLOTS.find((item) => item.key === key)!
    if (slot.fallback.startsWith('/')) return staticAsset(key, slot.fallback)
    if (trail.has(key)) return staticAsset(key, '/brand/tradagora-icon.png')
    trail.add(key)
    const inherited = resolve(slot.fallback as BrandingSlotKey, trail)
    return { ...inherited, key, configured: false }
  }
  for (const slot of BRANDING_SLOTS) resolved[slot.key] = resolve(slot.key)
  return resolved
}

export const getBranding = unstable_cache(queryBranding, ['global-branding-v2'], { revalidate: 3600, tags: [BRANDING_CACHE_TAG] })
