import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync('supabase/migrations/202610120002_blog_translations.sql', 'utf8')
const discovery = readFileSync('lib/discovery.ts', 'utf8')
const indexPage = readFileSync('app/blog/page.tsx', 'utf8')
const detailPage = readFileSync('app/blog/[slug]/page.tsx', 'utf8')
const fields = ['title', 'excerpt', 'body_markdown', 'category', 'tags']

test('3D.5 registra solo los cinco campos editoriales reales', () => {
  assert.match(sql, /primary key\(blog_post_id,language\)/)
  for (const field of fields) assert.match(sql, new RegExp(`'blog_post_translation','${field}'`))
  for (const excluded of ['slug', 'author_name', 'published_at', 'status', 'is_featured', 'cover_media_id', 'seo_title', 'seo_description']) assert.doesNotMatch(sql, new RegExp(`'blog_post_translation','${excluded}'`))
})

test('3D.5 usa permisos Blog, separa triggers y protege helpers', () => {
  assert.match(sql, /p_resource_type='blog_post_translation' then 'blog\.update'/)
  assert.match(sql, /has_admin_permission\('blog\.view'\)/)
  for (const operation of ['insert', 'update', 'delete']) assert.match(sql, new RegExp(`translation_blog_source_${operation}`))
  assert.match(sql, /revoke all on function public\.translation_read_value_before_blog/)
  assert.match(sql, /revoke all on function public\.translation_write_value_before_blog/)
})

test('3D.5 valida tags JSONB, conserva texto Markdown y no genera contenido', () => {
  assert.match(sql, /jsonb_typeof\(p_value\)<>'array'/)
  assert.match(sql, /text_value:=p_value#>>'\{\}'/)
  assert.match(sql, /3D\.5 no debe crear translation_jobs/)
  assert.match(sql, /3D\.5 no debe crear traducciones/)
})

test('Blog resuelve traducciones después de la caché fuente y usa metadata por idioma', () => {
  assert.match(discovery, /const getBlogSources=unstable_cache\(queryBlog/)
  assert.match(discovery, /getPublicBlogTranslations\(posts,language\)/)
  assert.match(indexPage, /getBlogPosts\(language\)/)
  assert.match(detailPage, /generateMetadata/)
  assert.match(detailPage, /getBlogPosts\(language\)/)
})
