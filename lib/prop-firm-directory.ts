import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export type DirectoryFirm = { id: string; name: string; slug: string; country: string | null; foundedAt: string | null; isNew: boolean; markets: string[]; profitSplit: number | null; logoUrl: string | null; logoAlt: string | null; popularity: number }

export async function getPropFirmDirectory(): Promise<DirectoryFirm[]> {
  const supabase = createAdminClient()
  const [platforms, details, markets, countries, links] = await Promise.all([
    supabase.from('platforms').select('id, name, slug, origin_country_code, logo_url, media:logo_media_id(file_url, alt_text)').eq('type', 'prop_firm').eq('status', 'active'),
    supabase.from('prop_firm_details').select('*'),
    supabase.from('platform_markets').select('platform_id, market'),
    supabase.from('countries').select('code, name'),
    supabase.from('affiliate_links').select('id, platform_id'),
  ])
  const failure = [platforms, details, markets, countries, links].find((result) => result.error)
  if (failure?.error) throw new Error(failure.error.message)
  const clickRows: Array<{ affiliate_link_id: string }> = []
  for (let offset = 0; ; offset += 1_000) {
    const page = await supabase.from('affiliate_clicks').select('affiliate_link_id').range(offset, offset + 999)
    if (page.error) throw new Error(page.error.message)
    clickRows.push(...(page.data ?? []))
    if ((page.data?.length ?? 0) < 1_000) break
  }
  const detailMap = new Map((details.data ?? []).map((item) => [item.platform_id, item]))
  const countryMap = new Map((countries.data ?? []).map((item) => [item.code, item.name]))
  const marketsMap = new Map<string, string[]>(); for (const item of markets.data ?? []) marketsMap.set(item.platform_id, [...(marketsMap.get(item.platform_id) ?? []), item.market])
  const platformByLink = new Map((links.data ?? []).map((item) => [item.id, item.platform_id]))
  const popularity = new Map<string, number>(); for (const click of clickRows) { const id = platformByLink.get(click.affiliate_link_id); if (id) popularity.set(id, (popularity.get(id) ?? 0) + 1) }
  return (platforms.data ?? []).map((row) => { const detail = detailMap.get(row.id); const media = first(row.media); return { id: row.id, name: row.name, slug: row.slug, country: row.origin_country_code ? countryMap.get(row.origin_country_code) ?? row.origin_country_code : null, foundedAt: detail?.founded_at ?? null, isNew: Boolean(detail?.is_new), markets: marketsMap.get(row.id) ?? [], profitSplit: numberOrNull(detail?.profit_split_max), logoUrl: media?.file_url ?? row.logo_url ?? null, logoAlt: media?.alt_text ?? null, popularity: popularity.get(row.id) ?? 0 } })
}
function first<T>(value: T[] | T | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null }
function numberOrNull(value: unknown) { return value === null || value === undefined ? null : Number(value) }
