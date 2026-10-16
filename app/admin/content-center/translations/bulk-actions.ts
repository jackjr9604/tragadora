'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'
import { parseResourceKey } from '@/lib/admin-translation-inventory'
import { TRANSLATION_RESOURCES, type TranslationResourceType } from '@/lib/admin-translation-inventory-policy'
import type { BatchActionState } from '@/lib/admin-translation-batch-policy'

export async function previewTranslationBatch(_previous:BatchActionState,formData:FormData):Promise<BatchActionState>{
  try{
    const prepared=await prepareSelection(formData)
    if(!prepared.selection.length)return fail('No hay campos que coincidan con los recursos, idiomas y campos seleccionados.')
    const limits=queueLimits(),session=await createClient()
    const result=await session.rpc('translation_admin_bulk_preview',{p_selection:prepared.selection,p_page:1,p_page_size:100,p_daily_request_limit:limits.dailyRequestLimit,p_daily_character_limit:limits.dailyCharacterLimit})
    if(result.error)return fail(friendlyError(result.error.code,result.error.message))
    const preview=result.data as BatchActionState['preview']
    return {ok:true,stage:'preview',message:`Previsualización lista: ${preview?.eligible_count??0} campos elegibles.`,selection:prepared.selection,preview}
  }catch(error){return fail(error instanceof Error?error.message:'No se pudo preparar la previsualización.')}
}

export async function createAndEnqueueTranslationBatch(_previous:BatchActionState,formData:FormData):Promise<BatchActionState>{
  try{
    if(process.env.TRANSLATION_LOCAL_QUEUE_ENABLED!=='true')return fail('La cola local está desactivada en este entorno.')
    const selection=parseSelection(String(formData.get('selection')??'')),idempotency=String(formData.get('idempotencyKey')??'')
    if(!uuid(idempotency)||!selection.length||selection.length>100)return fail('La confirmación del lote no es válida. Vuelve a previsualizar.')
    await authorizeSelection(selection)
    const limits=queueLimits(),session=await createClient()
    const created=await session.rpc('translation_admin_create_batch',{p_idempotency_key:idempotency,p_selection:selection,p_daily_request_limit:limits.dailyRequestLimit,p_daily_character_limit:limits.dailyCharacterLimit})
    if(created.error||typeof created.data!=='string')return fail(friendlyError(created.error?.code,created.error?.message??''))
    const detail=await session.rpc('translation_admin_batch_detail',{p_batch_id:created.data,p_item_status:null,p_page:1,p_page_size:25})
    const lock=Number((detail.data as {batch?:{lock_version?:number}}|null)?.batch?.lock_version)
    if(detail.error||!Number.isInteger(lock))return {ok:true,stage:'created',message:'Lote creado. Abre el detalle para continuar el encolado.',batchId:created.data}
    const enqueue=await session.rpc('translation_admin_enqueue_batch',{p_batch_id:created.data,p_expected_lock_version:lock,p_limit:50,p_max_attempts:limits.maxAttempts,p_daily_request_limit:limits.dailyRequestLimit,p_daily_character_limit:limits.dailyCharacterLimit})
    if(enqueue.error)return {ok:true,stage:'created',message:'Lote creado; el primer tramo no pudo encolarse y puede reanudarse desde su detalle.',batchId:created.data}
    revalidatePath('/admin/content-center/translations/batches')
    return {ok:true,stage:'created',message:'Lote creado y primer tramo procesado de forma segura.',batchId:created.data}
  }catch(error){return fail(error instanceof Error?error.message:'No se pudo crear el lote.')}
}

export async function resumeTranslationBatch(_previous:BatchActionState,formData:FormData):Promise<BatchActionState>{
  const batchId=String(formData.get('batchId')??''),lock=Number(formData.get('lockVersion'))
  if(!uuid(batchId)||!Number.isInteger(lock))return fail('El lote cambió o la solicitud no es válida.')
  const limits=queueLimits(),session=await createClient()
  const result=await session.rpc('translation_admin_enqueue_batch',{p_batch_id:batchId,p_expected_lock_version:lock,p_limit:50,p_max_attempts:limits.maxAttempts,p_daily_request_limit:limits.dailyRequestLimit,p_daily_character_limit:limits.dailyCharacterLimit})
  if(result.error)return fail(friendlyError(result.error.code,result.error.message))
  revalidatePath(`/admin/content-center/translations/batches/${batchId}`);revalidatePath('/admin/content-center/translations/batches')
  return {ok:true,stage:'created',message:'Se procesó el siguiente tramo pendiente.',batchId}
}

