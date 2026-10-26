'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'
import { invalidatePublicSource, type PublicTranslationResourceType } from '@/lib/admin-public-translation-revalidation'
import { createClient } from '@/lib/supabase/server'

type Result = { ok: boolean; message: string; id?: string }
type Operation =
  | 'save_phase' | 'delete_phase' | 'save_variant' | 'toggle_variant' | 'delete_variant'
  | 'save_override' | 'delete_override' | 'save_plan' | 'delete_plan'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export async function mutateChallengeResource(input: unknown): Promise<Result> {
  try {
    if (!record(input) || typeof input.operation !== 'string' || !OPERATIONS.has(input.operation as Operation)) return fail('Solicitud inválida.')
    const operation = input.operation as Operation
    if (!hasOnlyKeys(input, ALLOWED_KEYS[operation])) return fail('Solicitud inválida.')
    const access = await getCurrentAdminPermissions()
    if (!access.userId) return fail('La sesión expiró. Vuelve a iniciar sesión.')
    const permission = operation.startsWith('delete_') ? 'challenges.delete' : operation.startsWith('save_') && !string(input.id) ? 'challenges.create' : 'challenges.update'
    if (!access.permissions.has(permission)) return fail('No tienes permiso para realizar esta operación.')
    const supabase = await createClient()
    const mutation = await execute(operation, input, supabase)
    if (!mutation.ok) return mutation
    try {
      invalidatePublicSource(mutation.resourceType)
      revalidatePath('/')
      revalidatePath('/comparador')
      revalidatePath('/prop-firms')
      revalidatePath(`/prop-firms/${mutation.platformSlug}`)
      revalidatePath('/payouts')
      revalidatePath('/admin/challenges')
      revalidatePath(`/admin/challenges/${mutation.challengeId}`)
    } catch {
      return { ok: false, id: mutation.id, message: 'El cambio se guardó, pero no fue posible renovar la caché pública. No repitas la operación; recarga y verifica el contenido.' }
    }
    return { ok: true, id: mutation.id, message: mutation.message }
  } catch {
    return fail('No se pudo completar la operación. Recarga y comprueba el estado antes de intentarlo de nuevo.')
  }
}

type Db = Awaited<ReturnType<typeof createClient>>
type Mutation = Result & { resourceType: PublicTranslationResourceType; challengeId: string; platformSlug: string }

async function execute(operation: Operation, input: Record<string, unknown>, db: Db): Promise<Mutation> {
  if (operation === 'save_phase') return savePhase(input, db)
  if (operation === 'delete_phase') return deletePhase(input, db)
  if (operation === 'save_variant') return saveVariant(input, db)
  if (operation === 'toggle_variant') return toggleVariant(input, db)
  if (operation === 'delete_variant') return deleteVariant(input, db)
  if (operation === 'save_override') return saveOverride(input, db)
  if (operation === 'delete_override') return deleteOverride(input, db)
  if (operation === 'save_plan') return savePlan(input, db)
  return deletePlan(input, db)
}

async function context(db: Db, challengeId: unknown) {
  if (!uuid(challengeId)) return null
  const challenge = await db.from('challenges').select('id, platform_id').eq('id', challengeId).maybeSingle()
  if (challenge.error || !challenge.data) return null
  const platform = await db.from('platforms').select('slug').eq('id', challenge.data.platform_id).maybeSingle()
  return platform.data?.slug ? { challengeId, platformSlug: platform.data.slug } : null
}

