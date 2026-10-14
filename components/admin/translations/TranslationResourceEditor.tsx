'use client'

import { useActionState, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { CheckCircle2, Languages, Send, Sparkles } from 'lucide-react'
import { updateTranslationResourceWorkflow } from '@/app/admin/translations/actions'
import { INITIAL_TRANSLATION_BULK_RESULT } from '@/lib/admin-translation-bulk-state'
import { countEligibleByLanguage, type ResourceBulkAction } from '@/lib/admin-translation-resource-policy'
import type { TranslationFieldDetail } from '@/lib/admin-translation-inventory'
import { TranslationEditor } from './TranslationEditor'

type Props = {
  resourceKey: string
  fields: TranslationFieldDetail[]
  canEdit: boolean
  workflowAvailable: boolean
  aiEnabled: boolean
  aiProvider: string
  aiMessage: string
}

const ACTIONS: { intent: ResourceBulkAction; label: string; help: string; icon: typeof Sparkles }[] = [
  { intent: 'generate_pending', label: 'Traducir pendientes', help: 'Crea un job individual por campo elegible.', icon: Sparkles },
  { intent: 'regenerate_stale', label: 'Retraducir desactualizados', help: 'Solo procesa campos stale sin protección ni borrador.', icon: Sparkles },
  { intent: 'submit_review', label: 'Enviar borradores a revisión', help: 'Avanza únicamente borradores vigentes.', icon: Send },
  { intent: 'approve', label: 'Aprobar revisados', help: 'Aprueba campos actualmente en revisión.', icon: CheckCircle2 },
  { intent: 'publish', label: 'Publicar aprobados', help: 'Publica solo campos aprobados y vigentes.', icon: CheckCircle2 },
]

export function TranslationResourceEditor(props: Props) {
  const languages = useMemo(() => [...new Set(props.fields.map((field) => field.state.target_language))].sort(), [props.fields])
  const [language, setLanguage] = useState(() => languages[0] ?? '')
  const [bulkResult, bulkAction] = useActionState(updateTranslationResourceWorkflow, INITIAL_TRANSLATION_BULK_RESULT)
  const states = useMemo(() => props.fields.map((field) => field.state), [props.fields])
  const visibleFields = props.fields.filter((field) => field.state.target_language === language)

  return <div className="space-y-6">
    <section className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div><div className="flex items-center gap-2 font-bold text-violet-950"><Languages className="size-5" /> Acciones para el recurso completo</div><p className="mt-1 text-sm text-violet-800">Cada campo conserva su propio job, estado, versión y resultado. Nunca se publica al traducir.</p></div>
        <p className="rounded-lg bg-white px-3 py-2 text-xs text-violet-800 ring-1 ring-violet-200">Máximo 50 campos por acción</p>
      </div>
      {!props.canEdit && <p className="mt-4 rounded-lg bg-white p-3 text-sm text-slate-700">Tienes acceso de lectura, pero no permiso de actualización para este módulo.</p>}
      {props.canEdit && props.workflowAvailable && <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {ACTIONS.map((item) => <BulkAction key={item.intent} {...item} resourceKey={props.resourceKey} states={states} aiEnabled={props.aiEnabled} action={bulkAction} />)}
      </div>}
      {!props.workflowAvailable && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">El flujo editorial no está disponible en el esquema actual.</p>}
      {bulkResult.message && <div aria-live="polite" className={`mt-4 rounded-xl p-3 text-sm ${bulkResult.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-white text-red-800 ring-1 ring-red-200'}`}><strong>{bulkResult.message}</strong>{bulkResult.items.length > 0 && <ul className="mt-2 max-h-36 space-y-1 overflow-auto text-xs">{bulkResult.items.map((item) => <li key={`${item.stateId}:${item.message}`} className={item.ok ? 'text-emerald-800' : 'text-red-800'}>{item.language.toUpperCase()} · {item.fieldName}: {item.message}</li>)}</ul>}</div>}
    </section>

    <div className="flex gap-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Idioma de traducción">
      {languages.map((code) => { const total = props.fields.filter((field) => field.state.target_language === code).length; return <button key={code} type="button" role="tab" aria-selected={language === code} onClick={() => setLanguage(code)} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition ${language === code ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{code.toUpperCase()} <span className="ml-1 text-xs">({total})</span></button> })}
    </div>

    <div className="space-y-5">{visibleFields.map((field) => <section key={field.state.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><p className="font-mono text-xs font-bold text-amber-700">{field.state.field_name}</p><p className="mt-1 text-xs text-slate-500">{statusLabel(field.state)}</p></div>{field.state.is_protected && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 ring-1 ring-blue-200">Protección manual</span>}</div><TranslationEditor key={`${field.state.id}:${field.state.lock_version ?? 0}`} stateId={field.state.id} sourceLanguage={field.state.source_language} targetLanguage={field.state.target_language} source={field.source} translated={field.translated} draftValue={field.state.draft_value} workflowStatus={field.state.workflow_status ?? 'none'} publicationStatus={field.state.publication_status ?? 'unpublished'} lockVersion={field.state.lock_version ?? 1} valueKind={field.valueKind} maxCharacters={field.maxCharacters} canEdit={props.canEdit} workflowAvailable={props.workflowAvailable} sourceChanged={Boolean(field.state.draft_source_hash && field.state.draft_source_hash !== field.state.source_hash)} isProtected={field.state.is_protected} aiEnabled={props.aiEnabled} aiProvider={props.aiProvider} aiMessage={props.aiMessage} /></section>)}</div>
  </div>
}

function BulkAction({ intent, label, help, icon: Icon, resourceKey, states, aiEnabled, action }: (typeof ACTIONS)[number] & { resourceKey: string; states: TranslationFieldDetail['state'][]; aiEnabled: boolean; action: (payload: FormData) => void }) {
  const languages=[...new Set(states.map((state)=>state.target_language))].sort(),counts=countEligibleByLanguage(states,intent,languages)
  const total=Object.values(counts).reduce((sum,count)=>sum+count,0)
  const disabled = total === 0 || ((intent === 'generate_pending' || intent === 'regenerate_stale') && !aiEnabled)
  const confirmation = intent === 'publish'
    ? `Se publicarán ${total} campos aprobados. Los demás conservarán su estado o fallback actual; la publicación puede quedar parcial. ¿Continuar?`
    : `${label}: se procesarán hasta ${total} campos elegibles. ¿Continuar?`
  return <form action={action} className="rounded-xl border border-violet-200 bg-white p-4">
    <input type="hidden" name="resourceKey" value={resourceKey} /><input type="hidden" name="intent" value={intent} />
    <div className="flex gap-3"><Icon className="mt-0.5 size-5 shrink-0 text-violet-700" /><div className="min-w-0 flex-1"><p className="font-semibold text-slate-950">{label}</p><p className="mt-1 text-xs text-slate-500">{help}</p><div className="mt-3 flex flex-wrap gap-3 text-xs">{languages.map(code=><label key={code} className="flex items-center gap-1.5"><input type="checkbox" name="languages" value={code} defaultChecked disabled={!counts[code]} /> {code.toUpperCase()} ({counts[code]??0})</label>)}</div><BulkSubmit disabled={disabled} count={total} label={label} confirmation={confirmation} /></div></div>
  </form>
}

function BulkSubmit({ disabled, count, label, confirmation }: { disabled: boolean; count: number; label: string; confirmation: string }) {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={disabled || pending} onClick={(event) => { if (!window.confirm(confirmation)) event.preventDefault() }} className="admin-secondary-button mt-3 w-full justify-center px-3 py-2 text-xs disabled:opacity-50">{pending ? 'Procesando…' : `${label} (${count})`}</button>
}

function statusLabel(state: TranslationFieldDetail['state']) {
  const parts = [state.status === 'missing' ? 'Pendiente' : state.status === 'stale' ? 'Desactualizada' : state.status === 'error' ? 'Error' : state.status === 'queued' ? 'En cola' : 'Traducida']
  if (state.workflow_status && state.workflow_status !== 'none') parts.push(state.workflow_status === 'draft' ? 'Borrador' : state.workflow_status === 'in_review' ? 'En revisión' : 'Aprobada')
  if (state.publication_status === 'published') parts.push('Publicada')
  return parts.join(' · ')
}
