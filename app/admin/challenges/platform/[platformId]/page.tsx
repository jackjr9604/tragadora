import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type Media = { file_url: string; alt_text: string | null }

export default async function PlatformChallengesPage({ params }: { params: Promise<{ platformId: string }> }) {
  const { platformId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [platformResult, challengesResult] = await Promise.all([
    supabase.from('platforms').select(`
      id, name,
      media:logo_media_id (file_url, alt_text)
    `).eq('id', platformId).eq('type', 'prop_firm').maybeSingle(),
    supabase.from('challenges').select('id, name, challenge_type, phases, status').eq('platform_id', platformId).order('name'),
  ])
  if (platformResult.error) throw new Error(platformResult.error.message)
  if (!platformResult.data) notFound()
  if (challengesResult.error) throw new Error(challengesResult.error.message)

  const platform = platformResult.data
  const challenges = challengesResult.data ?? []
  const challengeIds = challenges.map((challenge) => challenge.id)
  const plansResult = challengeIds.length
    ? await supabase.from('account_plans').select('challenge_id').in('challenge_id', challengeIds)
    : { data: [], error: null }
  if (plansResult.error) throw new Error(plansResult.error.message)

  const plansPerChallenge = new Map<string, number>()
  for (const plan of plansResult.data ?? []) plansPerChallenge.set(plan.challenge_id, (plansPerChallenge.get(plan.challenge_id) ?? 0) + 1)
  const planCount = (plansResult.data ?? []).length
  const activeCount = challenges.filter((challenge) => challenge.status === 'active').length
  const inactiveCount = challenges.length - activeCount

  return <main className="min-h-screen bg-slate-100 p-8"><div className="mx-auto max-w-7xl">
    <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div className="flex items-center gap-4"><AdminLogo media={first(platform.media)} name={platform.name} /><div><p className="text-sm text-slate-500">Gestión de Challenges</p><h1 className="text-3xl font-bold">{platform.name}</h1></div></div><div className="flex gap-3"><Link href="/admin/challenges" className="rounded-lg border bg-white px-4 py-2 text-sm font-medium">Volver</Link><Link href={`/admin/challenges/new?platform=${platform.id}`} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white">+ Nuevo Challenge</Link></div></div>

    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Summary label="Total challenges" value={challenges.length} /><Summary label="Total planes" value={planCount} /><Summary label="Challenges activos" value={activeCount} /><Summary label="Inactivos / borrador" value={inactiveCount} /></div>

    <div className="overflow-hidden rounded-xl bg-white shadow"><div className="overflow-x-auto"><table className="w-full min-w-[820px]">
      <thead className="border-b bg-slate-50"><tr><th className="px-6 py-4 text-left">Challenge</th><th className="px-6 py-4 text-left">Tipo</th><th className="px-6 py-4 text-left">Fases</th><th className="px-6 py-4 text-left">Estado</th><th className="px-6 py-4 text-left">Account plans</th><th className="px-6 py-4 text-left">Acción</th></tr></thead>
      <tbody>{challenges.map((challenge) => <tr key={challenge.id} className="border-b last:border-0"><td className="px-6 py-4 font-semibold">{challenge.name}</td><td className="px-6 py-4">{challenge.challenge_type ?? '—'}</td><td className="px-6 py-4">{challenge.phases ?? '—'}</td><td className="px-6 py-4"><Status value={challenge.status} /></td><td className="px-6 py-4 font-medium">{plansPerChallenge.get(challenge.id) ?? 0}</td><td className="px-6 py-4"><Link href={`/admin/challenges/${challenge.id}`} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white">Gestionar</Link></td></tr>)}{!challenges.length && <tr><td colSpan={6} className="px-6 py-12 text-center"><p className="font-medium">Esta Prop Firm todavía no tiene challenges.</p><Link href={`/admin/challenges/new?platform=${platform.id}`} className="mt-3 inline-flex text-sm font-medium underline">Crear el primero</Link></td></tr>}</tbody>
    </table></div></div>
  </div></main>
}

function Summary({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-white p-5 shadow"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div> }
function Status({ value }: { value: string }) { const active = value === 'active'; return <span className={`rounded-full px-3 py-1 text-xs font-medium ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{value}</span> }
function first<T>(value: T[] | T | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null }
function AdminLogo({ media, name }: { media: Media | null; name: string }) {
  if (!media) return <span className="flex size-14 items-center justify-center rounded-xl bg-white text-xl font-bold text-slate-500 shadow">{name.slice(0, 1)}</span>
  // La URL dinámica proviene de la biblioteca de medios de Supabase.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={media.file_url} alt={media.alt_text || name} className="size-14 rounded-xl border bg-white object-contain p-1" />
}