async function savePhase(input: Record<string, unknown>, db: Db): Promise<Mutation> {
  const ctx = await context(db, input.challengeId)
  if (!ctx || !phasePayload(input)) return invalid('challenge_phase_translation')
  const payload = { challenge_id: ctx.challengeId, phase_number: input.phaseNumber, name: text(input.name), profit_target: nullableNumber(input.profitTarget), daily_drawdown: nullableNumber(input.dailyDrawdown), max_drawdown: nullableNumber(input.maxDrawdown), min_trading_days: integerOrNull(input.minTradingDays), max_trading_days: integerOrNull(input.maxTradingDays), min_profitable_days: integerOrNull(input.minProfitableDays), drawdown_type: text(input.drawdownType), drawdown_basis: text(input.drawdownBasis), notes: text(input.notes) }
  let result
  if (uuid(input.id)) {
    if (!iso(input.expectedUpdatedAt)) return invalid('challenge_phase_translation')
    const current = await db.from('challenge_phases').select('phase_number').eq('id', input.id).eq('challenge_id', ctx.challengeId).maybeSingle()
    if (current.error || !current.data) return missing('challenge_phase_translation')
    if (current.data.phase_number !== input.phaseNumber) {
      const variants = await db.from('challenge_variants').select('id').eq('challenge_id', ctx.challengeId)
      if (variants.error) return database('challenge_phase_translation')
      const ids = (variants.data ?? []).map((row) => row.id)
      if (ids.length) {
        const overrides = await db.from('challenge_variant_phases').select('id', { count: 'exact', head: true }).in('variant_id', ids).eq('phase_number', current.data.phase_number)
        if (overrides.error) return database('challenge_phase_translation')
        if ((overrides.count ?? 0) > 0) return conflict('challenge_phase_translation', 'La fase tiene overrides asociados y no puede cambiar de número.')
      }
    }
    result = await db.from('challenge_phases').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', input.id).eq('challenge_id', ctx.challengeId).eq('updated_at', input.expectedUpdatedAt).select('id').maybeSingle()
  } else result = await db.from('challenge_phases').insert(payload).select('id').single()
  return finish(result, ctx, 'challenge_phase_translation', uuid(input.id) ? 'Fase actualizada.' : 'Fase creada.')
}

async function deletePhase(input: Record<string, unknown>, db: Db): Promise<Mutation> {
  const ctx = await context(db, input.challengeId)
  if (!ctx || !uuid(input.id) || !integer(input.phaseNumber, 1)) return invalid('challenge_phase_translation')
  const variants = await db.from('challenge_variants').select('id').eq('challenge_id', ctx.challengeId)
  if (variants.error) return database('challenge_phase_translation')
  const ids = (variants.data ?? []).map((row) => row.id)
  if (ids.length) {
    const dependencies = await db.from('challenge_variant_phases').select('id', { count: 'exact', head: true }).in('variant_id', ids).eq('phase_number', input.phaseNumber)
    if (dependencies.error) return database('challenge_phase_translation')
    if ((dependencies.count ?? 0) > 0) return conflict('challenge_phase_translation', 'No se puede eliminar: existen overrides de variantes asociados.')
  }
  return finish(await db.from('challenge_phases').delete().eq('id', input.id).eq('challenge_id', ctx.challengeId).select('id').maybeSingle(), ctx, 'challenge_phase_translation', 'Fase eliminada.')
}

async function saveVariant(input: Record<string, unknown>, db: Db): Promise<Mutation> {
  const ctx = await context(db, input.challengeId)
  if (!ctx || !variantPayload(input)) return invalid('challenge_variant_translation')
  const payload = { challenge_id: ctx.challengeId, name: input.name, slug: input.slug, profit_split: nullableNumber(input.profitSplit), price_modifier: nullableNumber(input.priceModifier), payout_frequency: text(input.payoutFrequency), notes: text(input.notes), status: input.status }
  const result = uuid(input.id)
    ? iso(input.expectedUpdatedAt) ? await db.from('challenge_variants').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', input.id).eq('challenge_id', ctx.challengeId).eq('updated_at', input.expectedUpdatedAt).select('id').maybeSingle() : null
    : await db.from('challenge_variants').insert(payload).select('id').single()
  if (!result) return invalid('challenge_variant_translation')
  return finish(result, ctx, 'challenge_variant_translation', uuid(input.id) ? 'Variante actualizada.' : 'Variante creada.')
}

