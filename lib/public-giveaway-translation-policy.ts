import { isPublishableTranslationState, type TranslationFieldState, type TranslationLanguage } from './public-platform-translation-policy'

export const GIVEAWAY_TRANSLATION_FIELDS = ['title','short_description','prize_title','prize_description','badge','reveal_title','reveal_content'] as const
export type GiveawayTranslationField=(typeof GIVEAWAY_TRANSLATION_FIELDS)[number]
export type GiveawaySource={id:string;title:string;shortDescription:string|null;prizeTitle:string;prizeDescription:string|null;badge:string|null;revealTitle:string|null;revealContent:string|null}
export type GiveawayTranslationRow={giveaway_id:string;language:string;title:string|null;short_description:string|null;prize_title:string|null;prize_description:string|null;badge:string|null;reveal_title:string|null;reveal_content:string|null}
export type ResolvedGiveawayTranslation={title?:string;shortDescription?:string;prizeTitle?:string;prizeDescription?:string;badge?:string;revealTitle?:string;revealContent?:string}

const targets:Record<GiveawayTranslationField,keyof ResolvedGiveawayTranslation>={title:'title',short_description:'shortDescription',prize_title:'prizeTitle',prize_description:'prizeDescription',badge:'badge',reveal_title:'revealTitle',reveal_content:'revealContent'}

export function resolveGiveawayTranslations(input:{giveaways:GiveawaySource[];requestedLanguage:string;defaultLanguage:string;languages:TranslationLanguage[];translations:GiveawayTranslationRow[];states:TranslationFieldState[]}){
  const published=new Set(input.languages.filter((item)=>item.is_active&&item.publication_status==='published').map((item)=>item.code))
  const language=published.has(input.requestedLanguage)?input.requestedLanguage:input.defaultLanguage
  const result=new Map<string,ResolvedGiveawayTranslation>()
  if(language===input.defaultLanguage)return result
  const rows=new Map(input.translations.map((row)=>[`${row.giveaway_id}:${row.language}`,row]))
  const states=new Map(input.states.map((state)=>[`${state.resource_id}:${state.target_language}:${state.field_name}`,state]))
  for(const giveaway of input.giveaways){const row=rows.get(`${giveaway.id}:${language}`);if(!row)continue;const resolved:ResolvedGiveawayTranslation={};for(const field of GIVEAWAY_TRANSLATION_FIELDS){const value=row[field];const state=states.get(`${giveaway.id}:${language}:${field}`);if(typeof value==='string'&&value.trim()&&isPublishableTranslationState(state))Object.assign(resolved,{[targets[field]]:value.trim()})}result.set(giveaway.id,resolved)}
  return result
}
