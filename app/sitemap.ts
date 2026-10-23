import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActivePublicLanguages } from '@/lib/site-content'
import {
  dynamicPublicPathsFromRows,
  resilientPublicSitemapData,
  safeSitemapRows,
  type SitemapPlatformRow,
  type SitemapSlugRow,
} from '@/lib/public-sitemap-data'
import { publicSitemapEntries } from '@/lib/public-sitemap-policy'

export const revalidate = 300

const PUBLIC_ROUTES = [
  '/',
  '/payouts',
  '/prop-firms',
  '/comparador',
  '/ofertas',
  '/brokers',
  '/herramientas',
  '/calculadoras',
  '/calculadoras/drawdown',
  '/calculadoras/profit-split',
  '/calculadoras/challenge-target',
  '/comunidades',
  '/exchanges',
  '/blog',
  '/giveaway',
] as const

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { paths, languages } = await resilientPublicSitemapData({
    staticPaths: PUBLIC_ROUTES,
    loadLanguages: getActivePublicLanguages,
    loadDynamicPaths: getDynamicPublicPaths,
  })
  return publicSitemapEntries(paths, languages)
}

async function getDynamicPublicPaths() {
  try {
    const db = createAdminClient()
    const publishedBefore = new Date().toISOString()
    const [platforms, posts, tools] = await Promise.all([
      safeSitemapRows<SitemapPlatformRow>('platforms', (signal) => db.from('platforms').select('slug,type').eq('status', 'active').in('type', ['prop_firm', 'broker', 'exchange']).abortSignal(signal)),
      safeSitemapRows<SitemapSlugRow>('blog_posts', (signal) => db.from('blog_posts').select('slug').eq('status', 'published').or(`published_at.is.null,published_at.lte.${publishedBefore}`).abortSignal(signal)),
      safeSitemapRows<SitemapSlugRow>('tools', (signal) => db.from('tools').select('slug').eq('status', 'published').eq('tool_type', 'internal').abortSignal(signal)),
    ])
    return dynamicPublicPathsFromRows({ platforms, posts, tools })
  } catch {
    console.warn('sitemap_dynamic_sources_unavailable')
    return []
  }
}
