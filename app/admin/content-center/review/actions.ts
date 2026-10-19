'use server'

import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'
import { getTranslationReviewDetails } from '@/lib/admin-translation-review'
import { TRANSLATION_RESOURCES } from '@/lib/admin-translation-inventory-policy'
import { matchesReviewSnapshot, reviewEligibility, reviewReasonLabel, type ReviewSnapshot } from '@/lib/admin-translation-review-policy'
import type { ReviewPreviewItem, ReviewPreviewState } from '@/lib/admin-translation-review-state'
import type { ReviewMutationItem, ReviewMutationState } from '@/lib/admin-translation-review-state'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { classifyEditorialRpcError, editorialSnapshot } from '@/lib/admin-translation-conflict-policy'

const MAX_PREVIEW_FIELDS = 50

export async function previewTranslationReviewSelection(_previous: ReviewPreviewState, formData: FormData): Promise<ReviewPreviewState> {
  const snapshots = parseSnapshots(formData.get('selection'))
  if (!snapshots.length) return { ok: false, message: 'Selecciona al menos una traducción para previsualizar.', items: [] }
  if (snapshots.length > MAX_PREVIEW_FIELDS) return { ok: false, message: `La vista previa admite hasta ${MAX_PREVIEW_FIELDS} campos.`, items: [] }
  const access = await getCurrentAdminPermissions()
  if (!access.userId) return { ok: false, message: 'La sesión expiró. Vuelve a iniciar sesión.', items: [] }
  const items: ReviewPreviewItem[] = []
  const details = await getTranslationReviewDetails(snapshots.map((snapshot) => snapshot.stateId), access.permissions)
  for (const snapshot of snapshots) {
    const detail = details.get(snapshot.stateId)
    if (!detail) continue
    const resource = TRANSLATION_RESOURCES[detail.state.resource_type]
    if (!resource || !access.permissions.has(resource.updatePermission)) continue
    const eligibility = reviewEligibility(detail.state)
    const concurrent = !matchesReviewSnapshot(detail.state, snapshot)
    items.push({ stateId: detail.state.id, resourceType: detail.state.resource_type, resourceId: detail.state.resource_id,
      resourceLabel: detail.resourceLabel, fieldName: detail.state.field_name, sourceLanguage: detail.state.source_language,
      targetLanguage: detail.state.target_language, source: detail.source, draft: displayValue(detail.state.draft_value),
      protected: detail.state.is_protected, eligible: eligibility.eligible && !concurrent,
      exclusionReason: concurrent ? 'concurrent_change' : eligibility.reason, snapshot: snapshotOf(detail.state) })
  }
  if (!items.length) return { ok: false, message: 'No hay traducciones accesibles en la selección.', items: [] }
  const eligible = items.filter((item) => item.eligible).length
  return { ok: eligible === items.length, message: `${eligible} de ${items.length} campos conservan una versión vigente y elegible para revisión. Esta vista previa no modifica ningún dato.`, items }
}

