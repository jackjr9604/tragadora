'use client'

import { useActionState, useMemo, useState } from 'react'
import { applyExactGroupProposal, requestExactGroupProposal, type ExactGroupActionState } from '@/app/admin/content-center/translations/groups/actions'
import type { ExactGroupMember } from '@/lib/admin-translation-exact-groups'

const EMPTY_EXACT_GROUP_ACTION_STATE:ExactGroupActionState={ok:false,message:''}

export function TranslationExactGroupActions({members,proposalStateId,proposalLockVersion,representativeStateId,representativeLockVersion}:{members:ExactGroupMember[];proposalStateId?:string;proposalLockVersion?:number;representativeStateId:string;representativeLockVersion:number}){
  const[request,requestAction,requestPending]=useActionState(requestExactGroupProposal,EMPTY_EXACT_GROUP_ACTION_STATE)
  const[apply,applyAction,applyPending]=useActionState(applyExactGroupProposal,EMPTY_EXACT_GROUP_ACTION_STATE)
  const eligible=useMemo(()=>members.filter((member)=>!member.is_protected&&member.publication_status!=='published'&&member.workflow_status==='none'&&['missing','error','stale'].includes(member.status)),[members])
  const[selected,setSelected]=useState(()=>new Set(eligible.map((member)=>member.state_id)))
  const selection=members.filter((member)=>selected.has(member.state_id)).map((member)=>({state_id:member.state_id,expected_lock_version:member.lock_version}))
  function toggle(id:string,checked:boolean){setSelected((current)=>{const next=new Set(current);if(checked)next.add(id);else next.delete(id);return next})}
  return <div className="space-y-5">
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <h2 className="font-bold text-amber-950">Propuesta común exacta</h2>
      <p className="mt-1 text-sm text-amber-900">LibreTranslate procesa un solo representante. Después, la propuesta se revalida y copia como borrador individual únicamente a los registros elegibles seleccionados.</p>
      {!proposalStateId?<form action={requestAction} className="mt-3"><input type="hidden" name="stateId" value={representativeStateId}/><input type="hidden" name="lockVersion" value={representativeLockVersion}/><button disabled={requestPending} className="admin-primary-button px-4 py-2 text-sm disabled:opacity-50">{requestPending?'Solicitando…':'Generar una propuesta con LibreTranslate'}</button></form>:<p className="mt-3 rounded-lg bg-white p-3 text-sm text-emerald-800">La propuesta automática está lista. Revísala antes de aplicarla.</p>}
      {request.message&&<p aria-live="polite" className={`mt-3 text-sm ${request.ok?'text-emerald-800':'text-red-700'}`}>{request.message}</p>}
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4"><div><h2 className="font-bold">Registros del grupo</h2><p className="text-sm text-slate-500">Seleccionados {selection.length} de {eligible.length} elegibles en esta página.</p></div><button type="button" className="admin-secondary-button px-3 py-2 text-sm" onClick={()=>setSelected(new Set(eligible.map((member)=>member.state_id)))}>Seleccionar elegibles</button></div>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Elegir</th><th className="p-3">Recurso</th><th className="p-3">Estado</th><th className="p-3">Workflow</th><th className="p-3">Protección</th><th className="p-3">Job</th></tr></thead><tbody>{members.map((member)=>{const canSelect=eligible.some((item)=>item.state_id===member.state_id);return <tr key={member.state_id} className="border-t border-slate-100"><td className="p-3"><input type="checkbox" aria-label={`Seleccionar ${member.resource_id}`} checked={selected.has(member.state_id)} disabled={!canSelect} onChange={(event)=>toggle(member.state_id,event.target.checked)}/></td><td className="max-w-64 truncate p-3 font-mono text-xs" title={member.resource_id}>{member.resource_id}</td><td className="p-3">{member.status}</td><td className="p-3">{member.workflow_status}</td><td className="p-3">{member.is_protected?'Protegido':member.publication_status==='published'?'Publicado':'Editable'}</td><td className="p-3">{member.job_status??'—'}</td></tr>})}</tbody></table></div>
    </section>
    {proposalStateId&&proposalLockVersion&&<form action={applyAction} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><input type="hidden" name="proposalStateId" value={proposalStateId}/><input type="hidden" name="proposalLockVersion" value={proposalLockVersion}/><input type="hidden" name="selection" value={JSON.stringify(selection)}/><label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmed" value="yes" required className="mt-1"/><span>Confirmo que revisé la propuesta común. Crear borradores no los aprueba ni los publica.</span></label><button disabled={applyPending||!selection.length} className="admin-primary-button mt-3 px-4 py-2 text-sm disabled:opacity-50">{applyPending?'Aplicando…':`Aplicar a ${selection.length} registros elegibles`}</button>{apply.message&&<p aria-live="polite" className={`mt-3 text-sm ${apply.ok?'text-emerald-800':'text-red-700'}`}>{apply.message}</p>}</form>}
  </div>
}
