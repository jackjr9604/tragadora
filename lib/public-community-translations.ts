import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveCommunityTranslations,type CommunitySource,type CommunityTranslationRow } from './public-community-translation-policy'
import type { TranslationFieldState } from './public-platform-translation-policy'
import { getPublicTranslationStates } from './public-translation-states'
import { getPublicTranslationLanguageContext } from './public-translation-languages'

export async function getPublicCommunityTranslations(communities:CommunitySource[],requestedLanguage:string){
  if(!communities.length)return new Map()
  const db=createAdminClient()
  const { languages, defaultLanguage }=await getPublicTranslationLanguageContext()
  const effectiveLanguage=languages.find((item)=>item.code===requestedLanguage)?.code??defaultLanguage
  if(effectiveLanguage===defaultLanguage)return new Map()
  const ids=communities.map((item)=>item.id)
  const [translationsResult,statesResult]=await Promise.all([
    db.from('community_translations').select('community_id,language,short_description,category_label,region_label,badge').in('community_id',ids).eq('language',effectiveLanguage),
    getPublicTranslationStates({resourceTypes:['community_translation'],resourceIds:ids,targetLanguages:[effectiveLanguage]}),
  ])
  // Compatibilidad previa a 3D.3: conserva íntegramente el contenido fuente.
  if(translationsResult.error||statesResult.error)return new Map()
  return resolveCommunityTranslations({communities,requestedLanguage,defaultLanguage,languages,translations:(translationsResult.data??[]) as CommunityTranslationRow[],states:(statesResult.data??[]) as TranslationFieldState[]})
}
