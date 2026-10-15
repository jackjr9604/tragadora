'use client'

import { useActionState, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { CheckCircle2, EyeOff, Languages, Send, Sparkles } from 'lucide-react'
import { updateTranslationResourceWorkflow } from '@/app/admin/translations/actions'
import { INITIAL_TRANSLATION_BULK_RESULT } from '@/lib/admin-translation-bulk-state'
import { countEligibleByLanguage, translationEditorRows, translationFieldLabel, type ResourceBulkAction } from '@/lib/admin-translation-resource-policy'
import type { TranslationFieldDetail } from '@/lib/admin-translation-inventory'
import { TranslationEditor } from './TranslationEditor'

type Props = {
  resourceKey: string
  fields: TranslationFieldDetail[]
  canEdit: boolean
  workflowAvailable: boolean
  aiEnabled: boolean
  languages?: { code: string; native_name: string }[]
}

const ACTIONS: { intent: ResourceBulkAction; label: string; help: string; icon: typeof Sparkles }[] = [
  { intent: 'generate_pending', label: 'Traducir campos pendientes', help: 'Solo campos pendientes o con error, sin protección, borrador ni publicación vigente.', icon: Sparkles },
  { intent: 'regenerate_stale', label: 'Retraducir campos desactualizados', help: 'Solo campos desactualizados, sin protección, borrador ni publicación vigente.', icon: Sparkles },
  { intent: 'submit_review', label: 'Enviar borradores vigentes a revisión', help: 'Solo borradores vigentes de este idioma.', icon: Send },
  { intent: 'approve', label: 'Aprobar campos en revisión', help: 'Solo campos que están actualmente en revisión.', icon: CheckCircle2 },
  { intent: 'publish', label: 'Publicar campos aprobados', help: 'Solo campos aprobados y vigentes; los demás mantienen su fallback.', icon: CheckCircle2 },
  { intent: 'withdraw', label: 'Retirar campos publicados', help: 'Solo campos publicados; conserva la traducción y activa el fallback seguro.', icon: EyeOff },
]

export function TranslationResourceEditor(props: Props) {
  const languages = useMemo(() => { const available=new Set(props.fields.map((field)=>field.state.target_language));const configured=(props.languages??[]).filter((item)=>available.has(item.code));return configured.length?configured:[...available].sort().map((code)=>({code,native_name:code.toUpperCase()})) }, [props.fields,props.languages])
  const [language, setLanguage] = useState(() => languages[0]?.code ?? '')
  const [bulkResult, bulkAction] = useActionState(updateTranslationResourceWorkflow, INITIAL_TRANSLATION_BULK_RESULT)
  const states = useMemo(() => props.fields.map((field) => field.state), [props.fields])
  const visibleFields = props.fields.filter((field) => field.state.target_language === language)
  const applicable=ACTIONS.map((item)=>({item,count:countEligibleByLanguage(states,item.intent,[language])[language]??0})).filter(({count})=>count>0)

  return <div className="space-y-6">
    <section className="rounded-2xl border border-violet-200 bg-violet-50/95 p-4 shadow-sm backdrop-blur xl:sticky xl:top-4 xl:z-10">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center"><div><div className="flex items-center gap-2 font-bold text-violet-950"><Languages className="size-5" /> Flujo editorial · {language.toUpperCase()}</div><p className="mt-1 text-sm text-violet-800">Solo se muestran acciones aplicables. Traducir crea borradores; publicar siempre requiere aprobación humana.</p></div><label className="text-xs font-bold uppercase tracking-wide text-violet-900">Idioma<select value={language} onChange={(event)=>setLanguage(event.target.value)} className="mt-1 block min-w-52 rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm normal-case tracking-normal"><option value="" disabled>Seleccionar idioma</option>{languages.map((item)=><option key={item.code} value={item.code}>{item.native_name} ({item.code.toUpperCase()})</option>)}</select></label></div>
      {!props.canEdit && <p className="mt-4 rounded-lg bg-white p-3 text-sm text-slate-700">Tienes acceso de lectura, pero no permiso de actualización para este módulo.</p>}
      {props.canEdit && props.workflowAvailable && <div className="mt-4 flex flex-wrap gap-2">{applicable.map(({item,count})=><BulkAction key={item.intent} {...item} resourceKey={props.resourceKey} language={language} count={count} aiEnabled={props.aiEnabled} action={bulkAction}/>)}</div>}
      {props.canEdit&&props.workflowAvailable&&!applicable.length&&<p className="mt-4 rounded-lg bg-white p-3 text-sm text-slate-600">No hay acciones agrupadas aplicables para este idioma. Puedes editar o guardar los campos individualmente.</p>}
      {!props.workflowAvailable && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">El flujo editorial no está disponible en el esquema actual.</p>}
      {bulkResult.message && <div aria-live="polite" className={`mt-4 rounded-xl p-3 text-sm ${bulkResult.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-white text-red-800 ring-1 ring-red-200'}`}><strong>{bulkResult.message}</strong>{bulkResult.items.length > 0 && <ul className="mt-2 max-h-36 space-y-1 overflow-auto text-xs">{bulkResult.items.map((item) => <li key={`${item.stateId}:${item.message}`} className={item.ok ? 'text-emerald-800' : 'text-red-800'}>{item.language.toUpperCase()} · {item.fieldName}: {item.message}</li>)}</ul>}</div>}
    </section>

    <div className="space-y-5">{visibleFields.map((field) => <section key={field.state.id} className="scroll-mt-52 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="min-w-0"><h3 className="font-semibold text-slate-900">{translationFieldLabel(field.state.field_name)}</h3><p className="mt-0.5 break-all font-mono text-[11px] text-slate-400" title="Identificador técnico del campo">{field.state.field_name}</p><StateDimensions state={field.state}/></div>{field.state.is_protected && <span className="w-fit shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 ring-1 ring-blue-200">Protección manual</span>}</div><TranslationEditor key={`${field.state.id}:${field.state.lock_version ?? 0}`} stateId={field.state.id} sourceLanguage={field.state.source_language} targetLanguage={field.state.target_language} source={field.source} translated={field.translated} draftValue={field.state.draft_value} workflowStatus={field.state.workflow_status ?? 'none'} publicationStatus={field.state.publication_status ?? 'unpublished'} lockVersion={field.state.lock_version ?? 1} valueKind={field.valueKind} maxCharacters={field.maxCharacters} rows={translationEditorRows(field.state.field_name,field.valueKind,field.maxCharacters)} canEdit={props.canEdit} workflowAvailable={props.workflowAvailable} sourceChanged={Boolean(field.state.draft_source_hash && field.state.draft_source_hash !== field.state.source_hash)} /></section>)}</div>
  </div>
}

function BulkAction({ intent, label, help, icon: Icon, resourceKey, language, count, aiEnabled, action }: (typeof ACTIONS)[number] & { resourceKey: string; language:string;count:number;aiEnabled: boolean;action:(payload:FormData)=>void }) {
  const disabled = ((intent === 'generate_pending' || intent === 'regenerate_stale') && !aiEnabled)
  const confirmation = intent === 'publish'
    ? `Se publicarán ${count} campos aprobados en ${language.toUpperCase()}. Los demás conservarán su estado o fallback actual; la publicación puede quedar parcial. ¿Continuar?`
    : `${label}: se procesarán ${count} campos elegibles en ${language.toUpperCase()}. ¿Continuar?`
  return <form action={action} title={help}>
    <input type="hidden" name="resourceKey" value={resourceKey}/><input type="hidden" name="intent" value={intent}/><input type="hidden" name="languages" value={language}/><BulkSubmit disabled={disabled} count={count} label={label} confirmation={confirmation} icon={Icon}/>
  </form>
}

function BulkSubmit({ disabled, count, label, confirmation,icon:Icon }: { disabled: boolean; count: number; label: string; confirmation: string;icon:typeof Sparkles }) {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={disabled || pending} onClick={(event) => { if (!window.confirm(confirmation)) event.preventDefault() }} className="admin-secondary-button gap-2 px-3 py-2 text-xs disabled:opacity-50"><Icon className="size-4"/>{pending ? 'Procesando…' : `${label} (${count})`}</button>
}

function StateDimensions({ state }: { state: TranslationFieldDetail['state'] }) {
  const technical = state.status === 'missing' ? 'Pendiente' : state.status === 'stale' ? 'Desactualizada' : state.status === 'error' ? 'Error' : state.status === 'queued' ? 'En cola' : 'Traducida'
  const editorial = !state.workflow_status || state.workflow_status === 'none' ? 'Sin borrador' : state.workflow_status === 'draft' ? 'Borrador' : state.workflow_status === 'in_review' ? 'En revisión' : 'Aprobada'
  const publication = state.publication_status === 'published' ? 'Publicada' : 'Sin publicar'
  return <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]" aria-label="Estados del campo">
    <StatePill label="Técnico" value={technical}/><StatePill label="Editorial" value={editorial}/><StatePill label="Web" value={publication}/>
  </div>
}

function StatePill({ label, value }: { label: string; value: string }) {
  return <span className="rounded-full bg-slate-50 px-2.5 py-1 text-slate-700 ring-1 ring-slate-200"><span className="font-semibold">{label}:</span> {value}</span>
}
