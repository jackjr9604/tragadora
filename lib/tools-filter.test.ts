import assert from 'node:assert/strict'
import test from 'node:test'
import { filterTools } from './tools-filter'
import type { ToolRecord } from './tools'

const tools = [
  tool('charts', 'Gráficos y datos', 'freemium', true),
  tool('indicator', 'Indicadores', 'paid', false),
  tool('news', 'Noticias y calendario', 'free', true),
  tool('platform', 'Plataformas', 'paid', false),
  tool('journal', 'Diario de trading', 'freemium', true),
]

test('cada categoría devuelve únicamente sus herramientas', () => {
  for (const item of tools) assert.deepEqual(filterTools(tools, item.category!, false).map((tool) => tool.slug), [item.slug])
})

test('Todas conserva el catálogo completo', () => {
  assert.equal(filterTools(tools, 'all', false).length, tools.length)
})

test('Con plan gratis incluye free y freemium configurado con plan gratis', () => {
  assert.deepEqual(filterTools(tools, 'all', true).map((tool) => tool.slug), ['charts', 'news', 'journal'])
})

test('una combinación sin coincidencias produce estado vacío', () => {
  assert.deepEqual(filterTools(tools, 'Indicadores', true), [])
})

function tool(slug: string, category: string, pricing: ToolRecord['pricing_model'], hasFreePlan: boolean): ToolRecord {
  return {
    id: slug, slug, name: slug, short_description: null, tool_type: 'external', category,
    icon_key: null, badge: null, internal_path: null, external_url: `https://example.com/${slug}`,
    is_featured: false, display_order: 100, status: 'published', open_in_new_tab: true,
    pricing_model: pricing, has_free_plan: hasFreePlan, price_label: null, availability: null,
    author_name: null, promo_code: null, promo_label: null, is_ours: false,
    logo_media_id: null, logo_url: null, logo_alt: null,
  }
}
