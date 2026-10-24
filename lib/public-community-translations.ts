import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveCommunityTranslations,type CommunitySource,type CommunityTranslationRow } from './public-community-translation-policy'
import type { TranslationFieldState } from './public-platform-translation-policy'
import { getPublicTranslationStates } from './public-translation-states'
import { getPublicTranslationLanguageContext } from './public-translation-languages'
import { createPublicTranslationCache,type PublicTranslationStateRow } from './public-translation-cache'

const getCachedCommunityTranslationRows=createPublicTranslationCache<CommunityTranslationRow>({
  async loadTranslations(scope){const result=await createAdminClient().from('community_translations').select('community_id,language,short_description,category_label,region_label,badge').in('community_id',[...scope.resourceIds]).eq('language',scope.effectiveLanguage);if(result.error)throw result.error;return(result.data??[]) as CommunityTranslationRow[]},
  async loadStates(scope){const result=await getPublicTranslationStates({resourceTypes:['community_translation'],resourceIds:[...scope.resourceIds],targetLanguages:[scope.effectiveLanguage]});if(result.error)throw result.error;return(result.data??[]) as PublicTranslationStateRow[]},
})

export async function getPublicCommunityTranslations(communities:CommunitySource[],requestedLanguage:string){
  if(!communities.length)return new Map()
  const { languages, defaultLanguage }=await getPublicTranslationLanguageContext()
  const effectiveLanguage=languages.find((item)=>item.code===requestedLanguage)?.code??defaultLanguage
  if(effectiveLanguage===defaultLanguage)return new Map()
  const ids=communities.map((item)=>item.id)
  try{const rows=await getCachedCommunityTranslationRows({resourceType:'community_translation',resourceIds:ids,effectiveLanguage,defaultLanguage});return resolveCommunityTranslations({communities,requestedLanguage,defaultLanguage,languages,translations:[...rows.translations],states:[...rows.states] as TranslationFieldState[]})}catch{return new Map()}
}
