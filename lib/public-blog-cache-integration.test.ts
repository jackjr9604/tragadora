import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')

test('Blog cachea únicamente filas crudas y conserva política y fallback fuera del cargador', () => {
  const source = read('lib/public-blog-translations.ts')
  assert.match(source, /createPublicTranslationCache<BlogTranslationRow>/)
  assert.match(source, /resourceType: 'blog_post_translation'/)
  assert.match(source, /if \(result\.error\) throw result\.error/g)
  assert.match(source, /resolveBlogTranslations/)
  assert.match(source, /catch \{[\s\S]*return new Map\(\)/)
})

test('todas las escrituras públicas de Blog invalidan inmediatamente tags compartidos', () => {
  const individual = read('app/admin/translations/actions.ts')
  const bulk = read('app/admin/content-center/publication/actions.ts')
  const source = read('app/admin/blog/actions.ts')
  const language = read('app/admin/content-center/language-actions.ts')
  const helper = read('lib/admin-public-blog-revalidation.ts')
  assert.match(individual, /blog_post_translation/)
  assert.match(individual, /invalidatePublicTranslations/)
  assert.match(bulk, /blog_post_translation/)
  assert.match(bulk, /invalidatePublicTranslations/)
  assert.match(source, /saveBlogSource[\s\S]*invalidatePublicBlogSource/)
  assert.match(source, /deleteBlogSource[\s\S]*invalidatePublicBlogSource/)
  assert.match(language, /updateTag\('public-languages'\);invalidateAllPublicTranslationResources\(\)/)
  assert.match(helper, /updateTag\(/)
  assert.doesNotMatch(helper, /revalidateTag\([^\n]+['"]max['"]/) 
  assert.ok(helper.indexOf('invalidatePublicBlogTranslations()') < helper.lastIndexOf('updateTag(PUBLIC_BLOG_SOURCE_CACHE_TAG)'))
})

test('el editor Blog ya no escribe desde el cliente y la caché exterior tiene tag', () => {
  const forms = read('components/admin/DiscoveryForms.tsx')
  const blog = forms.slice(forms.indexOf('export function BlogForm'), forms.indexOf('export type GiveawayValue'))
  const discovery = read('lib/discovery.ts')
  assert.match(blog, /saveBlogSource/)
  assert.match(blog, /deleteBlogSource/)
  assert.doesNotMatch(blog, /createClient\(|from\('blog_posts'\)/)
  assert.match(discovery, /public-blog-v1'[\s\S]*tags:\[PUBLIC_BLOG_SOURCE_CACHE_TAG\]/)
})

test('las Server Actions de fuente validan sesión y permisos antes de escribir', () => {
  const source = read('app/admin/blog/actions.ts')
  assert.match(source, /getCurrentAdminPermissions/)
  assert.match(source, /blog\.update/)
  assert.match(source, /blog\.create/)
  assert.match(source, /blog\.delete/)
  assert.match(source, /isBlogSourceInput/)
  assert.match(source, /isSafeBlogSlug/)
  assert.match(source, /createClient\(\)/)
  assert.doesNotMatch(source, /createAdminClient|service_role/)
})
