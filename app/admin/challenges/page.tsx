import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type Media = { file_url: string; alt_text: string | null }

export default async function ChallengesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [platformsResult, challengesResult, plansResult] = await Promise.all([
    supabase.from('platforms').select(`
      id, name, status,
      media:logo_media_id (file_url, alt_text)
    `).eq('type', 'prop_firm').order('name'),
    supabase.from('challenges').select('id, platform_id, status'),
    supabase.from('account_plans').select('challenge_id'),
  ])

  const queryError = platformsResult.error ?? challengesResult.error ?? plansResult.error
  if (queryError) throw new Error(queryError.message)

  const challenges = challengesResult.data ?? []
  const plansPerChallenge = new Map<string, number>()
  for (const plan of plansResult.data ?? []) {
    plansPerChallenge.set(plan.challenge_id, (plansPerChallenge.get(plan.challenge_id) ?? 0) + 1)
  }

  const firms = (platformsResult.data ?? []).map((platform) => {
    const firmChallenges = challenges.filter((challenge) => challenge.platform_id === platform.id)
    return {
      ...platform,
      challengeCount: firmChallenges.length,
      activeChallengeCount: firmChallenges.filter((challenge) => challenge.status === 'active').length,
      planCount: firmChallenges.reduce((total, challenge) => total + (plansPerChallenge.get(challenge.id) ?? 0), 0),
    }
  })

  return <main className="min-h-screen bg-slate-100 p-8">
    <div className="mx-auto max-w-7xl">
      <div className="mb-8"><h1 className="text-3xl font-bold">Challenges por Prop Firm</h1><p className="mt-1 text-slate-500">Selecciona una firma para administrar sus modelos de evaluación y cuentas.</p></div>
      <div className="overflow-hidden rounded-xl bg-white shadow">
        <div className="overflow-x-auto"><table className="w-full min-w-[760px]">
          <thead className="border-b bg-slate-50"><tr><th className="px-6 py-4 text-left">Prop Firm</th><th className="px-6 py-4 text-left">Challenges</th><th className="px-6 py-4 text-left">Account plans</th><th className="px-6 py-4 text-left">Activos</th><th className="px-6 py-4 text-left">Acción</th></tr></thead>
          <tbody>{firms.map((firm) => <tr key={firm.id} className="border-b last:border-0"><td className="px-6 py-4"><div className="flex items-center gap-3"><AdminLogo media={first(firm.media)} name={firm.name} /><div><p className="font-semibold">{firm.name}</p><p className="text-xs text-slate-500">{firm.status}</p></div></div></td><td className="px-6 py-4 font-medium">{firm.challengeCount}</td><td className="px-6 py-4 font-medium">{firm.planCount}</td><td className="px-6 py-4 font-medium">{firm.activeChallengeCount}</td><td className="px-6 py-4"><Link href={`/admin/challenges/platform/${firm.id}`} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white">Gestionar</Link></td></tr>)}{!firms.length && <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">No hay Prop Firms registradas.</td></tr>}</tbody>
        </table></div>
      </div>
    </div>
  </main>
}

function first<T>(value: T[] | T | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null }
function AdminLogo({ media, name }: { media: Media | null; name: string }) {
  if (!media) return <span className="flex size-11 items-center justify-center rounded-lg bg-slate-100 font-semibold text-slate-500">{name.slice(0, 1)}</span>
  // La URL dinámica proviene de la biblioteca de medios de Supabase.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={media.file_url} alt={media.alt_text || name} className="size-11 rounded-lg border bg-white object-contain p-1" />
}
