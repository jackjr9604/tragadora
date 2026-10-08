import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getPublishedTool } from '@/lib/tools'

export const revalidate = 60

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const tool = await getPublishedTool((await params).slug)
  return tool ? { title: `${tool.name} | Tradagora`, description: tool.short_description || undefined } : { title: 'Herramienta no encontrada | Tradagora' }
}

export default async function LegacyToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tool = await getPublishedTool(slug)
  if (!tool) notFound()
  if (tool.tool_type === 'external' && tool.external_url) redirect(tool.external_url)
  if (tool.tool_type === 'internal') redirect(`/calculadoras/${slug}`)
  notFound()
}
