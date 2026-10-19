'use client'

import { useEffect, useState } from 'react'
import type { BulkOperationReportItem, BulkOperationSummary } from '@/lib/admin-translation-operation-report'

type StoredReport = { summary: BulkOperationSummary; items: BulkOperationReportItem[]; savedAt: string }

export function TranslationOperationReport({ storageKey, summary, items }: { storageKey: string; summary: BulkOperationSummary; items: BulkOperationReportItem[] }) {
  const [stored, setStored] = useState<StoredReport | null>(null)
  const { selected, succeeded, skipped, conflicts, errors, complete } = summary
  useEffect(() => {
    if (selected > 0) {
      const next = { summary: { selected, succeeded, skipped, conflicts, errors, complete }, items, savedAt: new Date().toISOString() }
      sessionStorage.setItem(storageKey, JSON.stringify(next))
    }
  }, [items, storageKey, selected, succeeded, skipped, conflicts, errors, complete])
  useEffect(() => {
    if (selected === 0) queueMicrotask(() => setStored(readStored(storageKey)))
  }, [selected, storageKey])

  const report = summary.selected > 0 ? { summary, items, savedAt: null } : stored
  if (!report) return null
  const partial = !report.summary.complete
  return <section aria-live="polite" className={`rounded-2xl border p-4 ${partial ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start"><div><strong>{partial ? 'Operación completada con resultados parciales' : 'Operación completada'}</strong><p className="mt-1 text-xs text-slate-600">{report.savedAt ? 'Último resultado conservado en esta sesión de administración.' : 'Resultado de la operación actual.'}</p></div>{report.savedAt&&<time className="text-xs text-slate-500" dateTime={report.savedAt}>{new Date(report.savedAt).toLocaleString('es-CO')}</time>}</div>
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5"><Metric label="Seleccionados" value={report.summary.selected}/><Metric label="Correctos" value={report.summary.succeeded}/><Metric label="Omitidos" value={report.summary.skipped}/><Metric label="Conflictos" value={report.summary.conflicts}/><Metric label="Errores" value={report.summary.errors}/></div>
    {report.items.length>0&&<ul className="mt-4 max-h-72 space-y-2 overflow-y-auto text-xs">{report.items.map((item,index)=><li key={`${item.stateId}-${index}`} className="grid gap-1 rounded-lg bg-white/80 p-2 sm:grid-cols-[minmax(0,1fr)_auto]"><span className="min-w-0 break-words"><span className="font-mono">{item.fieldName||item.stateId}{item.language?` · ${item.language.toUpperCase()}`:''}</span><span className="ml-2">{item.message}</span></span><span className={tone(item.category)}>{label(item.category)}</span></li>)}</ul>}
  </section>
}

function readStored(storageKey:string) {
  if (typeof window === 'undefined') return null
  try { const parsed=JSON.parse(sessionStorage.getItem(storageKey)??'null') as StoredReport|null;return parsed?.summary&&Array.isArray(parsed.items)?parsed:null }
  catch { sessionStorage.removeItem(storageKey);return null }
}

function Metric({label,value}:{label:string;value:number}) { return <div className="rounded-lg bg-white/80 p-2"><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span><strong className="text-lg">{value}</strong></div> }
function label(category:BulkOperationReportItem['category']) { return ({success:'Correcto',skipped:'Omitido',conflict:'Conflicto',error:'Error'} as const)[category] }
function tone(category:BulkOperationReportItem['category']) { return `w-fit rounded-full px-2 py-1 font-semibold ${category==='success'?'bg-emerald-100 text-emerald-800':category==='error'?'bg-red-100 text-red-800':category==='conflict'?'bg-amber-100 text-amber-900':'bg-slate-100 text-slate-700'}` }
