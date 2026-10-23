import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveBlogTranslations, type BlogSource, type BlogTranslationRow } from './public-blog-translation-policy'
import type { TranslationFieldState } from './public-platform-translation-policy'

const languages = [{ code: 'es', is_active: true, is_default: true, publication_status: 'published' }, { code: 'en', is_active: true, is_default: false, publication_status: 'published' }, { code: 'pt', is_active: true, is_default: false, publication_status: 'published' }]
const posts: BlogSource[] = [{ id: 'one', title: 'Título', excerpt: 'Extracto', bodyMarkdown: 'Texto `código`\n\n[Enlace](/ruta)', category: 'Análisis', tags: ['Mercados'] }]
const translations: BlogTranslationRow[] = [{ blog_post_id: 'one', language: 'en', title: 'Title', excerpt: 'Excerpt', body_markdown: 'Text `code`\n\n[Link](/route)', category: 'Analysis', tags: ['Markets'] }, { blog_post_id: 'one', language: 'pt', title: 'Título PT', excerpt: 'Resumo', body_markdown: 'Texto `código`', category: 'Análise', tags: ['Mercados'] }]
const state = (field: string, language = 'en', overrides: Partial<TranslationFieldState> = {}): TranslationFieldState => ({ resource_type: 'blog_post_translation', resource_id: 'one', field_name: field, target_language: language, source_hash: 'same', translated_source_hash: 'same', source_revision: 2, translated_revision: 2, status: 'reviewed', is_protected: true, ...overrides })
const states = ['title', 'excerpt', 'body_markdown', 'category', 'tags'].flatMap((field) => [state(field), state(field, 'pt')])

test('resuelve ES EN PT por campo y preserva Markdown y tags', () => {
  const en = resolveBlogTranslations({ posts, requestedLanguage: 'en', defaultLanguage: 'es', languages, translations, states }).get('one')
  assert.deepEqual(en, { title: 'Title', excerpt: 'Excerpt', bodyMarkdown: 'Text `code`\n\n[Link](/route)', category: 'Analysis', tags: ['Markets'] })
  assert.equal(resolveBlogTranslations({ posts, requestedLanguage: 'pt', defaultLanguage: 'es', languages, translations, states }).get('one')?.excerpt, 'Resumo')
  assert.equal(resolveBlogTranslations({ posts, requestedLanguage: 'es', defaultLanguage: 'es', languages, translations, states }).size, 0)
})

test('rechaza stale, revisiones antiguas, arrays inválidos e idiomas no publicados', () => {
  const stale = states.map((item) => item.field_name === 'title' && item.target_language === 'en' ? { ...item, status: 'stale' } : item)
  assert.equal(resolveBlogTranslations({ posts, requestedLanguage: 'en', defaultLanguage: 'es', languages, translations, states: stale }).get('one')?.title, undefined)
  const invalid = translations.map((row) => row.language === 'en' ? { ...row, tags: ['Markets', 3] } : row)
  assert.equal(resolveBlogTranslations({ posts, requestedLanguage: 'en', defaultLanguage: 'es', languages, translations: invalid, states }).get('one')?.tags, undefined)
  const unpublished = languages.map((item) => item.code === 'en' ? { ...item, publication_status: 'review' } : item)
  assert.equal(resolveBlogTranslations({ posts, requestedLanguage: 'en', defaultLanguage: 'es', languages: unpublished, translations, states }).size, 0)
})

test('admite importaciones históricas solo cuando están protegidas y vigentes', () => {
  const imported = states.map((item) => item.target_language === 'en' ? { ...item, status: 'imported_unreviewed', is_protected: true } : item)
  assert.equal(resolveBlogTranslations({ posts, requestedLanguage: 'en', defaultLanguage: 'es', languages, translations, states: imported }).get('one')?.title, 'Title')
  const unprotected = imported.map((item) => item.field_name === 'title' && item.target_language === 'en' ? { ...item, is_protected: false } : item)
  assert.equal(resolveBlogTranslations({ posts, requestedLanguage: 'en', defaultLanguage: 'es', languages, translations, states: unprotected }).get('one')?.title, undefined)
})

test('excluye machine_translated, draft y unpublished aunque exista una fila traducida', () => {
  for (const status of ['machine_translated', 'draft']) {
    const changed = states.map((item) => item.field_name === 'title' && item.target_language === 'en' ? { ...item, status } : item)
    assert.equal(resolveBlogTranslations({ posts, requestedLanguage: 'en', defaultLanguage: 'es', languages, translations, states: changed }).get('one')?.title, undefined)
  }
  const unpublished = states.map((item) => item.field_name === 'title' && item.target_language === 'en' ? { ...item, publication_status: 'unpublished' } : item)
  assert.equal(resolveBlogTranslations({ posts, requestedLanguage: 'en', defaultLanguage: 'es', languages, translations, states: unpublished }).get('one')?.title, undefined)
})
