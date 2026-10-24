'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'
import { TRANSLATION_RESOURCES, type TranslationResourceType } from '@/lib/admin-translation-inventory-policy'
import { parseTranslationEditorValue, TRANSLATION_EDITOR_ACTIONS, type TranslationEditorAction } from '@/lib/admin-translation-editor-policy'
import { getTranslationDetail, getTranslationResourceDetail, parseResourceKey } from '@/lib/admin-translation-inventory'
import { requestIndividualAiDraft } from '@/lib/admin-translation-ai'
import type { TranslationActionState } from '@/lib/admin-translation-action-state'
import type { TranslationBulkResult } from '@/lib/admin-translation-bulk-state'
import { isEligibleForBulkAction, isResourceBulkAction } from '@/lib/admin-translation-resource-policy'
import { revalidateSiteContent } from '@/lib/admin-content-revalidation'
import { invalidatePublicTranslations, type PublicTranslationResourceType } from '@/lib/admin-public-translation-revalidation'

const RPC_BY_ACTION = {
  save_draft: 'translation_save_draft',
  submit_review: 'translation_submit_review',
  approve: 'translation_approve_draft',
  publish: 'translation_publish_draft',
  withdraw: 'translation_withdraw_publication',
} as const

export async function updateTranslationWorkflow(_previous: TranslationActionState, formData: FormData): Promise<TranslationActionState> {
  const stateId = String(formData.get('stateId') ?? '')
  const action = String(formData.get('intent') ?? '') as TranslationEditorAction
  const expectedLockVersion = Number(formData.get('lockVersion'))
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(stateId) || !TRANSLATION_EDITOR_ACTIONS.includes(action) || !Number.isInteger(expectedLockVersion) || expectedLockVersion < 1) {
    return { ok: false, message: 'La solicitud no es válida. Recarga la página.' }
  }

  const access = await getCurrentAdminPermissions()
  if (!access.userId) return { ok: false, message: 'La sesión expiró. Vuelve a iniciar sesión.' }
  const admin = createAdminClient()
  const { data: row, error: rowError } = await admin.from('translation_field_state').select('resource_type,resource_id,field_name,target_language').eq('id', stateId).maybeSingle()
  if (rowError || !row) return { ok: false, message: 'La traducción ya no existe.' }
  const resourceType = row.resource_type as TranslationResourceType
  const resource = TRANSLATION_RESOURCES[resourceType]
  if (!resource || !access.permissions.has(resource.updatePermission)) return { ok: false, message: 'No tienes permiso para modificar este módulo.' }

  if (action === 'generate_ai') {
    const detail = await getTranslationDetail(stateId, access.permissions)
    if (!detail || !detail.canEdit) return { ok: false, message: 'No tienes permiso para traducir este campo.' }
    if (detail.state.is_protected) return { ok: false, message: 'La traducción está protegida y no puede sobrescribirse automáticamente.' }
    try {
      await requestIndividualAiDraft({ stateId, expectedLockVersion, sourceValue: detail.sourceValue })
      revalidateTranslationAdmin()
      return { ok: true, message: 'Trabajo en cola. El worker local creará un borrador cuando esté disponible.' }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'No se pudo generar el borrador.' }
    }
  }

  const session = await createClient()
  const rpc = RPC_BY_ACTION[action]
  const args: Record<string, unknown> = { p_state_id: stateId, p_expected_lock_version: expectedLockVersion }
  if (action === 'save_draft') {
    const fieldResult = await admin.from('translation_resource_fields').select('value_kind').eq('resource_type', resourceType).eq('field_name', row.field_name).maybeSingle()
    if (fieldResult.error || !fieldResult.data) return { ok: false, message: 'El campo traducible no está registrado.' }
    try { args.p_value = parseTranslationEditorValue(formData.get('translation'), fieldResult.data.value_kind) }
    catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'La traducción no es válida.' } }
  }
  const result = await session.rpc(rpc, args)
  if (result.error) {
    const concurrent = result.error.code === '40001' || /cambió|anterior|recargue/i.test(result.error.message)
    return { ok: false, message: concurrent ? 'El contenido cambió en otra sesión. Recarga antes de continuar.' : result.error.message }
  }
  revalidateTranslationAdmin()
  if (action === 'publish' || action === 'withdraw') {
    if (resourceType === 'site_content') revalidateSiteContent(row.resource_id)
    else if (isCachedPublicResource(resourceType)) {
      try { invalidatePublicTranslations(resourceType, row.target_language) }
      catch { return { ok: false, message: 'La operación se guardó, pero no fue posible renovar la caché pública. No repitas la acción; recarga y verifica el contenido.' } }
    } else revalidatePath('/', 'layout')
  }
  return { ok: true, message: actionMessage(action) }
}

