'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'
import { getTranslationDetail } from '@/lib/admin-translation-inventory'
import { requestIndividualAiDraft } from '@/lib/admin-translation-ai'
import { isNonTranslatableExactField } from '@/lib/admin-translation-exact-group-policy'

export type ExactGroupActionState={ok:boolean;message:string;jobId?:string;applied?:number;skipped?:number;conflicts?:number}

export async function requestExactGroupProposal(_previous:ExactGroupActionState,formData:FormData):Promise<ExactGroupActionState>{
  const stateId=String(formData.get('stateId')??''),expectedLockVersion=Number(formData.get('lockVersion'))
  if(!uuid(stateId)||!Number.isInteger(expectedLockVersion)||expectedLockVersion<1)return fail('La propuesta cambió; recarga el grupo.')
  const access=await getCurrentAdminPermissions();if(!access.userId)return fail('La sesión expiró.')
  const detail=await getTranslationDetail(stateId,access.permissions)
  if(!detail||!detail.canEdit)return fail('No existe el campo o no tienes permiso para traducirlo.')
  if(isNonTranslatableExactField(detail.state.field_name))return fail('Los identificadores, códigos y marcas no se traducen automáticamente.')
  try{
    const result=await requestIndividualAiDraft({stateId,expectedLockVersion,sourceValue:detail.sourceValue})
    revalidatePath('/admin/content-center/translations/groups','layout')
    return{ok:true,message:result.reused?'Se reutilizó el trabajo activo de esta propuesta exacta.':'La propuesta exacta quedó en cola para LibreTranslate local.',jobId:result.jobId}
  }catch(error){return fail(friendly(error))}
}

export async function applyExactGroupProposal(_previous:ExactGroupActionState,formData:FormData):Promise<ExactGroupActionState>{
  const proposalStateId=String(formData.get('proposalStateId')??''),proposalLockVersion=Number(formData.get('proposalLockVersion'))
  if(formData.get('confirmed')!=='yes'||!uuid(proposalStateId)||!Number.isInteger(proposalLockVersion))return fail('Confirma la aplicación de la propuesta.')
  const selection=parseSelection(String(formData.get('selection')??''));if(!selection.length)return fail('Selecciona al menos un registro elegible.')
  const access=await getCurrentAdminPermissions();if(!access.userId)return fail('La sesión expiró.')
  const proposal=await getTranslationDetail(proposalStateId,access.permissions);if(!proposal||!proposal.canEdit)return fail('La propuesta no está disponible o no tienes permiso.')
  const result=await (await createClient()).rpc('translation_admin_apply_exact_group_proposal',{p_proposal_state_id:proposalStateId,p_expected_proposal_lock_version:proposalLockVersion,p_selection:selection})
  if(result.error)return fail(friendly(result.error))
  const payload=result.data as {applied?:number;skipped?:number;conflicts?:number}
  revalidatePath('/admin/content-center/translations/groups','layout');revalidatePath('/admin/content-center/translations');revalidatePath('/admin/content-center/review')
  return{ok:true,message:`${payload.applied??0} borradores creados, ${payload.skipped??0} omitidos y ${payload.conflicts??0} en conflicto.`,applied:payload.applied??0,skipped:payload.skipped??0,conflicts:payload.conflicts??0}
}

function parseSelection(value:string){try{const parsed=JSON.parse(value);if(!Array.isArray(parsed)||parsed.length>100)return[];const seen=new Set<string>();return parsed.flatMap((item)=>{const id=String(item?.state_id??''),lock=Number(item?.expected_lock_version);if(!uuid(id)||!Number.isInteger(lock)||lock<1||seen.has(id))return[];seen.add(id);return[{state_id:id,expected_lock_version:lock}]})}catch{return[]}}
function friendly(error:unknown){const message=typeof error==='object'&&error&&'message'in error?String(error.message):'';if(/cola.*desactivada/i.test(message))return'La cola local está desactivada; no se inventó ninguna propuesta.';if(/cambi|concurr|obsolet|version/i.test(message))return'El grupo cambió mientras trabajabas. Recarga y vuelve a validar la selección.';if(/proteg|publicad|permiso|forbidden/i.test(message))return'La propuesta contiene contenido protegido, publicado o sin permiso.';return'No fue posible completar la operación de forma segura.'}
function fail(message:string):ExactGroupActionState{return{ok:false,message}}
function uuid(value:string){return/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)}
