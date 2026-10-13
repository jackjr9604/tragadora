import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import type { TranslationFieldState } from './public-platform-translation-policy'

const BASE_FIELDS = 'resource_type,resource_id,field_name,target_language,source_hash,translated_source_hash,source_revision,translated_revision,status,is_protected'

export async function getPublicTranslationStates({ resourceTypes, resourceIds, targetLanguages }: { resourceTypes: string[]; resourceIds: string[]; targetLanguages?: string[] }) {
  const db = createAdminClient()
  const run = (fields: string) => {
    let query = db.from('translation_field_state').select(fields).in('resource_type', resourceTypes).in('resource_id', resourceIds)
    if (targetLanguages?.length) query = query.in('target_language', targetLanguages)
    return query
  }
  let result = await run(`${BASE_FIELDS},publication_status`)
  // Safe rolling-deploy compatibility before migration 3E.2 is installed.
  if (result.error?.code === '42703') result = await run(BASE_FIELDS)
  return { data: (result.data ?? []) as unknown as TranslationFieldState[], error: result.error }
}
