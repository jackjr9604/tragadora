import 'server-only'

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getBranding } from '@/lib/branding'
import type { BrandingSlotKey } from '@/lib/branding-config'

// El navegador siempre revalida la URL estable; el servidor conserva el asset
// y la configuración cacheados, invalidados por el administrador de Branding.
const CACHE_CONTROL = 'public, max-age=0, s-maxage=3600, must-revalidate'

export async function brandingAssetResponse(key: BrandingSlotKey, staticFallback: string) {
  const branding = await getBranding()
  const asset = branding[key]

  try {
    return await assetResponse(asset.url, asset.fileType)
  } catch {
    return assetResponse(staticFallback, 'image/png')
  }
}

async function assetResponse(source: string, declaredType: string | null) {
  if (source.startsWith('/')) {
    const relativePath = source.replace(/^\/+/, '')
    const body = await readFile(join(process.cwd(), 'public', relativePath))
    return new Response(body, { headers: { 'content-type': declaredType || 'image/png', 'cache-control': CACHE_CONTROL } })
  }

  const url = new URL(source)
  if (url.protocol !== 'https:') throw new Error('Brand asset must use HTTPS.')
  const response = await fetch(url, { next: { revalidate: 3600 } })
  if (!response.ok) throw new Error(`Brand asset returned ${response.status}.`)
  return new Response(await response.arrayBuffer(), {
    headers: {
      'content-type': response.headers.get('content-type') || declaredType || 'image/png',
      'cache-control': CACHE_CONTROL,
    },
  })
}
