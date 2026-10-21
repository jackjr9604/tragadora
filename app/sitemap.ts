import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActivePublicLanguages } from '@/lib/site-content'
import { publicSitemapEntries } from '@/lib/public-sitemap-policy'

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
  const [languages, dynamicPaths] = await Promise.all([getActivePublicLanguages(), getDynamicPublicPaths()])
  return publicSitemapEntries([...PUBLIC_ROUTES, ...dynamicPaths], languages)
}

async function getDynamicPublicPaths() {
  const db = createAdminClient()
  const [platforms, posts, tools] = await Promise.all([
    db.from('platforms').select('slug,type').eq('status', 'active').in('type', ['prop_firm', 'broker', 'exchange']),
    db.from('blog_posts').select('slug').eq('status', 'published').or(`published_at.is.null,published_at.lte.${new Date().toISOString()}`),
    db.from('tools').select('slug,tool_type').eq('status', 'published').eq('tool_type', 'internal'),
  ])
  if (platforms.error || posts.error || tools.error) return []
  const paths = new Set<string>()
  for (const platform of platforms.data ?? []) {
    const prefix = platform.type === 'prop_firm' ? 'prop-firms' : platform.type === 'broker' ? 'brokers' : 'exchanges'
    paths.add(`/${prefix}/${platform.slug}`)
    if (platform.type === 'prop_firm') paths.add(`/payouts/${platform.slug}`)
  }
  for (const post of posts.data ?? []) paths.add(`/blog/${post.slug}`)
  for (const tool of tools.data ?? []) paths.add(`/calculadoras/${tool.slug}`)
  return [...paths]
}
