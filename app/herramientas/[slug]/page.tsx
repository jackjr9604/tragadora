import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getPublishedTool } from '@/lib/tools'
import { resolvePublicLanguage } from '@/lib/language'
import { publicPath } from '@/lib/public-i18n'
import { publicSeoMetadata } from '@/lib/public-seo'

export const revalidate = 60

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ lang?: string | string[] }> }): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const language = await resolvePublicLanguage(query.lang)
  const tool = await getPublishedTool(slug, language)
  return tool ? publicSeoMetadata({ path: `/herramientas/${tool.slug}`, language, title: tool.seo_title || tool.name, description: tool.seo_description || tool.short_description }) : { title: 'Herramienta no encontrada | Tradagora' }
}

export default async function LegacyToolPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ lang?: string | string[] }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const language = await resolvePublicLanguage(query.lang)
  const tool = await getPublishedTool(slug, language)
  if (!tool) notFound()
  if (tool.tool_type === 'external' && tool.external_url) redirect(tool.external_url)
  if (tool.tool_type === 'internal') redirect(publicPath(`/calculadoras/${slug}`, language))
  notFound()
}
