import { isPublishableTranslationState, type TranslationFieldState, type TranslationLanguage } from './public-platform-translation-policy'

export const COMMUNITY_TRANSLATION_FIELDS = ['short_description','category_label','region_label','badge'] as const
export type CommunityTranslationField=(typeof COMMUNITY_TRANSLATION_FIELDS)[number]
export type CommunitySource={id:string;shortDescription:string|null;category:string|null;regionLabel:string|null;badge:string|null}
export type CommunityTranslationRow={community_id:string;language:string;short_description:string|null;category_label:string|null;region_label:string|null;badge:string|null}
export type ResolvedCommunityTranslation={shortDescription?:string;categoryLabel?:string;regionLabel?:string;badge?:string}

const targets:Record<CommunityTranslationField,keyof ResolvedCommunityTranslation>={short_description:'shortDescription',category_label:'categoryLabel',region_label:'regionLabel',badge:'badge'}

export function resolveCommunityTranslations(input:{communities:CommunitySource[];requestedLanguage:string;defaultLanguage:string;languages:TranslationLanguage[];translations:CommunityTranslationRow[];states:TranslationFieldState[]}){
  const published=new Set(input.languages.filter((item)=>item.is_active&&item.publication_status==='published').map((item)=>item.code))
  const language=published.has(input.requestedLanguage)?input.requestedLanguage:input.defaultLanguage
  const result=new Map<string,ResolvedCommunityTranslation>()
  if(language===input.defaultLanguage)return result
  const rows=new Map(input.translations.map((row)=>[`${row.community_id}:${row.language}`,row]))
  const states=new Map(input.states.map((state)=>[`${state.resource_id}:${state.target_language}:${state.field_name}`,state]))
  for(const community of input.communities){const row=rows.get(`${community.id}:${language}`);if(!row)continue;const resolved:ResolvedCommunityTranslation={};for(const field of COMMUNITY_TRANSLATION_FIELDS){const value=row[field];const state=states.get(`${community.id}:${language}:${field}`);if(typeof value==='string'&&value.trim()&&isPublishableTranslationState(state))Object.assign(resolved,{[targets[field]]:value.trim()})}result.set(community.id,resolved)}
  return result
}
