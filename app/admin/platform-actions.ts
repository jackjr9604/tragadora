'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'
import { invalidatePublicPlatformSource } from '@/lib/admin-public-translation-revalidation'
import {
  isBrokerSourceInput, isExchangeSourceInput, isPlatformDeleteInput, isPropFirmSourceInput,
  type BrokerSourceInput, type ExchangeSourceInput, type PlatformDeleteInput, type PropFirmSourceInput,
} from '@/lib/admin-platform-source-policy'
import { createClient } from '@/lib/supabase/server'

type Result = { ok: boolean; message: string; id?: string }
type PlatformKind = PlatformDeleteInput['type']
type RpcRow = { platform_id: string; operation: string; previous_slug: string | null; current_slug: string | null; current_updated_at: string | null }

export async function savePropFirmSource(input: PropFirmSourceInput): Promise<Result> {
  if (!isPropFirmSourceInput(input)) return fail('Los datos de la Prop Firm no son válidos.')
  return save('prop_firm', input, 'admin_save_prop_firm', {
    p_platform_id: input.id ?? null, p_expected_updated_at: input.expectedUpdatedAt ?? null,
    p_name: input.name.trim(), p_slug: input.slug, p_description: input.description, p_website_url: input.websiteUrl,
    p_logo_media_id: input.logoMediaId, p_status: input.status, p_score: input.score,
    p_origin_country_code: input.originCountryCode, p_ceo_name: input.ceoName, p_founded_at: input.foundedAt,
    p_broker_provider: input.brokerProvider, p_inactivity_days: input.inactivityDays, p_is_new: input.isNew,
    p_profit_split_min: input.profitSplitMin, p_profit_split_max: input.profitSplitMax, p_supports_ea: input.supportsEa,
    p_allows_news: input.allowsNews, p_allows_weekend: input.allowsWeekend, p_allows_scalping: input.allowsScalping,
    p_allows_day_trading: input.allowsDayTrading, p_allows_copy_trading: input.allowsCopyTrading,
    p_time_limit_policy: input.timeLimitPolicy, p_consistency_rules: input.consistencyRules, p_special_rules: input.specialRules,
    p_markets: input.markets, p_trading_platform_ids: input.tradingPlatformIds,
    p_instrument_category_ids: input.instrumentCategoryIds,
    p_transaction_method_ids: input.transactionMethods.map((item) => item.id),
    p_transaction_method_deposit: input.transactionMethods.map((item) => item.supportsDeposit),
    p_transaction_method_payout: input.transactionMethods.map((item) => item.supportsPayout),
  })
}

export async function saveBrokerSource(input: BrokerSourceInput): Promise<Result> {
  if (!isBrokerSourceInput(input)) return fail('Los datos del broker no son válidos.')
  return save('broker', input, 'admin_save_broker', {
    p_platform_id: input.id ?? null, p_expected_updated_at: input.expectedUpdatedAt ?? null,
    p_name: input.name.trim(), p_slug: input.slug, p_description: input.description, p_website_url: input.websiteUrl,
    p_logo_media_id: input.logoMediaId, p_status: input.status, p_country_code: input.countryCode,
    p_founded_year: input.foundedYear, p_minimum_deposit: input.minimumDeposit,
    p_minimum_deposit_currency: input.minimumDepositCurrency, p_regulation_summary: input.regulationSummary,
    p_regulation_source_url: input.regulationSourceUrl, p_is_featured: input.featured,
    p_display_order: input.displayOrder, p_markets: input.markets, p_trading_platform_ids: input.tradingPlatformIds,
  })
}

export async function saveExchangeSource(input: ExchangeSourceInput): Promise<Result> {
  if (!isExchangeSourceInput(input)) return fail('Los datos del exchange no son válidos.')
  return save('exchange', input, 'admin_save_exchange', {
    p_platform_id: input.id ?? null, p_expected_updated_at: input.expectedUpdatedAt ?? null,
    p_name: input.name.trim(), p_slug: input.slug, p_description: input.description, p_website_url: input.websiteUrl,
    p_logo_media_id: input.logoMediaId, p_status: input.status, p_country_code: input.countryCode,
    p_founded_year: input.foundedYear, p_exchange_type: input.exchangeType, p_product_summary: input.productSummary,
    p_fiat_support: input.fiatSupport, p_regulation_summary: input.regulationSummary,
    p_regulation_source_url: input.regulationSourceUrl, p_is_featured: input.featured, p_display_order: input.displayOrder,
  })
}