export async function updateTranslationResourceWorkflow(_previous: TranslationBulkResult, formData: FormData): Promise<TranslationBulkResult> {
  const parsed = parseResourceKey(String(formData.get('resourceKey') ?? ''))
  const intent = String(formData.get('intent') ?? '')
  const requestedLanguages = [...new Set(formData.getAll('languages').map(String).filter((language) => /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(language)))]
  if (!parsed || !isResourceBulkAction(intent) || !requestedLanguages.length) return bulkError('La solicitud agrupada no es válida.')

  const access = await getCurrentAdminPermissions()
  const resource = TRANSLATION_RESOURCES[parsed.resourceType]
  if (!access.userId) return bulkError('La sesión expiró. Vuelve a iniciar sesión.')
  if (!resource || !access.permissions.has(resource.updatePermission)) return bulkError('No tienes permiso para modificar este módulo.')
  const detail = await getTranslationResourceDetail(String(formData.get('resourceKey')), access.permissions)
  if (!detail?.workflowAvailable || !detail.canEdit) return bulkError('El flujo editorial no está disponible para este recurso.')

  const availableLanguages = new Set(detail.fields.map((field) => field.state.target_language))
  const requestedLanguageSet = new Set<string>(requestedLanguages.filter((language) => availableLanguages.has(language)))
  if (!requestedLanguageSet.size) return bulkError('Los idiomas seleccionados no están disponibles para este recurso.')
  const eligible = detail.fields.filter(({ state }) => requestedLanguageSet.has(state.target_language) && isEligibleForBulkAction(state, intent))
  if (!eligible.length) return bulkError('No hay campos elegibles para esta acción.')
  if (eligible.length > 50) return bulkError('La acción supera el límite seguro de 50 campos. Reduce los idiomas seleccionados.')

  const session = await createClient()
  const items: TranslationBulkResult['items'] = []
  for (const field of eligible) {
    try {
      if (intent === 'generate_pending' || intent === 'regenerate_stale') {
        await requestIndividualAiDraft({ stateId: field.state.id, expectedLockVersion: field.state.lock_version ?? 1, sourceValue: field.sourceValue, force: intent === 'regenerate_stale' })
      } else {
        const rpc = RPC_BY_ACTION[intent]
        const result = await session.rpc(rpc, { p_state_id: field.state.id, p_expected_lock_version: field.state.lock_version ?? 1 })
        if (result.error) throw new Error(result.error.message)
      }
      items.push({ stateId: field.state.id, fieldName: field.state.field_name, language: field.state.target_language, ok: true, message: bulkSuccessMessage(intent) })
    } catch (error) {
      items.push({ stateId: field.state.id, fieldName: field.state.field_name, language: field.state.target_language, ok: false, message: error instanceof Error ? error.message : 'Error desconocido' })
    }
  }
  revalidateTranslationAdmin()
  if (intent === 'publish' || intent === 'withdraw') {
    if (parsed.resourceType === 'site_content') revalidateSiteContent(parsed.resourceId)
    else if (isCachedPublicResource(parsed.resourceType)) {
      try { for (const language of new Set(items.filter((item) => item.ok).map((item) => item.language))) invalidatePublicTranslations(parsed.resourceType, language) }
      catch { return { ok: false, requested: items.length, succeeded: items.filter((item) => item.ok).length, failed: items.filter((item) => !item.ok).length, items, message: 'La operación se guardó, pero no fue posible renovar la caché pública. No repitas la acción; recarga y verifica el contenido.' } }
    }
    else revalidatePath('/', 'layout')
  }
  const succeeded = items.filter((item) => item.ok).length, failed = items.length - succeeded
  return { ok: failed === 0, requested: items.length, succeeded, failed, items, message: failed ? `${succeeded} campos completados y ${failed} con error.` : `${succeeded} campos completados correctamente.` }
}

function actionMessage(action: TranslationEditorAction) {
  if (action === 'generate_ai') return 'Trabajo añadido a la cola local.'
  if (action === 'save_draft') return 'Borrador guardado. El contenido público no cambió.'
  if (action === 'submit_review') return 'Borrador enviado a revisión.'
  if (action === 'approve') return 'Traducción aprobada. Aún no está publicada.'
  if (action === 'publish') return 'Traducción publicada.'
  return 'La traducción fue retirada de la web pública.'
}

function bulkError(message: string): TranslationBulkResult { return { ok: false, message, requested: 0, succeeded: 0, failed: 0, items: [] } }
function bulkSuccessMessage(action: string) {
  if (action === 'generate_pending' || action === 'regenerate_stale') return 'Trabajo en cola'
  if (action === 'submit_review') return 'En revisión'
  if (action === 'approve') return 'Aprobada'
  if (action === 'publish') return 'Publicada'
  return 'Publicación retirada'
}

function isCachedPublicResource(resourceType: TranslationResourceType): resourceType is PublicTranslationResourceType {
  return resourceType === 'blog_post_translation' || resourceType === 'tool_translation' || resourceType === 'community_translation' || resourceType === 'giveaway_translation'
    || resourceType === 'platform_translation' || resourceType === 'broker_detail_translation' || resourceType === 'exchange_detail_translation'
}

function revalidateTranslationAdmin() {
  revalidatePath('/admin/translations')
  revalidatePath('/admin/content-center')
  revalidatePath('/admin/content-center/translations')
  revalidatePath('/admin/content-center/review')
  revalidatePath('/admin/content-center/publication')
  revalidatePath('/admin/content-center/jobs')
}
