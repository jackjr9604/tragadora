import Link from 'next/link'
import { AdminAction } from '@/components/admin/AdminPermissionsProvider'
import { notFound, redirect } from 'next/navigation'
import { AdminFirmIdentity } from '@/components/admin/AdminDirectory'
import { createClient } from '@/lib/supabase/server'
import ToggleOfferStatus from '../../ToggleOfferStatus'

export default async function PlatformOffersPage({ params, searchParams }: { params: Promise<{ platformId: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect('/login'); const [{ platformId }, query] = await Promise.all([params, searchParams])
  const [firm, offers] = await Promise.all([supabase.from('platforms').select('id, name, logo_url, media:logo_media_id(file_url, alt_text)').eq('id', platformId).maybeSingle(), supabase.from('offers').select('id, title, discount_value, discount_type, promo_code, country_code, language, starts_at, expires_at, status, challenge_id').eq('platform_id', platformId).order('created_at', { ascending: false })])
  if (firm.error || offers.error) throw new Error(firm.error?.message ?? offers.error?.message); if (!firm.data) notFound()
  const challengeIds = [...new Set((offers.data ?? []).flatMap((offer) => offer.challenge_id ? [offer.challenge_id] : []))]
  const challenges = challengeIds.length > 0
    ? await supabase.from('challenges').select('id, name').in('id', challengeIds)
    : { data: [], error: null }
  if (challenges.error) throw new Error(challenges.error.message)
  const challengeNames = new Map((challenges.data ?? []).map((challenge) => [challenge.id, challenge.name]))
  return <main className="p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-6xl"><Link href={safeReturn(query.returnTo, '/admin/offers')} className="text-sm text-slate-600">← Volver al directorio</Link><header className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><AdminFirmIdentity name={firm.data.name} media={firm.data.media} legacyUrl={firm.data.logo_url} /><AdminAction permission="offers.create"><Link href={`/admin/offers/new?platform=${platformId}`} className="rounded-lg bg-black px-4 py-2.5 text-sm text-white">+ Nueva oferta</Link></AdminAction></header><section className="mt-6 overflow-hidden rounded-xl border bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="border-b bg-slate-50 text-left"><tr><th className="px-4 py-3">Oferta</th><th>Descuento</th><th>Código</th><th>Challenge</th><th>País / idioma</th><th>Vigencia</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{offers.data?.map((offer) => <tr key={offer.id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{offer.title}</td><td>{offer.discount_value}{offer.discount_type === 'percentage' ? '%' : ' USD'}</td><td className="font-mono">{offer.promo_code || '—'}</td><td>{offer.challenge_id ? challengeNames.get(offer.challenge_id) ?? <span className="text-slate-400">Challenge no disponible</span> : 'General'}</td><td>{offer.country_code || 'Todos'} · {offer.language || 'Todos'}</td><td>{offer.expires_at ? new Date(offer.expires_at).toLocaleDateString('es-CO') : 'Sin vencimiento'}</td><td><ToggleOfferStatus id={offer.id} status={offer.status} /></td><td><AdminAction permission="offers.update"><Link href={`/admin/offers/${offer.id}`} className="underline">Editar</Link></AdminAction></td></tr>)}{!offers.data?.length && <tr><td colSpan={8} className="p-12 text-center text-slate-500">Esta firma todavía no tiene ofertas.</td></tr>}</tbody></table></div></section></div></main>
}
function safeReturn(value: string | undefined, fallback: string) { return value?.startsWith('/admin/') ? value : fallback }
