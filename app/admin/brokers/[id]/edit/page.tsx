import { notFound } from 'next/navigation'
import { BrokerForm, type BrokerFormValue } from '@/components/admin/BrokerForm'
import { createClient } from '@/lib/supabase/server'

type MediaRelation = { id: string; file_name: string; file_url: string; alt_text: string | null }
function first<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value }

export default async function EditBrokerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()
  const [platform, details, translation, markets, platformCatalogs, countries, tradingPlatforms] = await Promise.all([
    db.from('platforms').select('id, name, slug, website_url, status, origin_country_code, media:logo_media_id(id, file_name, file_url, alt_text)').eq('id', id).eq('type', 'broker').maybeSingle(),
    db.from('broker_details').select('founded_year, minimum_deposit, minimum_deposit_currency, regulation_summary, regulation_source_url, is_featured, display_order').eq('platform_id', id).maybeSingle(),
    db.from('platform_translations').select('short_description').eq('platform_id', id).eq('language', 'es').maybeSingle(),
    db.from('platform_markets').select('market').eq('platform_id', id),
    db.from('platform_trading_platforms').select('trading_platform_id').eq('platform_id', id),
    db.from('countries').select('code, name').order('name'),
    db.from('trading_platforms').select('id, name, status').order('name'),
  ])
  const error = [platform, details, translation, markets, platformCatalogs, countries, tradingPlatforms].find((result) => result.error)?.error
  if (error) throw new Error(error.message)
  if (!platform.data) notFound()
  const media = first(platform.data.media as MediaRelation | MediaRelation[] | null)
  const initial: BrokerFormValue = {
    id: platform.data.id,
    name: platform.data.name,
    slug: platform.data.slug,
    websiteUrl: platform.data.website_url ?? '',
    status: platform.data.status,
    countryCode: platform.data.origin_country_code ?? '',
    description: translation.data?.short_description ?? '',
    logo: media,
    foundedYear: details.data?.founded_year === null || details.data?.founded_year === undefined ? '' : String(details.data.founded_year),
    minimumDeposit: details.data?.minimum_deposit === null || details.data?.minimum_deposit === undefined ? '' : String(details.data.minimum_deposit),
    minimumDepositCurrency: details.data?.minimum_deposit_currency ?? 'USD',
    regulationSummary: details.data?.regulation_summary ?? '',
    regulationSourceUrl: details.data?.regulation_source_url ?? '',
    isFeatured: details.data?.is_featured ?? false,
    displayOrder: String(details.data?.display_order ?? 100),
    markets: (markets.data ?? []).map((row) => row.market),
    tradingPlatformIds: (platformCatalogs.data ?? []).map((row) => row.trading_platform_id),
  }
  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-4xl"><div className="mb-8"><h1 className="text-3xl font-bold">Editar broker</h1><p className="mt-1 text-slate-500">Actualiza la ficha pública de {platform.data.name}.</p></div><BrokerForm initial={initial} countries={countries.data ?? []} tradingPlatforms={tradingPlatforms.data ?? []} /></div></main>
}
