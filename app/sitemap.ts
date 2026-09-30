import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site-url'

const PUBLIC_ROUTES = [
  '/',
  '/payouts',
  '/prop-firms',
  '/comparador',
  '/ofertas',
  '/brokers',
  '/herramientas',
  '/comunidades',
  '/exchanges',
  '/blog',
  '/giveaway',
] as const

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((path) => ({
    url: new URL(path, SITE_URL).toString(),
    changeFrequency: path === '/' ? 'daily' : 'weekly',
    priority: path === '/' ? 1 : 0.8,
  }))
}
