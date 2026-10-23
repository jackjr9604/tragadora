import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  resolvePlatformDetailTranslations,
  type BrokerDetailTranslation,
  type ExchangeDetailTranslation,
  type PlatformDetailTranslationRow,
} from './public-platform-detail-translation-policy'
import type { TranslationFieldState } from './public-platform-translation-policy'
import { getPublicTranslationStates } from './public-translation-states'
import { getPublicTranslationLanguageContext } from './public-translation-languages'

type DetailTranslations = {
  brokers: Map<string, BrokerDetailTranslation>
  exchanges: Map<string, ExchangeDetailTranslation>
}

const empty = (): DetailTranslations => ({ brokers: new Map(), exchanges: new Map() })

export async function getPublicPlatformDetailTranslations(platformIds: string[], requestedLanguage: string): Promise<DetailTranslations> {
  const ids = [...new Set(platformIds.filter(Boolean))]
  if (!ids.length) return empty()
  const db = createAdminClient()
  const { languages, defaultLanguage } = await getPublicTranslationLanguageContext()
  const effectiveLanguage = languages.find((language) => language.code === requestedLanguage)?.code ?? defaultLanguage
  if (effectiveLanguage === defaultLanguage) return empty()

  const [brokersResult, exchangesResult, statesResult] = await Promise.all([
    db.from('broker_detail_translations').select('platform_id, language, regulation_summary').in('platform_id', ids).eq('language', effectiveLanguage),
    db.from('exchange_detail_translations').select('platform_id, language, product_summary, regulation_summary').in('platform_id', ids).eq('language', effectiveLanguage),
    getPublicTranslationStates({ resourceTypes: ['broker_detail_translation', 'exchange_detail_translation'], resourceIds: ids, targetLanguages: [effectiveLanguage] }),
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
