import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AccountPlanForm } from '@/components/admin/challenges/AccountPlanForm'

export default async function NewAccountPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [challengeResult, variantsResult, phasesResult] = await Promise.all([
    supabase.from('challenges').select('id, name, platforms(name, slug)').eq('id', id).maybeSingle(),
    supabase.from('challenge_variants').select('id, name, status').eq('challenge_id', id).order('name'),
    supabase.from('challenge_phases').select('id', { count: 'exact', head: true }).eq('challenge_id', id),
  ])
  const error = challengeResult.error ?? variantsResult.error ?? phasesResult.error
  if (error) throw new Error(error.message)
  if (!challengeResult.data) notFound()
  const platform = Array.isArray(challengeResult.data.platforms) ? challengeResult.data.platforms[0] : challengeResult.data.platforms
  if (!platform) throw new Error('La Prop Firm del Challenge no está disponible.')

  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-3xl">
    <Link href={`/admin/challenges/${id}`} className="text-sm font-medium text-slate-600">← Volver al Challenge</Link>
    <header className="my-6"><p className="text-sm text-slate-500">{challengeResult.data.name}</p><h1 className="text-3xl font-bold">Nuevo plan de cuenta</h1></header>
    <section className="rounded-xl bg-white p-5 shadow sm:p-8"><AccountPlanForm challengeId={id} platformSlug={platform.slug} variants={variantsResult.data ?? []} hasNormalizedPhases={(phasesResult.count ?? 0) > 0} cancelHref={`/admin/challenges/${id}`} /></section>
  </div></main>
}
