import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')
const resources = ['challenge_phase_translation','challenge_variant_translation','challenge_variant_phase_translation','account_plan_translation','challenge_reward_translation']

test('los cinco recursos cachean únicamente traducciones y estados crudos', () => {
  const resolver = read('lib/public-challenge-translations.ts')
  assert.match(resolver, /createPublicTranslationCache<ChallengeTranslationRow>/)
  assert.match(resolver, /targetLanguages: \[scope\.effectiveLanguage\]/)
  assert.match(resolver, /throw result\.error/)
  assert.ok(resolver.indexOf('CACHED_ROWS') < resolver.lastIndexOf('resolveChallengeTranslations'))
  for (const resource of resources) assert.match(resolver, new RegExp(resource))
})

test('fuentes, publicación y cambios de idiomas invalidan traducciones antes de cachés exteriores', () => {
  const helper = read('lib/admin-public-translation-revalidation.ts')
  const individual = read('app/admin/translations/actions.ts')
  const bulk = read('app/admin/content-center/publication/actions.ts')
  const languages = read('app/admin/content-center/language-actions.ts')
  for (const resource of resources) {
    for (const source of [helper, individual, bulk]) assert.match(source, new RegExp(resource))
  }
  assert.match(helper, /public-home-data/)
  assert.match(helper, /public-prop-firms/)
  assert.match(helper, /public-payouts/)
  assert.match(languages, /invalidateAllPublicTranslationResources/)
})

test('las escrituras administrativas pasan por una Server Action autenticada y payload cerrado', () => {
  const action = read('app/admin/challenges/resource-actions.ts')
  assert.match(action, /^'use server'/)
  assert.match(action, /getCurrentAdminPermissions/)
  assert.match(action, /createClient\(\)/)
  assert.match(action, /hasOnlyKeys/)
  assert.doesNotMatch(action, /createAdminClient|service_role/)
  for (const file of ['PhaseForm.tsx','VariantForm.tsx','VariantPhaseOverrideForm.tsx','ChallengePhasesManager.tsx','ChallengeVariantsManager.tsx','AccountPlanForm.tsx','AccountPlansManager.tsx']) {
    const source = read(`components/admin/challenges/${file}`)
    assert.match(source, /mutateChallengeResource/)
    assert.doesNotMatch(source, /\.from\('(challenge_phases|challenge_variants|challenge_variant_phases|account_plans)'\)/)
  }
})

test('la invalidación de fuente ocurre solo después de una fila confirmada', () => {
  const action = read('app/admin/challenges/resource-actions.ts')
  assert.ok(action.indexOf('if (!mutation.ok) return mutation') < action.indexOf('invalidatePublicSource(mutation.resourceType)'))
  assert.match(action, /El cambio se guardó, pero no fue posible renovar la caché pública/)
})
