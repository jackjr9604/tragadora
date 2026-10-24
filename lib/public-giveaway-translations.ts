import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveGiveawayTranslations,type GiveawaySource,type GiveawayTranslationRow } from './public-giveaway-translation-policy'
import type { TranslationFieldState } from './public-platform-translation-policy'
import { getPublicTranslationStates } from './public-translation-states'
import { getPublicTranslationLanguageContext } from './public-translation-languages'
import { createPublicTranslationCache,type PublicTranslationStateRow } from './public-translation-cache'

const getCachedGiveawayTranslationRows=createPublicTranslationCache<GiveawayTranslationRow>({
  async loadTranslations(scope){const result=await createAdminClient().from('giveaway_translations').select('giveaway_id,language,title,short_description,prize_title,prize_description,badge,reveal_title,reveal_content').in('giveaway_id',[...scope.resourceIds]).eq('language',scope.effectiveLanguage);if(result.error)throw result.error;return(result.data??[]) as GiveawayTranslationRow[]},
  async loadStates(scope){const result=await getPublicTranslationStates({resourceTypes:['giveaway_translation'],resourceIds:[...scope.resourceIds],targetLanguages:[scope.effectiveLanguage]});if(result.error)throw result.error;return(result.data??[]) as PublicTranslationStateRow[]},
})

export async function getPublicGiveawayTranslations(giveaways:GiveawaySource[],requestedLanguage:string){
  if(!giveaways.length)return new Map()
  const { languages, defaultLanguage }=await getPublicTranslationLanguageContext()
  const effectiveLanguage=languages.find((item)=>item.code===requestedLanguage)?.code??defaultLanguage
  if(effectiveLanguage===defaultLanguage)return new Map()
  const ids=giveaways.map((item)=>item.id)
  try{const rows=await getCachedGiveawayTranslationRows({resourceType:'giveaway_translation',resourceIds:ids,effectiveLanguage,defaultLanguage});return resolveGiveawayTranslations({giveaways,requestedLanguage,defaultLanguage,languages,translations:[...rows.translations],states:[...rows.states] as TranslationFieldState[]})}catch{return new Map()}
}
