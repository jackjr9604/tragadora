import assert from 'node:assert/strict'
import test from 'node:test'
import { isBlogSourceInput, isSafeBlogSlug, isUuid } from './admin-blog-source-policy'

const valid = {
  id: '123e4567-e89b-42d3-a456-426614174000', title: 'Artículo', slug: 'articulo-prueba', excerpt: null,
  bodyMarkdown: '# Contenido', category: null, tags: ['Mercados'], coverMediaId: null, authorName: null,
  featured: false, status: 'draft' as const, publishedAt: null,
}

test('acepta exclusivamente el contrato editable del Blog', () => {
  assert.equal(isBlogSourceInput(valid), true)
  assert.equal(isBlogSourceInput({ ...valid, id: undefined }), true)
  assert.equal(isBlogSourceInput(null), false)
  assert.equal(isBlogSourceInput({ ...valid, tags: 'Mercados' }), false)
  assert.equal(isBlogSourceInput({ ...valid, status: 'archived' }), false)
  assert.equal(isBlogSourceInput({ ...valid, title: 'x'.repeat(301) }), false)
  assert.equal(isBlogSourceInput({ ...valid, extra: 'ignorado' }), true)
})

test('rechaza UUID ambiguos y segmentos de ruta inseguros', () => {
  assert.equal(isUuid(valid.id), true)
  assert.equal(isUuid('123e4567---------------------------'), false)
  assert.equal(isSafeBlogSlug('mercados-2026'), true)
  for (const slug of ['', 'con espacio', '../admin', 'post?draft=1', 'post#fragmento']) assert.equal(isSafeBlogSlug(slug), false)
})
