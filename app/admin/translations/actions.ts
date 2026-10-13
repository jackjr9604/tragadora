'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'
import { TRANSLATION_RESOURCES, type TranslationResourceType } from '@/lib/admin-translation-inventory-policy'
import { parseTranslationEditorValue, TRANSLATION_EDITOR_ACTIONS, type TranslationEditorAction } from '@/lib/admin-translation-editor-policy'
import { getTranslationDetail } from '@/lib/admin-translation-inventory'
import { requestIndividualAiDraft } from '@/lib/admin-translation-ai'
import type { TranslationActionState } from '@/lib/admin-translation-action-state'

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
  const { data: row, error: rowError } = await admin.from('translation_field_state').select('resource_type,field_name').eq('id', stateId).maybeSingle()
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
      revalidatePath('/admin/translations')
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
  revalidatePath('/admin/translations')
  if (action === 'publish' || action === 'withdraw') revalidatePath('/', 'layout')
  return { ok: true, message: actionMessage(action) }
}

function actionMessage(action: TranslationEditorAction) {
  if (action === 'generate_ai') return 'Trabajo añadido a la cola local.'
  if (action === 'save_draft') return 'Borrador guardado. El contenido público no cambió.'
  if (action === 'submit_review') return 'Borrador enviado a revisión.'
  if (action === 'approve') return 'Traducción aprobada. Aún no está publicada.'
  if (action === 'publish') return 'Traducción publicada.'
  return 'La traducción fue retirada de la web pública.'
}