async function toggleVariant(input: Record<string, unknown>, db: Db): Promise<Mutation> {
  const ctx = await context(db, input.challengeId)
  if (!ctx || !uuid(input.id) || typeof input.status !== 'boolean' || !iso(input.expectedUpdatedAt)) return invalid('challenge_variant_translation')
  return finish(await db.from('challenge_variants').update({ status: input.status, updated_at: new Date().toISOString() }).eq('id', input.id).eq('challenge_id', ctx.challengeId).eq('updated_at', input.expectedUpdatedAt).select('id').maybeSingle(), ctx, 'challenge_variant_translation', 'Estado actualizado.')
}

async function deleteVariant(input: Record<string, unknown>, db: Db): Promise<Mutation> {
  const ctx = await context(db, input.challengeId)
  if (!ctx || !uuid(input.id)) return invalid('challenge_variant_translation')
  const [plans, overrides, rewards] = await Promise.all([
    db.from('account_plans').select('id', { count: 'exact', head: true }).eq('variant_id', input.id),
    db.from('challenge_variant_phases').select('id', { count: 'exact', head: true }).eq('variant_id', input.id),
    db.from('challenge_reward_options').select('id', { count: 'exact', head: true }).eq('variant_id', input.id),
  ])
  if (plans.error || overrides.error || rewards.error) return database('challenge_variant_translation')
  if ((plans.count ?? 0) + (overrides.count ?? 0) + (rewards.count ?? 0) > 0) return conflict('challenge_variant_translation', 'No se puede eliminar la variante mientras tenga relaciones asociadas.')
  return finish(await db.from('challenge_variants').delete().eq('id', input.id).eq('challenge_id', ctx.challengeId).select('id').maybeSingle(), ctx, 'challenge_variant_translation', 'Variante eliminada.')
}

async function variantContext(db: Db, variantId: unknown) {
  if (!uuid(variantId)) return null
  const variant = await db.from('challenge_variants').select('id, challenge_id').eq('id', variantId).maybeSingle()
  if (variant.error || !variant.data) return null
  const ctx = await context(db, variant.data.challenge_id)
  return ctx ? { ...ctx, variantId } : null
}

async function saveOverride(input: Record<string, unknown>, db: Db): Promise<Mutation> {
  const ctx = await variantContext(db, input.variantId)
  if (!ctx || !overridePayload(input)) return invalid('challenge_variant_phase_translation')
  const payload = { variant_id: ctx.variantId, phase_number: input.phaseNumber, profit_target: nullableNumber(input.profitTarget), daily_drawdown: nullableNumber(input.dailyDrawdown), max_drawdown: nullableNumber(input.maxDrawdown), min_trading_days: integerOrNull(input.minTradingDays), min_profitable_days: integerOrNull(input.minProfitableDays), drawdown_type: text(input.drawdownType), drawdown_basis: text(input.drawdownBasis), notes: text(input.notes) }
  const result = uuid(input.id)
    ? await db.from('challenge_variant_phases').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', input.id).eq('variant_id', ctx.variantId).eq('phase_number', input.phaseNumber).select('id').maybeSingle()
    : await db.from('challenge_variant_phases').insert(payload).select('id').single()
  return finish(result, ctx, 'challenge_variant_phase_translation', uuid(input.id) ? 'Override actualizado.' : 'Override creado.')
}

async function deleteOverride(input: Record<string, unknown>, db: Db): Promise<Mutation> {
  const ctx = await variantContext(db, input.variantId)
  if (!ctx || !uuid(input.id) || !integer(input.phaseNumber, 1)) return invalid('challenge_variant_phase_translation')
  return finish(await db.from('challenge_variant_phases').delete().eq('id', input.id).eq('variant_id', ctx.variantId).eq('phase_number', input.phaseNumber).select('id').maybeSingle(), ctx, 'challenge_variant_phase_translation', 'Herencia completa restaurada.')
}

