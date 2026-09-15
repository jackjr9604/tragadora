import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HomeFeaturedFirmsManager } from '@/components/admin/HomeFeaturedFirmsManager'

export default async function AdminHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [platformsResult, featuredResult] = await Promise.all([
    supabase.from('platforms').select('id, name, status').eq('type', 'prop_firm').order('name'),
    supabase.from('home_featured_platforms').select('id, platform_id, active, sort_order, badge, description, cta_label, starts_at, ends_at').order('sort_order'),
  ])

  return <HomeFeaturedFirmsManager platforms={platformsResult.data ?? []} initialRows={featuredResult.data ?? []} loadError={platformsResult.error?.message ?? featuredResult.error?.message ?? null} />
}
