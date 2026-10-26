import { isOfferSourceInput, isOfferStatusInput, type OfferSourceInput, type OfferStatusInput } from '@/lib/admin-offer-source-policy'

export type OfferActionResult = {
  ok: boolean
  message: string
  id?: string
  updatedAt?: string
  status?: boolean
  code?: 'conflict' | 'revalidation_failed'
}

type RpcResult = { data: unknown; error: { code?: string } | null }
export type OfferActionDependencies = {
  getAccess: () => Promise<{ userId: string | null; permissions: Set<string> }>
  rpc: (name: 'admin_save_offer' | 'admin_set_offer_status', args: Record<string, unknown>) => Promise<RpcResult>
  invalidate: (result: OfferActionResult) => void
}

type SaveRow = { offer_id: string; operation: 'created' | 'updated' | 'replayed'; current_updated_at: string }
type StatusRow = { offer_id: string; status: boolean; current_updated_at: string }

export async function executeSaveOffer(input: OfferSourceInput, deps: OfferActionDependencies): Promise<OfferActionResult> {
  if (!isOfferSourceInput(input)) return fail('Los datos de la oferta no son válidos.')
  const access = await deps.getAccess()
  if (!access.userId) return fail('La sesión expiró. Vuelve a iniciar sesión.')
  const editing = Boolean(input.id)
  if (!access.permissions.has(editing ? 'offers.update' : 'offers.create')) return fail('No tienes permiso para guardar esta oferta.')
  const result = await deps.rpc('admin_save_offer', {
    p_offer_id: input.id ?? null,
    p_expected_updated_at: input.expectedUpdatedAt ?? null,
    p_creation_request_id: input.creationRequestId ?? null,
    p_payload: buildPayload(input),
  })
  if (result.error) return rpcFailure(result.error.code)
  const row = firstSaveRow(result.data)
  if (!row) return fail('La operación no devolvió una confirmación válida.')
  const success: OfferActionResult = {
    ok: true,
    message: row.operation === 'updated' ? 'Oferta actualizada.' : row.operation === 'replayed' ? 'La oferta ya había sido creada; se recuperó el resultado anterior.' : 'Oferta creada.',
    id: row.offer_id,
    updatedAt: row.current_updated_at,
  }
  return invalidateAfterCommit(success, deps)
}

export async function executeSetOfferStatus(input: OfferStatusInput, deps: OfferActionDependencies): Promise<OfferActionResult> {
  if (!isOfferStatusInput(input)) return fail('El cambio de estado no es válido.')
  const access = await deps.getAccess()
  if (!access.userId) return fail('La sesión expiró. Vuelve a iniciar sesión.')
  if (!access.permissions.has('offers.update')) return fail('No tienes permiso para cambiar el estado de esta oferta.')
  const result = await deps.rpc('admin_set_offer_status', {
    p_offer_id: input.id,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_status: input.status,
  })
  if (result.error) return rpcFailure(result.error.code)
  const row = firstStatusRow(result.data)
  if (!row) return fail('La operación no devolvió una confirmación válida.')
  return invalidateAfterCommit({
    ok: true,
    message: row.status ? 'Oferta activada.' : 'Oferta desactivada.',
    id: row.offer_id,
    updatedAt: row.current_updated_at,
    status: row.status,
  }, deps)
}

function invalidateAfterCommit(result: OfferActionResult, deps: OfferActionDependencies): OfferActionResult {
  try {
    deps.invalidate(result)
    return result
  } catch {
    return {
      ...result,
      ok: false,
      code: 'revalidation_failed',
      message: 'El cambio se guardó, pero no fue posible renovar la caché pública. No repitas la operación; recarga y verifica el contenido.',
    }
  }
}

function buildPayload(input: OfferSourceInput) {
  return {
    platform_id: input.platformId,
    challenge_id: input.challengeId,
    affiliate_link_id: input.affiliateLinkId,
    title: input.title.trim(),
    description: clean(input.description),
    discount_value: input.discountValue,
    discount_type: input.discountType,
    promo_code: clean(input.promoCode),
    includes_free_account: input.includesFreeAccount,
    free_account_label: input.includesFreeAccount ? clean(input.freeAccountLabel) : null,
    is_featured: input.featured,
    hot_badge: clean(input.hotBadge),
    short_highlight: clean(input.shortHighlight),
    country_code: clean(input.countryCode)?.toUpperCase() ?? null,
    language: clean(input.language)?.toLowerCase() ?? null,
    starts_at: input.startsAt,
    expires_at: input.expiresAt,
    priority: input.priority,
    status: input.status,
  }
}

function firstSaveRow(data: unknown): SaveRow | null {
  const row = first(data) as Partial<SaveRow> | null
  return row && typeof row.offer_id === 'string'
    && (row.operation === 'created' || row.operation === 'updated' || row.operation === 'replayed')
    && typeof row.current_updated_at === 'string' ? row as SaveRow : null
}
function firstStatusRow(data: unknown): StatusRow | null {
  const row = first(data) as Partial<StatusRow> | null
  return row && typeof row.offer_id === 'string' && typeof row.status === 'boolean' && typeof row.current_updated_at === 'string' ? row as StatusRow : null
}
function first(data: unknown): Record<string, unknown> | null {
  const value = Array.isArray(data) ? data[0] : data
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}
function rpcFailure(code?: string): OfferActionResult {
  if (code === '40001') return { ok: false, code: 'conflict', message: 'La oferta fue modificada por otra sesión. Recarga los datos antes de intentarlo de nuevo.' }
  if (code === '28000') return fail('La sesión expiró. Vuelve a iniciar sesión.')
  if (code === '42501') return fail('No tienes permiso para realizar esta operación.')
  if (code === '22023' || code === '23514') return fail('Los datos de la oferta no son válidos.')
  if (code === '23503') return fail('La plataforma, el challenge o el enlace afiliado ya no son válidos.')
  if (code === '23505') return fail('La identidad de creación o los datos entran en conflicto con un registro existente.')
  if (code === 'P0002') return fail('La oferta ya no existe.')
  return fail('No se pudo completar la operación. Recarga la página e inténtalo de nuevo.')
}
function clean(value: string | null) { const normalized = value?.trim(); return normalized || null }
function fail(message: string): OfferActionResult { return { ok: false, message } }