async function savePlan(input: Record<string, unknown>, db: Db): Promise<Mutation> {
  const ctx = await context(db, input.challengeId)
  if (!ctx || !planPayload(input)) return invalid('account_plan_translation')
  if (input.variantId !== null) {
    const variant = await db.from('challenge_variants').select('id').eq('id', input.variantId).eq('challenge_id', ctx.challengeId).maybeSingle()
    if (variant.error || !variant.data) return conflict('account_plan_translation', 'La variante no pertenece al Challenge.')
  }
  const normalized = await db.from('challenge_phases').select('id', { count: 'exact', head: true }).eq('challenge_id', ctx.challengeId)
  if (normalized.error) return database('account_plan_translation')
  const base = { challenge_id: ctx.challengeId, account_size: input.accountSize, price: nullableNumber(input.price), currency: input.currency, variant_id: input.variantId }
  const legacy = (normalized.count ?? 0) > 0 ? {} : { profit_target: nullableNumber(input.profitTarget), daily_drawdown: nullableNumber(input.dailyDrawdown), max_drawdown: nullableNumber(input.maxDrawdown), profit_split: nullableNumber(input.profitSplit), min_trading_days: integerOrNull(input.minTradingDays), max_trading_days: integerOrNull(input.maxTradingDays), payout_frequency: text(input.payoutFrequency) }
  const result = uuid(input.id)
    ? await db.from('account_plans').update({ ...base, ...legacy }).eq('id', input.id).eq('challenge_id', ctx.challengeId).select('id').maybeSingle()
    : await db.from('account_plans').insert({ ...base, ...legacy }).select('id').single()
  return finish(result, ctx, 'account_plan_translation', uuid(input.id) ? 'Plan actualizado.' : 'Plan creado.')
}

async function deletePlan(input: Record<string, unknown>, db: Db): Promise<Mutation> {
  const ctx = await context(db, input.challengeId)
  if (!ctx || !uuid(input.id)) return invalid('account_plan_translation')
  return finish(await db.from('account_plans').delete().eq('id', input.id).eq('challenge_id', ctx.challengeId).select('id').maybeSingle(), ctx, 'account_plan_translation', 'Plan eliminado.')
}

async function finish(result: { data: { id: string } | null; error: { code?: string } | null }, ctx: { challengeId: string; platformSlug: string }, resourceType: PublicTranslationResourceType, message: string): Promise<Mutation> {
  if (result.error) return result.error.code === '23505' ? conflict(resourceType, 'Ya existe un registro con esa identidad.') : database(resourceType)
  if (!result.data) return conflict(resourceType, 'El recurso cambió o ya no existe. Recarga la página.')
  return { ok: true, id: result.data.id, message, resourceType, ...ctx }
}

