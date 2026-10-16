'use client'

import { useActionState } from 'react'
import { LoaderCircle, RotateCw } from 'lucide-react'
import { resumeTranslationBatch } from '@/app/admin/content-center/translations/bulk-actions'
import { EMPTY_BATCH_ACTION_STATE } from '@/lib/admin-translation-batch-policy'

export function TranslationBatchResume({batchId,lockVersion,pending}:{batchId:string;lockVersion:number;pending:number}){
  const[state,action,isPending]=useActionState(resumeTranslationBatch,EMPTY_BATCH_ACTION_STATE)
  if(!pending)return null
  return <div><form action={action}><input type="hidden" name="batchId" value={batchId}/><input type="hidden" name="lockVersion" value={lockVersion}/><button disabled={isPending} className="admin-primary-button gap-2 px-4 py-2 text-sm">{isPending?<LoaderCircle className="size-4 animate-spin"/>:<RotateCw className="size-4"/>}Reanudar siguiente tramo ({Math.min(pending,50)})</button></form>{state.message&&<p aria-live="polite" className={`mt-2 text-xs ${state.ok?'text-emerald-700':'text-red-700'}`}>{state.message}</p>}</div>
}
