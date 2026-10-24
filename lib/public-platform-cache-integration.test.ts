import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

test('los tres resolvedores cachean filas crudas por resource type y conservan la política fuera', () => {
  const general = read('lib/public-platform-translations.ts'), details = read('lib/public-platform-detail-translations.ts')
  assert.match(general, /createPublicTranslationCache<PlatformTranslationRow>/)
  assert.match(general, /resourceType: 'platform_translation'/)
  assert.ok(general.indexOf('getCachedPlatformTranslationRows') < general.lastIndexOf('resolvePlatformTranslations'))
  assert.match(details, /resourceType: 'broker_detail_translation'/)
  assert.match(details, /resourceType: 'exchange_detail_translation'/)
  assert.ok(details.indexOf('getCachedBrokerDetailRows') < details.lastIndexOf('resolvePlatformDetailTranslations'))
  assert.match(general, /catch[\s\S]*return new Map/)
  assert.match(details, /catch \{ return empty\(\) \}/)
})

test('las escrituras pasan por Server Actions autenticadas y no quedan mutaciones cliente', () => {
  const action = read('app/admin/platform-actions.ts')
  assert.match(action, /'use server'/)
  assert.match(action, /getCurrentAdminPermissions/)
  assert.match(action, /createClient\(\)/)
  assert.match(action, /platforms\.update|platforms\.create/)
  for (const rpc of ['admin_save_prop_firm', 'admin_save_broker', 'admin_save_exchange', 'admin_delete_platform']) assert.match(action, new RegExp(rpc))
  assert.doesNotMatch(action, /\.from\(/)
  assert.doesNotMatch(action, /createAdminClient|service_role/)
  for (const path of ['app/admin/platforms/new/page.tsx', 'app/admin/platforms/[id]/edit/page.tsx', 'components/admin/BrokerForm.tsx', 'components/admin/ExchangeForm.tsx']) {
    const source = read(path)
    assert.doesNotMatch(source, /\.from\([^)]*\)\.(?:insert|update|upsert|delete)/)
  }
})

test('invalida traducciones antes de las cachés públicas cruzadas y cubre publicación masiva', () => {
  const helper = read('lib/admin-public-translation-revalidation.ts')
  for (const tag of ['public-home-data', 'public-brokers-v1', 'public-exchanges-v2', 'public-prop-firms', 'public-platform-search']) assert.match(helper, new RegExp(tag))
  assert.ok(helper.indexOf("expireTranslationRows('platform_translation')") < helper.lastIndexOf('invalidatePlatformOuterCaches()'))
  const individual = read('app/admin/translations/actions.ts'), bulk = read('app/admin/content-center/publication/actions.ts'), languages = read('app/admin/content-center/language-actions.ts')
  for (const resource of ['platform_translation', 'broker_detail_translation', 'exchange_detail_translation']) {
    assert.match(individual, new RegExp(resource)); assert.match(bulk, new RegExp(resource)); assert.match(helper, new RegExp(resource))
  }
  assert.match(languages, /invalidateAllPublicTranslationResources/)
})

test('las cachés exteriores de brokers y exchanges tienen tags explícitos', () => {
  assert.match(read('lib/brokers.ts'), /tags: \['public-brokers-v1'\]/)
  assert.match(read('lib/exchanges.ts'), /tags: \['public-exchanges-v2'\]/)
})