export async function mutateTranslationReviewSelection(_previous: ReviewMutationState, formData: FormData): Promise<ReviewMutationState> {
  const intent = String(formData.get('intent') ?? '')
  const snapshots = parseSnapshots(formData.get('selection'))
  const reason = String(formData.get('reason') ?? '').trim()
  if ((intent !== 'approve' && intent !== 'reject') || formData.get('confirmed') !== 'yes' || !snapshots.length || snapshots.length > MAX_PREVIEW_FIELDS) {
    return mutationError('La solicitud no es válida o no fue confirmada.')
  }
  if (intent === 'reject' && (reason.length < 5 || reason.length > 500)) return mutationError('El motivo del rechazo debe tener entre 5 y 500 caracteres.')

  const access = await getCurrentAdminPermissions()
  if (!access.userId) return mutationError('La sesión expiró. Vuelve a iniciar sesión.')
  const details = await getTranslationReviewDetails(snapshots.map((snapshot) => snapshot.stateId), access.permissions)
  const session = await createClient()
  const items: ReviewMutationItem[] = []
  for (const snapshot of snapshots) {
    const detail = details.get(snapshot.stateId)
    if (!detail) { items.push(resultItem(snapshot.stateId, '', '', 'skipped', 'No existe o no tienes permiso para este campo.')); continue }
    const resource = TRANSLATION_RESOURCES[detail.state.resource_type]
    if (!resource || !access.permissions.has(resource.updatePermission)) { items.push(resultItem(detail.state.id, detail.state.field_name, detail.state.target_language, 'skipped', 'Sin permiso para este módulo.')); continue }
    const eligibility = reviewEligibility(detail.state)
    if (!eligibility.eligible) { items.push(resultItem(detail.state.id, detail.state.field_name, detail.state.target_language, 'skipped', eligibility.reason ? reviewReasonLabel(eligibility.reason) : 'Ya no es elegible.')); continue }
    if (!matchesReviewSnapshot(detail.state, snapshot)) { items.push(resultItem(detail.state.id, detail.state.field_name, detail.state.target_language, 'skipped', 'Cambió después de la previsualización.')); continue }
    const rpc = intent === 'approve' ? 'translation_approve_draft' : 'translation_reject_draft'
    const args = intent === 'approve'
      ? { p_state_id: detail.state.id, p_expected_lock_version: snapshot.lockVersion }
      : { p_state_id: detail.state.id, p_expected_lock_version: snapshot.lockVersion, p_reason: reason }
    const response = await session.rpc(rpc, args)
    if (response.error) {
      const conflict = classifyEditorialRpcError(response.error)
      items.push(resultItem(detail.state.id, detail.state.field_name, detail.state.target_language, conflict.expected ? 'skipped' : 'error', conflict.message))
      continue
    }
    items.push(resultItem(detail.state.id, detail.state.field_name, detail.state.target_language, intent === 'approve' ? 'approved' : 'rejected', intent === 'approve' ? 'Aprobada; aún no está publicada.' : 'Devuelta a borrador para corrección.'))
  }
  revalidatePath('/admin/content-center/review')
  revalidatePath('/admin/content-center/translations')
  const approved=items.filter((item)=>item.outcome==='approved').length,rejected=items.filter((item)=>item.outcome==='rejected').length
  const skipped=items.filter((item)=>item.outcome==='skipped').length,failed=items.filter((item)=>item.outcome==='error').length
  const processed=approved+rejected
  return { ok: failed===0, message:`${processed} procesadas, ${skipped} omitidas y ${failed} con error. Ninguna traducción fue publicada.`, processed, approved, rejected, skipped, failed, items }
}

function parseSnapshots(value: FormDataEntryValue | null): ReviewSnapshot[] {
  if (typeof value !== 'string' || value.length > 30_000) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    const unique = new Map<string, ReviewSnapshot>()
    for (const item of parsed.slice(0, MAX_PREVIEW_FIELDS + 1)) {
      if (!item || typeof item !== 'object') continue
      const snapshot = item as Partial<ReviewSnapshot>
      if (!isUuid(snapshot.stateId) || !Number.isInteger(snapshot.lockVersion) || Number(snapshot.lockVersion) < 1 || typeof snapshot.sourceHash !== 'string' || !Number.isInteger(snapshot.sourceRevision)) continue
      if (snapshot.draftSourceHash !== null && typeof snapshot.draftSourceHash !== 'string') continue
      if (snapshot.draftSourceRevision !== null && !Number.isInteger(snapshot.draftSourceRevision)) continue
      if (typeof snapshot.status !== 'string' || typeof snapshot.workflowStatus !== 'string' || typeof snapshot.publicationStatus !== 'string' || typeof snapshot.protected !== 'boolean') continue
      unique.set(snapshot.stateId, snapshot as ReviewSnapshot)
    }
    return [...unique.values()]
  } catch { return [] }
}

function isUuid(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) }
function displayValue(value: unknown) { if (value == null) return null; if (Array.isArray(value)) return value.map(String).join('\n'); if (typeof value === 'object') return JSON.stringify(value, null, 2); return String(value) }
function snapshotOf(state: Parameters<typeof editorialSnapshot>[0]):ReviewSnapshot { return editorialSnapshot(state) }
function mutationError(message:string):ReviewMutationState { return {ok:false,message,processed:0,approved:0,rejected:0,skipped:0,failed:0,items:[]} }
function resultItem(stateId:string,fieldName:string,language:string,outcome:ReviewMutationItem['outcome'],message:string):ReviewMutationItem { return {stateId,fieldName,language,outcome,message} }
