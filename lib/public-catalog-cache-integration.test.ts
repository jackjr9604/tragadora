import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')

test('Tools, Communities y Giveaways cachean filas crudas y conservan política fuera', () => {
  for (const [file, resourceType] of [
    ['lib/public-tool-translations.ts', 'tool_translation'],
    ['lib/public-community-translations.ts', 'community_translation'],
    ['lib/public-giveaway-translations.ts', 'giveaway_translation'],
  ] as const) {
    const source = read(file)
    assert.match(source, /createPublicTranslationCache/)
    assert.match(source, new RegExp(`resourceType:\\s*['"]${resourceType}['"]`))
    assert.match(source, /if\s*\(result\.error\)\s*throw result\.error/)
    assert.match(source, /catch\s*\{[\s\S]*return new Map\(\)/)
    assert.match(source, /resolve(?:Tool|Community|Giveaway)Translations/)
  }
})

test('cachés fuente e invalidaciones cubren recursos, idiomas y buscador', () => {
  const discovery = read('lib/discovery.ts'), helper = read('lib/admin-public-translation-revalidation.ts')
  assert.match(discovery, /public-communities-v1'[\s\S]*PUBLIC_COMMUNITIES_SOURCE_CACHE_TAG/)
  assert.match(discovery, /public-giveaways-v1'[\s\S]*PUBLIC_GIVEAWAYS_SOURCE_CACHE_TAG/)
  assert.ok(helper.indexOf('invalidatePublicTranslations(resourceType)') < helper.indexOf("updateTag(PUBLIC_COMMUNITIES_SOURCE_CACHE_TAG)"))
  assert.match(helper, /tool_translation'[\s\S]*updateTag\('public-platform-search'\)/)
})

test('editores no escriben tablas públicas desde el navegador', () => {
  const tools = read('components/admin/ToolForm.tsx'), discovery = read('components/admin/DiscoveryForms.tsx')
  assert.match(tools, /saveToolSource/)
  assert.doesNotMatch(tools, /createClient\(|from\('tools'\)/)
  assert.match(discovery, /saveCommunitySource/)
  assert.match(discovery, /saveGiveawaySource/)
  assert.doesNotMatch(discovery, /createClient\(|from\('(communities|giveaways)'\)/)
})

test('Server Actions validan sesión, permisos, runtime y usan cliente autenticado', () => {
  const actions = read('app/admin/catalog-actions.ts')
  assert.match(actions, /^'use server'/)
  assert.match(actions, /getCurrentAdminPermissions/)
  for (const permission of ['tools.create', 'tools.update', 'tools.delete', 'communities.create', 'communities.update', 'communities.delete', 'giveaways.create', 'giveaways.update', 'giveaways.delete']) assert.match(actions, new RegExp(permission.replace('.', '\\.')))
  assert.match(actions, /isToolSourceInput/)
  assert.match(actions, /isCommunitySourceInput/)
  assert.match(actions, /isGiveawaySourceInput/)
  assert.match(actions, /createClient\(\)/)
  assert.doesNotMatch(actions, /createAdminClient|service_role/)
})

test('publicación individual, agrupada, masiva e idiomas invalidan tags compartidos', () => {
  const individual = read('app/admin/translations/actions.ts'), bulk = read('app/admin/content-center/publication/actions.ts'), languages = read('app/admin/content-center/language-actions.ts')
  assert.match(individual, /invalidatePublicTranslations/)
  assert.match(individual, /tool_translation/)
  assert.match(individual, /community_translation/)
  assert.match(individual, /giveaway_translation/)
  assert.match(bulk, /cacheLanguages/)
  assert.match(bulk, /invalidatePublicTranslations/)
  assert.match(languages, /invalidateAllPublicTranslationResources/)
})

test('metadata de Tools y Calculadoras conserva SEO traducido del resolvedor público', () => {
  for (const file of ['app/herramientas/[slug]/page.tsx', 'app/calculadoras/[slug]/page.tsx']) {
    const source = read(file)
    assert.match(source, /getPublishedTool\(slug, language\)/)
    assert.match(source, /tool\.seo_title \|\| tool\.name/)
    assert.match(source, /tool\.seo_description \|\| tool\.short_description/)
  }
})
