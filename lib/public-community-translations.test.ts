import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveCommunityTranslations,type CommunitySource,type CommunityTranslationRow } from './public-community-translation-policy'
import type { TranslationFieldState } from './public-platform-translation-policy'

const languages=[{code:'es',is_active:true,is_default:true,publication_status:'published'},{code:'en',is_active:true,is_default:false,publication_status:'published'},{code:'pt',is_active:true,is_default:false,publication_status:'published'}]
const communities:CommunitySource[]=[{id:'one',shortDescription:'Comunidad de futuros',category:'education',regionLabel:'Global',badge:'Destacada'}]
const translations:CommunityTranslationRow[]=[
 {community_id:'one',language:'en',short_description:'Futures community',category_label:'Education',region_label:'Worldwide',badge:'Featured'},
 {community_id:'one',language:'pt',short_description:'Comunidade de futuros',category_label:'Educação',region_label:'Global',badge:'Destaque'},
]
const state=(field:string,language='en',overrides:Partial<TranslationFieldState>={}):TranslationFieldState=>({resource_type:'community_translation',resource_id:'one',field_name:field,target_language:language,source_hash:'same',translated_source_hash:'same',source_revision:2,translated_revision:2,status:'reviewed',is_protected:true,...overrides})
const states=['short_description','category_label','region_label','badge'].flatMap((field)=>[state(field),state(field,'pt')])

test('resuelve ES EN PT por campo sin alterar identidad',()=>{
 const en=resolveCommunityTranslations({communities,requestedLanguage:'en',defaultLanguage:'es',languages,translations,states})
 assert.deepEqual(en.get('one'),{shortDescription:'Futures community',categoryLabel:'Education',regionLabel:'Worldwide',badge:'Featured'})
 assert.equal(resolveCommunityTranslations({communities,requestedLanguage:'pt',defaultLanguage:'es',languages,translations,states}).get('one')?.categoryLabel,'Educação')
 assert.equal(resolveCommunityTranslations({communities,requestedLanguage:'es',defaultLanguage:'es',languages,translations,states}).size,0)
})

test('fallback por campo rechaza stale y revisiones antiguas',()=>{
 const stale=states.map((item)=>item.field_name==='region_label'&&item.target_language==='en'?{...item,status:'stale'}:item)
 const result=resolveCommunityTranslations({communities,requestedLanguage:'en',defaultLanguage:'es',languages,translations,states:stale})
 assert.equal(result.get('one')?.regionLabel,undefined)
 assert.equal(result.get('one')?.shortDescription,'Futures community')
 const old=states.map((item)=>item.field_name==='badge'&&item.target_language==='en'?{...item,translated_revision:1}:item)
 assert.equal(resolveCommunityTranslations({communities,requestedLanguage:'en',defaultLanguage:'es',languages,translations,states:old}).get('one')?.badge,undefined)
})

test('idioma no publicado e importada desprotegida usan fallback fuente',()=>{
 const unpublished=languages.map((item)=>item.code==='en'?{...item,publication_status:'review'}:item)
 assert.equal(resolveCommunityTranslations({communities,requestedLanguage:'en',defaultLanguage:'es',languages:unpublished,translations,states}).size,0)
 const imported=states.map((item)=>item.field_name==='badge'&&item.target_language==='en'?{...item,status:'imported_unreviewed',is_protected:false}:item)
 assert.equal(resolveCommunityTranslations({communities,requestedLanguage:'en',defaultLanguage:'es',languages,translations,states:imported}).get('one')?.badge,undefined)
})
