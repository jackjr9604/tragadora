import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveCommunityTranslations,type CommunitySource,type CommunityTranslationRow } from './public-community-translation-policy'
import type { TranslationFieldState,TranslationLanguage } from './public-platform-translation-policy'

export async function getPublicCommunityTranslations(communities:CommunitySource[],requestedLanguage:string){
  if(!communities.length)return new Map()
  const db=createAdminClient()
  const languagesResult=await db.from('languages').select('code,is_active,is_default,publication_status').eq('is_active',true)
  if(languagesResult.error)return new Map()
  const languages=(languagesResult.data??[]) as TranslationLanguage[]
  const defaultLanguage=languages.find((item)=>item.is_default)?.code??'es'
  const effectiveLanguage=languages.find((item)=>item.code===requestedLanguage&&item.is_active&&item.publication_status==='published')?.code??defaultLanguage
  if(effectiveLanguage===defaultLanguage)return new Map()
  const ids=communities.map((item)=>item.id)
  const [translationsResult,statesResult]=await Promise.all([
    db.from('community_translations').select('community_id,language,short_description,category_label,region_label,badge').in('community_id',ids).eq('language',effectiveLanguage),
    db.from('translation_field_state').select('resource_type,resource_id,field_name,target_language,source_hash,translated_source_hash,source_revision,translated_revision,status,is_protected').eq('resource_type','community_translation').in('resource_id',ids).eq('target_language',effectiveLanguage),
  ])
  // Compatibilidad previa a 3D.3: conserva íntegramente el contenido fuente.
  if(translationsResult.error||statesResult.error)return new Map()
  return resolveCommunityTranslations({communities,requestedLanguage,defaultLanguage,languages,translations:(translationsResult.data??[]) as CommunityTranslationRow[],states:(statesResult.data??[]) as TranslationFieldState[]})
}
