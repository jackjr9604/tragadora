export const LANGUAGE_PUBLICATION_STATUSES = ['draft','translating','review','ready','published'] as const
export type LanguagePublicationStatus = (typeof LANGUAGE_PUBLICATION_STATUSES)[number]
export type LibreTranslateLanguageStatus = 'unknown'|'supported'|'unsupported'

export type AdminLanguage = {
  code:string;name:string;native_name:string;is_active:boolean;is_default:boolean;sort_order:number
  auto_translate:boolean;publication_status:LanguagePublicationStatus;ui_catalog_available:boolean
  seo_ready:boolean;libretranslate_status:LibreTranslateLanguageStatus;libretranslate_checked_at:string|null
  updated_at:string;lock_version:number;content_count:number;state_count:number
  published_field_count:number;job_count:number
}

export function languageReadiness(language: AdminLanguage) {
  const blockers:string[]=[]
  if (!language.ui_catalog_available) blockers.push('Necesita catálogo completo de interfaz')
  if (!language.seo_ready) blockers.push('Necesita configuración SEO')
  if (!language.is_active) blockers.push('No está habilitado para administración')
  return { canPublish:blockers.length===0,blockers }
}

export function canDeleteLanguage(language: AdminLanguage) {
  return !language.is_default&&!language.is_active&&language.publication_status!=='published'
    &&language.content_count===0&&language.state_count===0&&language.job_count===0
}

export function normalizeLanguageCode(value:unknown) {
  const code=String(value??'').trim().toLowerCase()
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(code)?code:null
}
