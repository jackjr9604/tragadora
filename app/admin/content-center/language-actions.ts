'use server'

import { revalidatePath,revalidateTag,updateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'
import { LANGUAGE_PUBLICATION_STATUSES,normalizeLanguageCode } from '@/lib/admin-language-policy'
import { invalidateAllPublicTranslationResources } from '@/lib/admin-public-translation-revalidation'

export type LanguageActionState={ok:boolean;message:string}
export const INITIAL_LANGUAGE_ACTION_STATE:LanguageActionState={ok:false,message:''}

export async function manageLanguage(_previous:LanguageActionState,formData:FormData):Promise<LanguageActionState>{
  const intent=String(formData.get('intent')??'')
  const permission=intent==='create'?'content.create':intent==='delete'?'content.delete':'content.update'
  const access=await getCurrentAdminPermissions()
  if(!access.userId)return fail('La sesión expiró. Vuelve a iniciar sesión.')
  if(!access.permissions.has(permission))return fail('No tienes permiso para realizar esta operación.')
  const db=createAdminClient()
  let result:{error:{message:string}|null}
  if(intent==='create'){
    const code=normalizeLanguageCode(formData.get('code'))
    if(!code)return fail('El código de idioma no es válido.')
    result=await db.rpc('translation_admin_create_language',{p_code:code,p_name:String(formData.get('name')??''),p_native_name:String(formData.get('nativeName')??''),p_sort_order:number(formData.get('sortOrder'),100),p_actor:access.userId})
  }else{
    const code=normalizeLanguageCode(formData.get('code')),version=number(formData.get('lockVersion'),0)
    if(!code||version<1)return fail('El idioma cambió o la solicitud no es válida. Recarga la página.')
    if(intent==='update')result=await db.rpc('translation_admin_update_language',{p_code:code,p_expected_lock_version:version,p_name:String(formData.get('name')??''),p_native_name:String(formData.get('nativeName')??''),p_sort_order:number(formData.get('sortOrder'),100),p_auto_translate:formData.get('autoTranslate')==='on',p_seo_ready:formData.get('seoReady')==='on',p_actor:access.userId})
    else if(intent==='state'){
      const status=String(formData.get('publicationStatus')??'')
      if(!LANGUAGE_PUBLICATION_STATUSES.includes(status as never))return fail('Estado editorial inválido.')
      result=await db.rpc('translation_admin_set_language_state',{p_code:code,p_expected_lock_version:version,p_is_active:formData.get('isActive')==='on',p_publication_status:status,p_confirm_withdraw:formData.get('confirmWithdraw')==='yes',p_actor:access.userId})
    }else if(intent==='delete')result=await db.rpc('translation_admin_delete_language',{p_code:code,p_expected_lock_version:version,p_actor:access.userId})
    else return fail('Operación desconocida.')
  }
  if(result.error)return fail(friendly(result.error.message))
  revalidatePath('/admin/content-center');revalidatePath('/admin/content-center/languages');revalidatePath('/admin/content');revalidatePath('/admin/translations')
  try{updateTag('public-languages');invalidateAllPublicTranslationResources();revalidateTag('public-site-content','max')}
  catch{return fail('El idioma se actualizó, pero no fue posible renovar la caché pública. No repitas la operación; recarga y verifica el estado.')}
  return {ok:true,message:intent==='create'?'Idioma registrado como borrador.':intent==='delete'?'Idioma eliminado.':'Idioma actualizado correctamente.'}
}

function number(value:FormDataEntryValue|null,fallback:number){const parsed=Number(value);return Number.isInteger(parsed)?parsed:fallback}
function fail(message:string):LanguageActionState{return{ok:false,message}}
function friendly(message:string){if(/otra sesión|lock/i.test(message))return'El idioma cambió en otra sesión. Recarga antes de guardar.';return message}
