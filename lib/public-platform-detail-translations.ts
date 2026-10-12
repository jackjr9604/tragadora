import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  resolvePlatformDetailTranslations,
  type BrokerDetailTranslation,
  type ExchangeDetailTranslation,
  type PlatformDetailTranslationRow,
} from './public-platform-detail-translation-policy'
import type { TranslationFieldState, TranslationLanguage } from './public-platform-translation-policy'

type DetailTranslations = {
  brokers: Map<string, BrokerDetailTranslation>
  exchanges: Map<string, ExchangeDetailTranslation>
}

const empty = (): DetailTranslations => ({ brokers: new Map(), exchanges: new Map() })

export async function getPublicPlatformDetailTranslations(platformIds: string[], requestedLanguage: string): Promise<DetailTranslations> {
  const ids = [...new Set(platformIds.filter(Boolean))]
  if (!ids.length) return empty()
  const db = createAdminClient()
  const languagesResult = await db.from('languages')
    .select('code, is_active, is_default, publication_status')
    .eq('is_active', true)
  // Compatibilidad hasta aplicar 3D.1: la ausencia de tablas/columnas conserva
  // exactamente los valores fuente de broker_details/exchange_details.
  if (languagesResult.error) return empty()
  const languages = (languagesResult.data ?? []) as TranslationLanguage[]
  const defaultLanguage = languages.find((language) => language.is_default)?.code ?? 'es'
  const effectiveLanguage = languages.find((language) => language.code === requestedLanguage && language.is_active && language.publication_status === 'published')?.code ?? defaultLanguage
  if (effectiveLanguage === defaultLanguage) return empty()

  const [brokersResult, exchangesResult, statesResult] = await Promise.all([
    db.from('broker_detail_translations').select('platform_id, language, regulation_summary').in('platform_id', ids).eq('language', effectiveLanguage),
    db.from('exchange_detail_translations').select('platform_id, language, product_summary, regulation_summary').in('platform_id', ids).eq('language', effectiveLanguage),
    db.from('translation_field_state')
      .select('resource_type, resource_id, field_name, target_language, source_hash, translated_source_hash, source_revision, translated_revision, status, is_protected')
      .in('resource_type', ['broker_detail_translation', 'exchange_detail_translation'])
      .in('resource_id', ids)
      .eq('target_language', effectiveLanguage),
  ])
  if (brokersResult.error || exchangesResult.error || statesResult.error) return empty()
  const translations: PlatformDetailTranslationRow[] = [
    ...(brokersResult.data ?? []).map((row) => ({ ...row, resource_type: 'broker_detail_translation' as const })),
    ...(exchangesResult.data ?? []).map((row) => ({ ...row, resource_type: 'exchange_detail_translation' as const })),
  ]
  return resolvePlatformDetailTranslations({
    platformIds: ids,
    requestedLanguage,
    defaultLanguage,
    languages,
    translations,
    states: (statesResult.data ?? []) as TranslationFieldState[],
  })
}
