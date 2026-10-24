import { notFound } from 'next/navigation'
import { ExchangeForm, type ExchangeValue } from '@/components/admin/ExchangeForm'
import { TranslationWorkflowLink } from '@/components/admin/translations/TranslationWorkflowLink'
import { createClient } from '@/lib/supabase/server'

type Media = { id: string; file_name: string; file_url: string; alt_text: string | null }
const first = <T,>(value: T | T[] | null): T | null => Array.isArray(value) ? value[0] ?? null : value

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()
  const [platform, details, translation, countries] = await Promise.all([
    db.from('platforms').select('id,name,slug,website_url,status,origin_country_code,updated_at,media:logo_media_id(id,file_name,file_url,alt_text)').eq('id', id).eq('type', 'exchange').maybeSingle(),
    db.from('exchange_details').select('*').eq('platform_id', id).maybeSingle(),
    db.from('platform_translations').select('short_description').eq('platform_id', id).eq('language', 'es').maybeSingle(),
    db.from('countries').select('code,name').order('name'),
  ])
  const error = platform.error ?? details.error ?? translation.error ?? countries.error
  if (error) throw new Error(error.message)
  if (!platform.data) notFound()
  const row = platform.data, specialized = details.data
  const initial: ExchangeValue = {
    id: row.id, updatedAt: row.updated_at, name: row.name, slug: row.slug, websiteUrl: row.website_url ?? '', status: row.status,
    countryCode: row.origin_country_code ?? '', description: translation.data?.short_description ?? '',
    logo: first(row.media as Media | Media[] | null), foundedYear: specialized?.founded_year ? String(specialized.founded_year) : '',
    exchangeType: specialized?.exchange_type ?? 'centralized', productSummary: specialized?.product_summary ?? '',
    fiatSupport: specialized?.fiat_support === null || specialized?.fiat_support === undefined ? '' : String(specialized.fiat_support),
    regulationSummary: specialized?.regulation_summary ?? '', regulationSourceUrl: specialized?.regulation_source_url ?? '',
    featured: specialized?.is_featured ?? false, order: String(specialized?.display_order ?? 100),
  }
  const returnTo = `/admin/exchanges/${id}/edit`
  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-4xl"><header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><h1 className="text-3xl font-bold">Editar exchange</h1><div className="flex flex-wrap gap-2"><TranslationWorkflowLink resourceType="platform_translation" resourceId={id} label="Contenido general" returnTo={returnTo}/><TranslationWorkflowLink resourceType="exchange_detail_translation" resourceId={id} label="Datos especializados" returnTo={returnTo}/></div></header><ExchangeForm initial={initial} countries={countries.data ?? []}/></div></main>
}
