import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveGiveawayTranslations,type GiveawaySource,type GiveawayTranslationRow } from './public-giveaway-translation-policy'
import type { TranslationFieldState } from './public-platform-translation-policy'

const languages=[{code:'es',is_active:true,is_default:true,publication_status:'published'},{code:'en',is_active:true,is_default:false,publication_status:'published'},{code:'pt',is_active:true,is_default:false,publication_status:'published'}]
const giveaways:GiveawaySource[]=[{id:'one',title:'Sorteo anual',shortDescription:'Participa ahora',prizeTitle:'Cuenta financiada',prizeDescription:'Premio principal',badge:'Destacado',revealTitle:'Ganador',revealContent:'Resultado oficial'}]
const translations:GiveawayTranslationRow[]=[
 {giveaway_id:'one',language:'en',title:'Annual giveaway',short_description:'Join now',prize_title:'Funded account',prize_description:'Main prize',badge:'Featured',reveal_title:'Winner',reveal_content:'Official result'},
 {giveaway_id:'one',language:'pt',title:'Sorteio anual',short_description:'Participe agora',prize_title:'Conta financiada',prize_description:'Prêmio principal',badge:'Destaque',reveal_title:'Vencedor',reveal_content:'Resultado oficial'},
]
const state=(field:string,language='en',overrides:Partial<TranslationFieldState>={}):TranslationFieldState=>({resource_type:'giveaway_translation',resource_id:'one',field_name:field,target_language:language,source_hash:'same',translated_source_hash:'same',source_revision:2,translated_revision:2,status:'reviewed',is_protected:true,...overrides})
const states=['title','short_description','prize_title','prize_description','badge','reveal_title','reveal_content'].flatMap((field)=>[state(field),state(field,'pt')])

test('resuelve ES EN PT por campo sin alterar identidad operativa',()=>{
 const en=resolveGiveawayTranslations({giveaways,requestedLanguage:'en',defaultLanguage:'es',languages,translations,states})
 assert.deepEqual(en.get('one'),{title:'Annual giveaway',shortDescription:'Join now',prizeTitle:'Funded account',prizeDescription:'Main prize',badge:'Featured',revealTitle:'Winner',revealContent:'Official result'})
 assert.equal(resolveGiveawayTranslations({giveaways,requestedLanguage:'pt',defaultLanguage:'es',languages,translations,states}).get('one')?.title,'Sorteio anual')
 assert.equal(resolveGiveawayTranslations({giveaways,requestedLanguage:'es',defaultLanguage:'es',languages,translations,states}).size,0)
})

test('fallback por campo rechaza stale y revisiones antiguas',()=>{
 const stale=states.map((item)=>item.field_name==='reveal_content'&&item.target_language==='en'?{...item,status:'stale'}:item)
 const result=resolveGiveawayTranslations({giveaways,requestedLanguage:'en',defaultLanguage:'es',languages,translations,states:stale})
 assert.equal(result.get('one')?.revealContent,undefined)
 assert.equal(result.get('one')?.title,'Annual giveaway')
 const old=states.map((item)=>item.field_name==='badge'&&item.target_language==='en'?{...item,translated_revision:1}:item)
 assert.equal(resolveGiveawayTranslations({giveaways,requestedLanguage:'en',defaultLanguage:'es',languages,translations,states:old}).get('one')?.badge,undefined)
})

test('idioma no publicado e importada desprotegida usan fallback fuente',()=>{
 const unpublished=languages.map((item)=>item.code==='en'?{...item,publication_status:'review'}:item)
 assert.equal(resolveGiveawayTranslations({giveaways,requestedLanguage:'en',defaultLanguage:'es',languages:unpublished,translations,states}).size,0)
 const imported=states.map((item)=>item.field_name==='title'&&item.target_language==='en'?{...item,status:'imported_unreviewed',is_protected:false}:item)
 assert.equal(resolveGiveawayTranslations({giveaways,requestedLanguage:'en',defaultLanguage:'es',languages,translations,states:imported}).get('one')?.title,undefined)
})
