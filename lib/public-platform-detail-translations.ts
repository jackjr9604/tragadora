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
import { createPublicTranslationCache, type PublicTranslationStateRow } from './public-translation-cache'

type DetailTranslations = {
  brokers: Map<string, BrokerDetailTranslation>
  exchanges: Map<string, ExchangeDetailTranslation>
}

const empty = (): DetailTranslations => ({ brokers: new Map(), exchanges: new Map() })

type BrokerRow = PlatformDetailTranslationRow & { resource_type: 'broker_detail_translation' }
type ExchangeRow = PlatformDetailTranslationRow & { resource_type: 'exchange_detail_translation' }

const getCachedBrokerDetailRows = createPublicTranslationCache<BrokerRow>({
  async loadTranslations(scope) { const result = await createAdminClient().from('broker_detail_translations').select('platform_id, language, regulation_summary').in('platform_id', [...scope.resourceIds]).eq('language', scope.effectiveLanguage); if (result.error) throw result.error; return (result.data ?? []).map((row) => ({ ...row, resource_type: 'broker_detail_translation' as const })) },
  async loadStates(scope) { const result = await getPublicTranslationStates({ resourceTypes: ['broker_detail_translation'], resourceIds: [...scope.resourceIds], targetLanguages: [scope.effectiveLanguage] }); if (result.error) throw result.error; return (result.data ?? []) as PublicTranslationStateRow[] },
})
const getCachedExchangeDetailRows = createPublicTranslationCache<ExchangeRow>({
  async loadTranslations(scope) { const result = await createAdminClient().from('exchange_detail_translations').select('platform_id, language, product_summary, regulation_summary').in('platform_id', [...scope.resourceIds]).eq('language', scope.effectiveLanguage); if (result.error) throw result.error; return (result.data ?? []).map((row) => ({ ...row, resource_type: 'exchange_detail_translation' as const })) },
  async loadStates(scope) { const result = await getPublicTranslationStates({ resourceTypes: ['exchange_detail_translation'], resourceIds: [...scope.resourceIds], targetLanguages: [scope.effectiveLanguage] }); if (result.error) throw result.error; return (result.data ?? []) as PublicTranslationStateRow[] },
})

export async function getPublicPlatformDetailTranslations(platformIds: string[], requestedLanguage: string): Promise<DetailTranslations> {
  const ids = [...new Set(platformIds.filter(Boolean))]
  if (!ids.length) return empty()
  const { languages, defaultLanguage } = await getPublicTranslationLanguageContext()
  const effectiveLanguage = languages.find((language) => language.code === requestedLanguage)?.code ?? defaultLanguage
  if (effectiveLanguage === defaultLanguage) return empty()

  try {
    const [brokers, exchanges] = await Promise.all([
      getCachedBrokerDetailRows({ resourceType: 'broker_detail_translation', resourceIds: ids, effectiveLanguage, defaultLanguage }),
      getCachedExchangeDetailRows({ resourceType: 'exchange_detail_translation', resourceIds: ids, effectiveLanguage, defaultLanguage }),
    ])
    return resolvePlatformDetailTranslations({ platformIds: ids, requestedLanguage, defaultLanguage, languages, translations: [...brokers.translations, ...exchanges.translations], states: [...brokers.states, ...exchanges.states] as TranslationFieldState[] })
  } catch { return empty() }
}
