'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { updateTranslationJob } from '@/app/admin/content-center/jobs/actions'
import { INITIAL_TRANSLATION_JOB_ACTION_STATE, type TranslationJobActionEligibility } from '@/lib/admin-translation-job-actions'

export function TranslationJobActions({
  jobId,
  jobUpdatedAt,
  stateLockVersion,
  eligibility,
}: {
  jobId: string
  jobUpdatedAt: string
  stateLockVersion: number
  eligibility: TranslationJobActionEligibility
}) {
  const [result, action] = useActionState(updateTranslationJob, INITIAL_TRANSLATION_JOB_ACTION_STATE)
  if (!eligibility.canRetry && !eligibility.canCancel) {
    return <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">{eligibility.cancelReason}</p>
  }
  return <form action={action} className="space-y-3">
    <input type="hidden" name="jobId" value={jobId}/>
    <input type="hidden" name="jobUpdatedAt" value={jobUpdatedAt}/>
    <input type="hidden" name="stateLockVersion" value={stateLockVersion}/>
    <div className="flex flex-wrap gap-2">
      {eligibility.canRetry && <SubmitButton intent="retry" label="Crear nuevo reintento" confirm="Se creará una generación nueva y el trabajo original permanecerá en el historial. ¿Continuar?"/>}
      {eligibility.canCancel && <SubmitButton intent="cancel" label="Cancelar trabajo" danger confirm="¿Cancelar este trabajo pendiente? No se modificará ningún borrador ni publicación."/>}
    </div>
    <p className="text-xs leading-5 text-slate-500">{eligibility.canRetry ? eligibility.retryReason : eligibility.cancelReason}</p>
    {result.message && <p aria-live="polite" className={`rounded-lg p-3 text-sm ${result.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>{result.message}</p>}
  </form>
}

function SubmitButton({ intent, label, danger = false, confirm }: { intent: string; label: string; danger?: boolean; confirm: string }) {
  const { pending } = useFormStatus()
  return <button type="submit" name="intent" value={intent} disabled={pending}
    onClick={(event) => { if (!window.confirm(confirm)) event.preventDefault() }}
    className={`${danger ? 'border border-red-200 bg-red-50 text-red-800 hover:bg-red-100' : 'admin-primary-button'} rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50`}>
    {pending ? 'Procesando…' : label}
  </button>
}