export async function deletePropFirmSource(input: PlatformDeleteInput) { return remove('prop_firm', input) }
export async function deleteBrokerSource(input: PlatformDeleteInput) { return remove('broker', input) }
export async function deleteExchangeSource(input: PlatformDeleteInput) { return remove('exchange', input) }

async function save(kind: PlatformKind, input: { id?: string }, rpc: string, params: Record<string, unknown>): Promise<Result> {
  const access = await getCurrentAdminPermissions()
  if (!access.userId) return fail('La sesión expiró. Vuelve a iniciar sesión.')
  if (!access.permissions.has(input.id ? 'platforms.update' : 'platforms.create')) return fail(`No tienes permiso para guardar ${plural(kind)}.`)
  const result = await (await createClient()).rpc(rpc, params)
  if (result.error) return fail(rpcMessage(result.error.code))
  const row = firstRow(result.data)
  if (!row) return fail('La operación no devolvió una confirmación válida.')
  return finish(row, kind, row.operation === 'created' ? `${label(kind)} creado.` : `${label(kind)} actualizado.`)
}

async function remove(kind: PlatformKind, input: PlatformDeleteInput): Promise<Result> {
  if (!isPlatformDeleteInput(input) || input.type !== kind) return fail(`${label(kind)} no válido.`)
  const access = await getCurrentAdminPermissions()
  if (!access.userId) return fail('La sesión expiró. Vuelve a iniciar sesión.')
  if (!access.permissions.has('platforms.delete')) return fail(`No tienes permiso para eliminar ${plural(kind)}.`)
  const result = await (await createClient()).rpc('admin_delete_platform', {
    p_platform_id: input.id, p_expected_type: input.type, p_expected_slug: input.slug,
    p_expected_updated_at: input.expectedUpdatedAt,
  })
  if (result.error) return fail(rpcMessage(result.error.code))
  const row = firstRow(result.data)
  return row ? finish(row, kind, `${label(kind)} eliminado.`) : fail('La eliminación no devolvió una confirmación válida.')
}

function firstRow(data: unknown): RpcRow | null {
  const value = Array.isArray(data) ? data[0] : data
  if (!value || typeof value !== 'object') return null
  const row = value as Partial<RpcRow>
  return typeof row.platform_id === 'string' && typeof row.operation === 'string' ? row as RpcRow : null
}
function finish(row: RpcRow, kind: PlatformKind, message: string): Result {
  try {
    invalidatePublicPlatformSource(kind)
    for (const path of paths(kind, row.previous_slug, row.current_slug)) revalidatePath(path)
    return { ok: true, message, id: row.platform_id }
  } catch { return fail('El cambio se guardó, pero no fue posible renovar la caché pública. No repitas la operación; recarga y verifica el contenido.') }
}
function rpcMessage(code?: string) {
  if (code === '28000') return 'La sesión expiró. Vuelve a iniciar sesión.'
  if (code === '42501') return 'No tienes permiso para realizar esta operación.'
  if (code === '40001') return 'El recurso cambió. Recarga la página antes de intentarlo de nuevo.'
  if (code === '23505') return 'El slug ya está en uso.'
  if (code === '23503') return 'La operación está bloqueada por referencias o dependencias existentes.'
  if (code === 'P0002') return 'El recurso ya no existe o cambió de tipo.'
  return 'No se pudo completar la operación. Revisa los datos e inténtalo de nuevo.'
}
function paths(kind: PlatformKind, previousSlug: string | null, nextSlug: string | null) { const base = kind === 'prop_firm' ? '/prop-firms' : kind === 'broker' ? '/brokers' : '/exchanges'; return [...new Set(['/', base, '/comparador', '/ofertas', `/admin/${kind === 'prop_firm' ? 'platforms' : `${kind}s`}`, ...[previousSlug, nextSlug].filter(Boolean).map((slug) => `${base}/${slug}`)])] }
function label(kind: PlatformKind) { return kind === 'prop_firm' ? 'Prop Firm' : kind === 'broker' ? 'Broker' : 'Exchange' }
function plural(kind: PlatformKind) { return kind === 'prop_firm' ? 'Prop Firms' : kind === 'broker' ? 'brokers' : 'exchanges' }
function fail(message: string): Result { return { ok: false, message } }
