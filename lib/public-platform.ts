import 'server-only'

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

async function getPublicPlatformBySlugUncached(slug: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('platforms')
    .select(`
      id, name, slug, score, origin_country_code,
      media:logo_media_id (file_url, alt_text)
    `)
    .eq('slug', slug)
    .eq('type', 'prop_firm')
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

export const getPublicPlatformBySlug = unstable_cache(
  getPublicPlatformBySlugUncached,
  ['public-platform-by-slug-v1'],
  { revalidate: 300, tags: ['public-prop-firms'] }
)
