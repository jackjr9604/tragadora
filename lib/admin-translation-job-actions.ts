export type TranslationJobActionState = { ok: boolean; message: string; jobId?: string }

export const INITIAL_TRANSLATION_JOB_ACTION_STATE: TranslationJobActionState = { ok: false, message: '' }

export type TranslationJobActionEligibility = {
  canRetry: boolean
  canCancel: boolean
  retryReason: string
  cancelReason: string
}

export function translationJobActionEligibility(job: {
  status: string
  error_code: string | null
  error_recoverable: boolean
  error_category: string | null
  lease_expires_at: string | null
  editorial_state_exists: boolean
  editorial_lock_version: number | null
  workflow_status: string | null
  publication_status: string | null
  is_protected: boolean
  source_is_current: boolean
}): TranslationJobActionEligibility {
  const editorialSafe = job.editorial_state_exists && job.editorial_lock_version !== null
    && job.workflow_status === 'none' && job.publication_status !== 'published'
    && !job.is_protected && job.source_is_current
  const retryTerminal = (job.status === 'failed' && (job.error_recoverable || job.error_category === 'lease_expired'))
    || (job.status === 'cancelled' && job.error_code === 'admin_cancelled')
  const canRetry = editorialSafe && retryTerminal
  const liveLease = job.status === 'running' && (!job.lease_expires_at || new Date(job.lease_expires_at).getTime() > Date.now())
  const canCancel = editorialSafe && (job.status === 'queued' || job.status === 'retry_wait' || (job.status === 'running' && !liveLease))
  return {
    canRetry,
    canCancel,
    retryReason: canRetry ? 'Se creará una generación nueva; el trabajo original permanecerá en el historial.'
      : !editorialSafe ? 'El estado editorial actual impide un reintento seguro.'
      : !retryTerminal ? 'Solo se reintentan trabajos terminales recuperables.'
      : 'Este error requiere intervención humana y no admite reintento automático.',
    cancelReason: canCancel ? 'La cancelación no modifica borradores ni publicaciones.'
      : liveLease ? 'El worker conserva un lease vigente; espera a que termine o venza.'
      : !editorialSafe ? 'El estado editorial actual impide cancelar este trabajo.'
      : 'Solo pueden cancelarse trabajos pendientes o con lease vencido.',
  }
}
