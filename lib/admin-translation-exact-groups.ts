import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import type { PermissionKey } from '@/lib/admin-permissions'
import { allowedTranslationResources, TRANSLATION_RESOURCES, type TranslationResourceType } from '@/lib/admin-translation-inventory-policy'

export type ExactGroupFilters = { page:number;pageSize:number;resourceType?:string;fieldName?:string;language?:string;status:string;query?:string }
export type ExactTranslationGroup = {
  resource_type:TranslationResourceType;field_name:string;source_hash:string;source_language:string;target_language:string;source_value:unknown
  resource_count:number;eligible_count:number;draft_count:number;review_count:number;approved_count:number;published_count:number
  protected_count:number;stale_count:number;error_count:number;active_job_count:number;failed_job_count:number
  representative_state_id:string;representative_lock_version:number;sensitivity:'editorial_general'|'commercial_sensitive'|'identifier_or_brand';total_count:number
}
export type ExactGroupMember = {state_id:string;resource_id:string;status:string;workflow_status:string;publication_status:string;is_protected:boolean;source_revision:number;lock_version:number;draft_value:unknown;translation_method:string|null;job_status:string|null;proposal_state_id:string|null;proposal_lock_version:number|null;proposal_draft_value:unknown;total_count:number}

export function normalizeExactGroupFilters(input:Record<string,string|string[]|undefined>):ExactGroupFilters{
  const one=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value
  const page=Number(one(input.page)),pageSize=Number(one(input.pageSize)),status=one(input.status)??'pending'
  return {page:Number.isInteger(page)&&page>0?page:1,pageSize:[25,50,100].includes(pageSize)?pageSize:25,
    resourceType:clean(one(input.module),80),fieldName:clean(one(input.field),100),language:clean(one(input.language),20),
    status:['pending','draft','in_review','approved','published','stale','error','all'].includes(status)?status:'pending',query:clean(one(input.q),100)}
}

export async function getExactTranslationGroups(filters:ExactGroupFilters,permissions:ReadonlySet<PermissionKey>){
  const allowed=allowedTranslationResources(permissions)
  if(!allowed.length||filters.resourceType&&!allowed.includes(filters.resourceType as TranslationResourceType))return{rows:[] as ExactTranslationGroup[],total:0,pages:0,languages:[],resources:allowed}
  const db=createAdminClient()
  const [groups,languages]=await Promise.all([
    db.rpc('translation_admin_exact_group_inventory',{p_allowed_resource_types:allowed,p_resource_type:filters.resourceType??null,p_field_name:filters.fieldName??null,p_target_language:filters.language??null,p_status:filters.status,p_query:filters.query??null,p_page:filters.page,p_page_size:filters.pageSize}),
    db.from('languages').select('code,native_name').eq('is_active',true).order('sort_order'),
  ])
  if(groups.error){if(groups.error.code==='PGRST202'||groups.error.code==='42883')return{rows:[] as ExactTranslationGroup[],total:0,pages:0,languages:languages.data??[],resources:allowed,rpcAvailable:false};throw new Error(groups.error.message)}
  if(languages.error)throw new Error(languages.error.message)
  const rows=(groups.data??[]) as unknown as ExactTranslationGroup[],total=Number(rows[0]?.total_count??0)
  return{rows,total,pages:Math.ceil(total/filters.pageSize),languages:languages.data??[],resources:allowed,rpcAvailable:true}
}

export async function getExactTranslationGroupMembers(identity:{resourceType:TranslationResourceType;fieldName:string;sourceHash:string;targetLanguage:string},page:number,pageSize:number,permissions:ReadonlySet<PermissionKey>){
  const allowed=allowedTranslationResources(permissions)
  if(!allowed.includes(identity.resourceType))return{rows:[] as ExactGroupMember[],total:0,pages:0}
  const result=await createAdminClient().rpc('translation_admin_exact_group_members',{p_allowed_resource_types:allowed,p_resource_type:identity.resourceType,p_field_name:identity.fieldName,p_source_hash:identity.sourceHash,p_target_language:identity.targetLanguage,p_page:page,p_page_size:pageSize})
  if(result.error)throw new Error(result.error.message)
  const rows=(result.data??[]) as unknown as ExactGroupMember[],total=Number(rows[0]?.total_count??0)
  return{rows,total,pages:Math.ceil(total/pageSize)}
}

export function exactGroupHref(group:Pick<ExactTranslationGroup,'resource_type'|'field_name'|'source_hash'|'target_language'>){return`/admin/content-center/translations/groups/${group.resource_type}/${encodeURIComponent(group.field_name)}/${group.source_hash}/${encodeURIComponent(group.target_language)}`}
export function sensitivityLabel(value:ExactTranslationGroup['sensitivity']){return value==='commercial_sensitive'?'Contenido comercial sensible':value==='identifier_or_brand'?'Identificador o marca':'Contenido editorial general'}
export function resourceLabel(value:TranslationResourceType){return TRANSLATION_RESOURCES[value].label}
function clean(value:string|undefined,max:number){const normalized=value?.trim().slice(0,max);return normalized||undefined}
