import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { executeSaveOffer, executeSetOfferStatus, type OfferActionDependencies } from './admin-offer-actions-runtime'
import { isOfferSourceInput, isOfferStatusInput, type OfferSourceInput } from './admin-offer-source-policy'

const action = readFileSync('app/admin/offers/actions.ts', 'utf8')
const createPage = readFileSync('app/admin/offers/new/page.tsx', 'utf8')
const editPage = readFileSync('app/admin/offers/[id]/page.tsx', 'utf8')
const toggle = readFileSync('app/admin/offers/ToggleOfferStatus.tsx', 'utf8')
const list = readFileSync('app/admin/offers/platform/[platformId]/page.tsx', 'utf8')
const publicOffers = readFileSync('lib/public-offers.ts', 'utf8')
const offerTranslations = readFileSync('lib/public-offer-translations.ts', 'utf8')
const cacheInvalidation = readFileSync('lib/admin-public-translation-revalidation.ts', 'utf8')
const runtime = readFileSync('lib/admin-offer-actions-runtime.ts', 'utf8')

const valid: OfferSourceInput = {
  creationRequestId: '10000000-0000-4000-8000-000000000003',
  platformId: '10000000-0000-4000-8000-000000000001', challengeId: null, affiliateLinkId: null,
  title: '20% de descuento', description: null, discountValue: 20, discountType: 'percentage', promoCode: null,
  includesFreeAccount: false, freeAccountLabel: null, featured: false, hotBadge: null, shortHighlight: null,
  countryCode: 'CO', language: 'es', startsAt: null, expiresAt: null, priority: 1, status: true,
}

test('las mutaciones de ofertas usan únicamente las RPC autenticadas', () => {
  assert.match(action, /^'use server'/)
  assert.match(action, /getCurrentAdminPermissions/)
  assert.match(action, /executeSaveOffer/)
  assert.match(action, /executeSetOfferStatus/)
  assert.doesNotMatch(action, /createAdminClient|service_role|\.from\('offers'\)/)
  for (const source of [createPage, editPage, toggle]) {
    assert.doesNotMatch(source, /\.from\('offers'\)\s*\.(?:insert|update|delete)/)
  }
})

test('el cliente transmite snapshots y actualiza el recibido por la RPC', () => {
  assert.match(editPage, /expectedUpdatedAt: updatedAt/)
  assert.match(editPage, /setUpdatedAt\(result\.updatedAt\)/)
  assert.match(toggle, /expectedUpdatedAt: snapshot/)
  assert.match(toggle, /setSnapshot\(result\.updatedAt\)/)
  assert.match(list, /updated_at/)
})

test('la validación runtime acepta el formulario real y rechaza manipulación', () => {
  assert.equal(isOfferSourceInput(valid), true)
  assert.equal(isOfferSourceInput({ ...valid, arbitrary: 'mass assignment' }), false)
  assert.equal(isOfferSourceInput({ ...valid, discountValue: 101 }), false)
  assert.equal(isOfferSourceInput({ ...valid, startsAt: '2026-10-26T00:00:00.000Z', expiresAt: '2026-10-25T00:00:00.000Z' }), false)
  assert.equal(isOfferSourceInput({ ...valid, creationRequestId: undefined }), false)
  assert.equal(isOfferSourceInput({ ...valid, id: '10000000-0000-4000-8000-000000000002' }), false)
  assert.equal(isOfferSourceInput({ ...valid, creationRequestId: undefined, id: '10000000-0000-4000-8000-000000000002', expectedUpdatedAt: '2026-10-25T12:00:00.000Z' }), true)
  assert.equal(isOfferStatusInput({ id: '10000000-0000-4000-8000-000000000002', expectedUpdatedAt: '2026-10-25T12:00:00.000Z', status: false }), true)
  assert.equal(isOfferStatusInput({ id: '10000000-0000-4000-8000-000000000002', expectedUpdatedAt: 'bad', status: false }), false)
})

