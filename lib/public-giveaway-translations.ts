import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveGiveawayTranslations,type GiveawaySource,type GiveawayTranslationRow } from './public-giveaway-translation-policy'
import type { TranslationFieldState,TranslationLanguage } from './public-platform-translation-policy'
import { getPublicTranslationStates } from './public-translation-states'

export async function getPublicGiveawayTranslations(giveaways:GiveawaySource[],requestedLanguage:string){
  if(!giveaways.length)return new Map()
  const db=createAdminClient()
  const languagesResult=await db.from('languages').select('code,is_active,is_default,publication_status').eq('is_active',true)
  if(languagesResult.error)return new Map()
  const languages=(languagesResult.data??[]) as TranslationLanguage[]
  const defaultLanguage=languages.find((item)=>item.is_default)?.code??'es'
  const effectiveLanguage=languages.find((item)=>item.code===requestedLanguage&&item.is_active&&item.publication_status==='published')?.code??defaultLanguage
  if(effectiveLanguage===defaultLanguage)return new Map()
  const ids=giveaways.map((item)=>item.id)
  const [translationsResult,statesResult]=await Promise.all([
    db.from('giveaway_translations').select('giveaway_id,language,title,short_description,prize_title,prize_description,badge,reveal_title,reveal_content').in('giveaway_id',ids).eq('language',effectiveLanguage),
    getPublicTranslationStates({resourceTypes:['giveaway_translation'],resourceIds:ids,targetLanguages:[effectiveLanguage]}),
  ])
  // Compatibilidad previa a 3D.4: conserva íntegramente el contenido fuente.
  if(translationsResult.error||statesResult.error)return new Map()
  return resolveGiveawayTranslations({giveaways,requestedLanguage,defaultLanguage,languages,translations:(translationsResult.data??[]) as GiveawayTranslationRow[],states:(statesResult.data??[]) as TranslationFieldState[]})
}