function phasePayload(v: Record<string, unknown>) { return uuid(v.challengeId) && integer(v.phaseNumber, 1) && short(v.name, 160, true) && short(v.notes, 5000, true) && nonnegative(v.profitTarget) && nonnegative(v.dailyDrawdown) && nonnegative(v.maxDrawdown) && nonnegativeInteger(v.minTradingDays) && nonnegativeInteger(v.maxTradingDays) && nonnegativeInteger(v.minProfitableDays) && nullableEnum(v.drawdownType, ['static','trailing','dynamic','balance_based','equity_based']) && nullableEnum(v.drawdownBasis, ['balance','equity','balance_or_equity']) }
function variantPayload(v: Record<string, unknown>) { return uuid(v.challengeId) && short(v.name, 160, false) && typeof v.slug === 'string' && v.slug.length <= 160 && SLUG.test(v.slug) && finite(v.profitSplit) && finite(v.priceModifier) && short(v.payoutFrequency, 200, true) && short(v.notes, 5000, true) && typeof v.status === 'boolean' }
function overridePayload(v: Record<string, unknown>) { return uuid(v.variantId) && integer(v.phaseNumber, 1) && nonnegative(v.profitTarget) && nonnegative(v.dailyDrawdown) && nonnegative(v.maxDrawdown) && nonnegativeInteger(v.minTradingDays) && nonnegativeInteger(v.minProfitableDays) && nullableEnum(v.drawdownType, ['static','trailing','dynamic']) && nullableEnum(v.drawdownBasis, ['balance','equity','balance_or_equity']) && short(v.notes, 5000, true) }
function planPayload(v: Record<string, unknown>) { return uuid(v.challengeId) && (v.variantId === null || uuid(v.variantId)) && typeof v.accountSize === 'number' && Number.isFinite(v.accountSize) && v.accountSize > 0 && nonnegative(v.price) && typeof v.currency === 'string' && /^[A-Z]{3}$/.test(v.currency) && finite(v.profitTarget) && finite(v.dailyDrawdown) && finite(v.maxDrawdown) && finite(v.profitSplit) && nonnegativeInteger(v.minTradingDays) && nonnegativeInteger(v.maxTradingDays) && short(v.payoutFrequency, 200, true) }
function record(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null && !Array.isArray(v) }
function uuid(v: unknown): v is string { return typeof v === 'string' && UUID.test(v) }
function string(v: unknown): v is string { return typeof v === 'string' && v.length > 0 }
function iso(v: unknown): v is string { return typeof v === 'string' && Number.isFinite(Date.parse(v)) }
function integer(v: unknown, min = 0): v is number { return typeof v === 'number' && Number.isInteger(v) && v >= min }
function finite(v: unknown) { return v === null || (typeof v === 'number' && Number.isFinite(v)) }
function nonnegative(v: unknown) { return v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0) }
function nonnegativeInteger(v: unknown) { return v === null || integer(v) }
function short(v: unknown, max: number, nullable: boolean) { return nullable && v === null || typeof v === 'string' && v.trim().length > 0 && v.length <= max }
function nullableEnum(v: unknown, values: string[]) { return v === null || typeof v === 'string' && values.includes(v) }
function text(v: unknown) { return typeof v === 'string' && v.trim() ? v.trim() : null }
function nullableNumber(v: unknown) { return typeof v === 'number' ? v : null }
function integerOrNull(v: unknown) { return typeof v === 'number' ? v : null }
const OPERATIONS = new Set<Operation>(['save_phase','delete_phase','save_variant','toggle_variant','delete_variant','save_override','delete_override','save_plan','delete_plan'])
const ALLOWED_KEYS: Record<Operation, readonly string[]> = {
  save_phase: ['operation','id','challengeId','phaseNumber','name','profitTarget','dailyDrawdown','maxDrawdown','minTradingDays','maxTradingDays','minProfitableDays','drawdownType','drawdownBasis','notes','expectedUpdatedAt'],
  delete_phase: ['operation','id','challengeId','phaseNumber'],
  save_variant: ['operation','id','challengeId','name','slug','profitSplit','priceModifier','payoutFrequency','notes','status','expectedUpdatedAt'],
  toggle_variant: ['operation','id','challengeId','status','expectedUpdatedAt'],
  delete_variant: ['operation','id','challengeId'],
  save_override: ['operation','id','variantId','phaseNumber','profitTarget','dailyDrawdown','maxDrawdown','minTradingDays','minProfitableDays','drawdownType','drawdownBasis','notes'],
  delete_override: ['operation','id','variantId','phaseNumber'],
  save_plan: ['operation','id','challengeId','accountSize','price','currency','variantId','profitTarget','dailyDrawdown','maxDrawdown','profitSplit','minTradingDays','maxTradingDays','payoutFrequency'],
  delete_plan: ['operation','id','challengeId'],
}
function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]) { const set = new Set(allowed); return Object.keys(value).every((key) => set.has(key)) }
function fail(message: string): Result { return { ok: false, message } }
function invalid(resourceType: PublicTranslationResourceType): Mutation { return { ...fail('Los datos enviados no son válidos.'), resourceType, challengeId: '', platformSlug: '' } }
function missing(resourceType: PublicTranslationResourceType): Mutation { return { ...fail('El recurso no existe o no tienes acceso.'), resourceType, challengeId: '', platformSlug: '' } }
function database(resourceType: PublicTranslationResourceType): Mutation { return { ...fail('No se pudo guardar el cambio.'), resourceType, challengeId: '', platformSlug: '' } }
function conflict(resourceType: PublicTranslationResourceType, message: string): Mutation { return { ...fail(message), resourceType, challengeId: '', platformSlug: '' } }
