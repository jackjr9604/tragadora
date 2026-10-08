import type { ToolRecord } from '@/lib/tools'

export function filterTools(tools: ToolRecord[], category: string, freeOnly: boolean) {
  return tools
    .filter((tool) => category === 'all' || tool.category === category)
    .filter((tool) => !freeOnly || tool.has_free_plan || tool.pricing_model === 'free')
}