async function prepareSelection(formData:FormData){
  const resources=parseStrings(formData.get('resources'),25),languages=parseStrings(formData.get('languages'),10),fields=parseStrings(formData.get('fields'),100)
  if(!resources.length||!languages.length)throw new Error('Selecciona al menos un recurso y un idioma compatible.')
  const access=await getCurrentAdminPermissions();if(!access.userId)throw new Error('La sesión expiró.')
  const grouped=new Map<TranslationResourceType,string[]>()
  for(const key of resources){const parsed=parseResourceKey(key);if(!parsed)throw new Error('La selección contiene un recurso inválido.');const policy=TRANSLATION_RESOURCES[parsed.resourceType];if(!access.permissions.has(policy.updatePermission))throw new Error('No tienes permiso para traducir uno de los recursos seleccionados.');grouped.set(parsed.resourceType,[...(grouped.get(parsed.resourceType)??[]),parsed.resourceId])}
  const session=await createClient(),rows:Array<{id:string;lock_version:number;field_name:string;target_language:string}>=[]
  for(const [type,ids] of grouped){let query=session.from('translation_field_state').select('id,lock_version,field_name,target_language').eq('resource_type',type).in('resource_id',ids).in('target_language',languages);if(fields.length)query=query.in('field_name',fields);const result=await query;if(result.error)throw new Error('No se pudieron validar los campos seleccionados.');rows.push(...(result.data??[]))}
  if(rows.length>100)throw new Error('La selección supera el límite seguro de 100 campos. Reduce recursos, idiomas o campos.')
  const selection=rows.map(row=>({state_id:row.id,expected_lock_version:row.lock_version}))
  return {selection}
}
async function authorizeSelection(selection:{state_id:string;expected_lock_version:number}[]){const access=await getCurrentAdminPermissions();if(!access.userId)throw new Error('La sesión expiró.');const result=await (await createClient()).from('translation_field_state').select('id,resource_type').in('id',selection.map(item=>item.state_id));if(result.error||result.data?.length!==selection.length)throw new Error('La selección cambió; vuelve a previsualizar.');for(const row of result.data){const policy=TRANSLATION_RESOURCES[row.resource_type as TranslationResourceType];if(!policy||!access.permissions.has(policy.updatePermission))throw new Error('No tienes permiso para crear este lote.')}}
function parseSelection(value:string){try{const parsed=JSON.parse(value);if(!Array.isArray(parsed))return [];return parsed.filter(item=>uuid(item?.state_id)&&Number.isInteger(item?.expected_lock_version)&&item.expected_lock_version>0).slice(0,100)}catch{return []}}
function parseStrings(value:FormDataEntryValue|null,max:number){try{const parsed=JSON.parse(String(value??'[]'));return Array.isArray(parsed)?[...new Set(parsed.filter(item=>typeof item==='string'&&item.length>0&&item.length<200))].slice(0,max):[]}catch{return []}}
function queueLimits(){return{maxAttempts:env('TRANSLATION_LOCAL_MAX_ATTEMPTS',3,1,5),dailyRequestLimit:env('TRANSLATION_LOCAL_MAX_DAILY_REQUESTS',20,1,100),dailyCharacterLimit:env('TRANSLATION_LOCAL_MAX_DAILY_INPUT_CHARACTERS',100000,100,1000000)}}
function env(name:string,fallback:number,min:number,max:number){const value=Number.parseInt(process.env[name]??'',10);return Number.isInteger(value)?Math.min(max,Math.max(min,value)):fallback}
function friendlyError(code:string|undefined,message:string){if(code==='40001'||/cambi|concurr/i.test(message))return'El lote o sus campos cambiaron. Recarga y vuelve a previsualizar.';if(code==='42501'||/forbidden|permiso/i.test(message))return'No tienes permiso para procesar uno de los recursos.';if(/cuota|límite/i.test(message))return'Se alcanzó la cuota local configurada; los elementos pendientes se conservaron.';return'No se pudo completar la operación de forma segura.'}
function fail(message:string):BatchActionState{return{ok:false,stage:'idle',message}}
function uuid(value:string){return/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)}
