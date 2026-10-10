import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getPublishedTool } from '@/lib/tools'
import { resolvePublicLanguage } from '@/lib/language'
import { publicPath } from '@/lib/public-i18n'

export const revalidate = 60

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const tool = await getPublishedTool((await params).slug)
  return tool ? { title: `${tool.name} | Tradagora`, description: tool.short_description || undefined } : { title: 'Herramienta no encontrada | Tradagora' }
}

export default async function LegacyToolPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ lang?: string | string[] }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const language = await resolvePublicLanguage(query.lang)
  const tool = await getPublishedTool(slug)
  if (!tool) notFound()
  if (tool.tool_type === 'external' && tool.external_url) redirect(tool.external_url)
  if (tool.tool_type === 'internal') redirect(publicPath(`/calculadoras/${slug}`, language))
  notFound()
}