test('los campos legacy no forman parte del payload editable', () => {
  for (const field of ['coupon_code', 'start_date', 'end_date']) assert.doesNotMatch(action, new RegExp(field))
  assert.match(editPage, /oferta histórica no tiene un descuento normalizado/)
  assert.match(editPage, /discountValue\.trim\(\) === ''/)
})

test('la invalidación ocurre después de una respuesta RPC confirmada', () => {
  assert.match(action, /invalidatePublicSource\('offer_translation'\)/)
  assert.match(publicOffers, /PUBLIC_OFFERS_CACHE_TAG = 'active-public-offers-v2'/)
  assert.match(publicOffers, /tags: \[PUBLIC_OFFERS_CACHE_TAG\]/)
  assert.ok(cacheInvalidation.indexOf('expireTranslationRows(resourceType, language)') < cacheInvalidation.indexOf('invalidateOfferOuterCaches()'))
  assert.match(runtime, /El cambio se guardó, pero no fue posible renovar la caché pública/)
})

test('las ofertas cachean solo filas editoriales crudas y conservan la política fuera', () => {
  assert.match(offerTranslations, /createPublicTranslationCache<OfferTranslationRow>/)
  assert.match(offerTranslations, /resourceType: 'offer_translation'/)
  assert.match(offerTranslations, /\.eq\('language', scope\.effectiveLanguage\)/)
  assert.match(offerTranslations, /targetLanguages: \[scope\.effectiveLanguage\]/)
  assert.ok(offerTranslations.indexOf('getCachedOfferTranslationRows') < offerTranslations.lastIndexOf('resolveOfferTranslations'))
  assert.match(offerTranslations, /catch \{[\s\S]*resolveOfferTranslations/)
})

test('publicación, retirada, operaciones masivas e idiomas invalidan ofertas', () => {
  const individual = readFileSync('app/admin/translations/actions.ts', 'utf8')
  const bulk = readFileSync('app/admin/content-center/publication/actions.ts', 'utf8')
  const languages = readFileSync('app/admin/content-center/language-actions.ts', 'utf8')
  for (const source of [individual, bulk, cacheInvalidation]) assert.match(source, /offer_translation/)
  assert.match(languages, /invalidateAllPublicTranslationResources/)
  for (const tag of ['active-public-offers-v2', 'public-home-data', 'public-prop-firms', 'public-brokers-v1', 'public-exchanges-v2']) {
    assert.match(cacheInvalidation + publicOffers, new RegExp(tag))
  }
})

test('los conflictos y errores SQL se presentan de forma saneada', () => {
  assert.match(runtime, /code === '40001'/)
  assert.match(runtime, /modificada por otra sesión/)
  assert.doesNotMatch(action, /result\.error\.message/)
})

function dependencies(overrides: Partial<OfferActionDependencies> = {}): OfferActionDependencies {
  return {
    getAccess: async () => ({ userId: 'admin', permissions: new Set(['offers.create', 'offers.update']) }),
    rpc: async () => ({ data: [{ offer_id: '10000000-0000-4000-8000-000000000004', operation: 'created', current_updated_at: '2026-10-25T12:00:01.000Z' }], error: null }),
    invalidate: () => undefined,
    ...overrides,
  }
}

test('la acción ejecutable valida sesión y permisos antes de llamar la RPC', async () => {
  let calls = 0
  const result = await executeSaveOffer(valid, dependencies({
    getAccess: async () => ({ userId: null, permissions: new Set() }),
    rpc: async () => { calls += 1; return { data: null, error: null } },
  }))
  assert.equal(result.ok, false)
  assert.equal(calls, 0)
  const noCreate = await executeSaveOffer(valid, dependencies({
    getAccess: async () => ({ userId: 'admin', permissions: new Set(['offers.update']) }),
    rpc: async () => { calls += 1; return { data: null, error: null } },
  }))
  assert.equal(noCreate.ok, false)
  const edit = { ...valid, creationRequestId: undefined, id: '10000000-0000-4000-8000-000000000002', expectedUpdatedAt: '2026-10-25T12:00:00.000Z' }
  const noUpdate = await executeSaveOffer(edit, dependencies({
    getAccess: async () => ({ userId: 'admin', permissions: new Set(['offers.create']) }),
    rpc: async () => { calls += 1; return { data: null, error: null } },
  }))
  assert.equal(noUpdate.ok, false)
  assert.equal(calls, 0)
})

test('la creación envía identidad estable y acepta replay sin duplicar la acción cliente', async () => {
  let args: Record<string, unknown> | undefined
  const result = await executeSaveOffer(valid, dependencies({
    rpc: async (_name, value) => {
      args = value
      return { data: [{ offer_id: '10000000-0000-4000-8000-000000000004', operation: 'replayed', current_updated_at: '2026-10-25T12:00:01.000Z' }], error: null }
    },
  }))
  assert.equal(result.ok, true)
  assert.equal(args?.p_creation_request_id, valid.creationRequestId)
  assert.equal(args?.p_offer_id, null)
  assert.match(result.message, /ya había sido creada/)
})

test('conflictos, respuestas vacías y fallos de invalidación son seguros', async () => {
  const conflict = await executeSetOfferStatus({ id: '10000000-0000-4000-8000-000000000002', expectedUpdatedAt: '2026-10-25T12:00:00.000Z', status: false }, dependencies({
    rpc: async () => ({ data: null, error: { code: '40001' } }),
  }))
  assert.equal(conflict.code, 'conflict')
  const malformed = await executeSaveOffer(valid, dependencies({ rpc: async () => ({ data: [], error: null }) }))
  assert.equal(malformed.ok, false)
  const staleCache = await executeSaveOffer(valid, dependencies({ invalidate: () => { throw new Error('cache') } }))
  assert.equal(staleCache.code, 'revalidation_failed')
  assert.equal(staleCache.id, '10000000-0000-4000-8000-000000000004')
  const supabaseFailure = await executeSaveOffer(valid, dependencies({ rpc: async () => ({ data: null, error: { code: 'XX000' } }) }))
  assert.equal(supabaseFailure.ok, false)
  assert.doesNotMatch(supabaseFailure.message, /XX000/)
})

test('edición y toggle autorizados usan el snapshot y actualizan el resultado confirmado', async () => {
  const edit = { ...valid, creationRequestId: undefined, id: '10000000-0000-4000-8000-000000000002', expectedUpdatedAt: '2026-10-25T12:00:00.000Z' }
  let editArgs: Record<string, unknown> | undefined
  const edited = await executeSaveOffer(edit, dependencies({
    rpc: async (_name, args) => {
      editArgs = args
      return { data: [{ offer_id: edit.id, operation: 'updated', current_updated_at: '2026-10-25T12:00:02.000Z' }], error: null }
    },
  }))
  assert.equal(edited.ok, true)
  assert.equal(editArgs?.p_expected_updated_at, edit.expectedUpdatedAt)
  assert.equal(editArgs?.p_creation_request_id, null)
  const toggled = await executeSetOfferStatus({ id: edit.id, expectedUpdatedAt: edited.updatedAt!, status: false }, dependencies({
    rpc: async () => ({ data: [{ offer_id: edit.id, status: false, current_updated_at: '2026-10-25T12:00:03.000Z' }], error: null }),
  }))
  assert.equal(toggled.ok, true)
  assert.equal(toggled.status, false)
})

test('los formularios controlan rechazos de transporte y liberan loading', () => {
  for (const source of [createPage, editPage, toggle]) {
    assert.match(source, /catch/)
    assert.match(source, /finally/)
  }
  assert.match(createPage, /crypto\.randomUUID\(\)/)
  assert.match(createPage, /creationRequestId\.current \?\?= crypto\.randomUUID\(\)/)
})
