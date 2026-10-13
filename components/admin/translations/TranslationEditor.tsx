'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { INITIAL_TRANSLATION_ACTION_STATE, updateTranslationWorkflow } from '@/app/admin/translations/actions'

type Props = {
  stateId: string
  sourceLanguage: string
  targetLanguage: string
  source: string | null
  translated: string | null
  draftValue: unknown
  workflowStatus: string
  publicationStatus: string
  lockVersion: number
  valueKind: string
  maxCharacters: number | null
  canEdit: boolean
  workflowAvailable: boolean
  sourceChanged: boolean
}

export function TranslationEditor(props: Props) {
  const [result, action] = useActionState(updateTranslationWorkflow, INITIAL_TRANSLATION_ACTION_STATE)
  const draft = editorValue(props.draftValue, props.translated)
  if (!props.workflowAvailable) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Aplica primero la migración del Bloque 3E.2 para habilitar el flujo editorial. El inventario continúa disponible en modo lectura.</div>

  return <form action={action} className="space-y-4">
    <input type="hidden" name="stateId" value={props.stateId} />
    <input type="hidden" name="lockVersion" value={props.lockVersion} />
    <div className="grid gap-4 lg:grid-cols-2">
      <EditorBlock label={`Original · ${props.sourceLanguage.toUpperCase()}`} value={props.source ?? 'Sin texto fuente'} readOnly />
      <label><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Borrador · {props.targetLanguage.toUpperCase()}</span><textarea name="translation" defaultValue={draft} rows={props.valueKind === 'rich_text' ? 18 : 10} maxLength={props.valueKind === 'text_array' ? undefined : props.maxCharacters ?? undefined} disabled={!props.canEdit} className="w-full resize-y rounded-xl border border-slate-200 bg-white p-4 font-mono text-sm leading-6 text-slate-900 shadow-inner disabled:bg-slate-100" aria-describedby="translation-help" /></label>
    </div>
    <p id="translation-help" className="text-xs text-slate-500">{props.valueKind === 'text_array' ? 'Un elemento por línea.' : props.maxCharacters ? `Máximo ${props.maxCharacters.toLocaleString('es-CO')} caracteres.` : 'El borrador no sustituye el contenido publicado.'}</p>
    {props.sourceChanged && <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-900">La fuente cambió después de crear el borrador. Guárdalo nuevamente sobre la versión actual antes de revisarlo.</p>}
    {!props.canEdit && <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">Tienes acceso de lectura, pero no permiso de actualización para este módulo.</p>}
    {result.message && <p aria-live="polite" className={`rounded-lg p-3 text-sm ${result.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>{result.message}</p>}
    {props.canEdit && <div className="flex flex-wrap gap-2">
      <ActionButton intent="save_draft" label="Guardar borrador" />
      {props.workflowStatus === 'draft' && <ActionButton intent="submit_review" label="Enviar a revisión" secondary />}
      {props.workflowStatus === 'in_review' && <ActionButton intent="approve" label="Aprobar" secondary />}
      {props.workflowStatus === 'approved' && <ActionButton intent="publish" label="Publicar" confirm="¿Publicar esta traducción en la web pública?" />}
      {props.publicationStatus === 'published' && <ActionButton intent="withdraw" label="Retirar publicación" danger confirm="¿Retirar esta traducción? La web usará el fallback seguro." />}
    </div>}
  </form>
}

function ActionButton({ intent, label, secondary = false, danger = false, confirm }: { intent: string; label: string; secondary?: boolean; danger?: boolean; confirm?: string }) {
  const { pending } = useFormStatus()
  return <button type="submit" name="intent" value={intent} disabled={pending} onClick={(event) => { if (confirm && !window.confirm(confirm)) event.preventDefault() }} className={`${danger ? 'border border-red-200 bg-red-50 text-red-800' : secondary ? 'admin-secondary-button' : 'admin-primary-button'} rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50`}>{pending ? 'Procesando…' : label}</button>
}

function EditorBlock({ label, value, readOnly }: { label: string; value: string; readOnly?: boolean }) {
  return <label><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span><textarea value={value} readOnly={readOnly} rows={18} className="w-full resize-y rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-100" /></label>
}

function editorValue(draft: unknown, published: string | null) {
  if (Array.isArray(draft)) return draft.map(String).join('\n')
  if (typeof draft === 'string') return draft
  return published ?? ''
}
