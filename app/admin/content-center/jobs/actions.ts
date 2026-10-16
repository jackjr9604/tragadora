'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'
import { TRANSLATION_RESOURCES, type TranslationResourceType } from '@/lib/admin-translation-inventory-policy'
import type { TranslationJobActionState } from '@/lib/admin-translation-job-actions'

export async function updateTranslationJob(
  _previous: TranslationJobActionState,
  formData: FormData,
): Promise<TranslationJobActionState> {
  const intent = String(formData.get('intent') ?? '')
  const jobId = String(formData.get('jobId') ?? '')
  const expectedJobUpdatedAt = String(formData.get('jobUpdatedAt') ?? '')
  const expectedStateLockVersion = Number(formData.get('stateLockVersion'))
  if (!['retry', 'cancel'].includes(intent) || !uuid(jobId)
    || !validDate(expectedJobUpdatedAt) || !Number.isInteger(expectedStateLockVersion)
    || expectedStateLockVersion < 1) {
    return fail('La solicitud no es válida. Recarga la página antes de continuar.')
  }

  const access = await getCurrentAdminPermissions()
  if (!access.userId) return fail('La sesión expiró. Vuelve a iniciar sesión.')
  const session = await createClient()
  const lookup = await session.from('translation_jobs').select('resource_type').eq('id', jobId).maybeSingle()
  if (lookup.error || !lookup.data) return fail('El trabajo ya no existe o no está disponible.')
  const resource = TRANSLATION_RESOURCES[lookup.data.resource_type as TranslationResourceType]
  if (!resource || !access.permissions.has(resource.updatePermission)) {
    return fail('No tienes permiso para modificar trabajos de este módulo.')
  }

  const result = intent === 'retry'
    ? await session.rpc('translation_admin_retry_job', {
      p_job_id: jobId,
      p_expected_job_updated_at: expectedJobUpdatedAt,
      p_expected_state_lock_version: expectedStateLockVersion,
      p_daily_request_limit: integerEnv('TRANSLATION_LOCAL_MAX_DAILY_REQUESTS', 20, 1, 100),
      p_daily_character_limit: integerEnv('TRANSLATION_LOCAL_MAX_DAILY_INPUT_CHARACTERS', 100_000, 100, 1_000_000),
    })
    : await session.rpc('translation_admin_cancel_job', {
      p_job_id: jobId,
      p_expected_job_updated_at: expectedJobUpdatedAt,
      p_expected_state_lock_version: expectedStateLockVersion,
    })
  if (result.error) return fail(friendlyError(result.error.code, result.error.message))

  revalidatePath('/admin/content-center/jobs')
  revalidatePath(`/admin/content-center/jobs/${jobId}`)
  revalidatePath('/admin/content-center/translations')
  return {
    ok: true,
    message: intent === 'retry'
      ? 'Nueva generación añadida a la cola. El trabajo original se conserva en el historial.'
      : 'Trabajo cancelado de forma segura.',
    jobId: typeof result.data === 'string' ? result.data : undefined,
  }
}

function friendlyError(code: string | undefined, message: string) {
  if (code === '40001' || /cambió|otra sesión|revisión/i.test(message)) return 'El trabajo o la traducción cambió en otra sesión. Recarga antes de continuar.'
  if (code === '42501' || /forbidden|permiso|proteg/i.test(message)) return 'No tienes permiso o el contenido está protegido por el workflow editorial.'
  if (/lease vigente/i.test(message)) return 'El worker está procesando este trabajo. Espera a que termine o venza el lease.'
  if (/límite diario/i.test(message)) return 'Se alcanzó el límite configurado de traducciones locales. Inténtalo después.'
  if (/no admite|no puede|estado editorial/i.test(message)) return message
  return 'No se pudo completar la acción de forma segura. Recarga la página e inténtalo nuevamente.'
}

function fail(message: string): TranslationJobActionState { return { ok: false, message } }
function uuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) }
function validDate(value: string) { return Boolean(value) && !Number.isNaN(Date.parse(value)) }
function integerEnv(name: string, fallback: number, min: number, max: number) { const value = Number.parseInt(process.env[name] ?? '', 10); return Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback }
