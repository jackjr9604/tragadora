import 'server-only'
import { createClient } from '@/lib/supabase/server'

export async function getCompatibleBatchLanguages(){
  const result=await (await createClient()).from('languages').select('code,native_name').eq('is_active',true).eq('auto_translate',true).eq('libretranslate_status','supported').eq('is_default',false).order('sort_order')
  if(result.error)throw new Error(result.error.message)
  return result.data??[]
}

export async function getBatchFieldOptions(resourceTypes:string[]){
  if(!resourceTypes.length)return[]
  const result=await (await createClient()).from('translation_resource_fields').select('resource_type,field_name').in('resource_type',resourceTypes).eq('enabled',true).order('field_name')
  if(result.error)throw new Error(result.error.message)
  return result.data??[]
}

export async function getTranslationBatches(filters:{status?:string;page:number;pageSize:number}){
  const result=await (await createClient()).rpc('translation_admin_batches_inventory',{p_status:filters.status??null,p_page:filters.page,p_page_size:filters.pageSize})
  if(result.error)throw new Error(result.error.message)
  return result.data as {total:number;page:number;page_size:number;pages:number;items:Array<Record<string,unknown>>}
}

export async function getTranslationBatchDetail(batchId:string,status:string|undefined,page:number,pageSize:number){
  const result=await (await createClient()).rpc('translation_admin_batch_detail',{p_batch_id:batchId,p_item_status:status??null,p_page:page,p_page_size:pageSize})
  if(result.error)return null
  return result.data as {batch:Record<string,unknown>;total:number;page:number;page_size:number;pages:number;items:Array<Record<string,unknown>>}
}

export function normalizeBatchPage(value:string|string[]|undefined){const raw=Array.isArray(value)?value[0]:value,n=Number(raw);return Number.isInteger(n)&&n>0?n:1}
export function normalizeBatchPageSize(value:string|string[]|undefined){const raw=Array.isArray(value)?value[0]:value,n=Number(raw);return [25,50,100].includes(n)?n:25}
export function normalizeBatchStatus(value:string|string[]|undefined,item=false){const raw=Array.isArray(value)?value[0]:value;const allowed=item?['pending','reusable','excluded','queued','running','succeeded','failed','skipped','cancelled']:['prepared','partially_queued','queued','processing','completed','partial','failed','cancelled'];return raw&&allowed.includes(raw)?raw:undefined}
