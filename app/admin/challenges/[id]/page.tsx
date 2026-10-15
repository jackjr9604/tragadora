import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveChallenge, type AccountPlan, type ChallengePhase, type ChallengeRewardOption, type ChallengeVariant, type ChallengeVariantPhase, type EffectivePhase } from '@/lib/challenge-resolver'
import { ChallengeGeneralForm } from '@/components/admin/challenges/ChallengeGeneralForm'
import { AccountPlansManager } from '@/components/admin/challenges/AccountPlansManager'
import { ChallengePhasesManager } from '@/components/admin/challenges/ChallengePhasesManager'
import { ChallengeVariantsManager } from '@/components/admin/challenges/ChallengeVariantsManager'
import type { EditableChallengePhase } from '@/components/admin/challenges/PhaseForm'
import type { EditableChallengeVariant } from '@/components/admin/challenges/VariantForm'
import { TranslationWorkflowLink } from '@/components/admin/translations/TranslationWorkflowLink'

export default async function ChallengePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()

  const { data: challenge } = await supabase
    .from('challenges')
    .select(`
      *,
      platforms (
        name,
        slug
      )
    `)
    .eq('id', id)
    .single()

  if (!challenge) {
    notFound()
  }

  const visibleAt = new Date().toISOString()
  const [plansResult, phasesResult, variantsResult, rewardOptionsResult, platformsResult] = await Promise.all([
    supabase.from('account_plans').select('*').eq('challenge_id', id).order('account_size'),
    supabase.from('challenge_phases').select('*').eq('challenge_id', id).order('phase_number'),
    supabase.from('challenge_variants').select('*').eq('challenge_id', id).order('name'),
    supabase.from('challenge_reward_options').select('*').eq('challenge_id', id).order('sort_order'),
    supabase.from('platforms').select('id, name, slug').eq('type', 'prop_firm').order('name'),
  ])
  const queryError = plansResult.error ?? phasesResult.error ?? variantsResult.error ?? rewardOptionsResult.error ?? platformsResult.error
  if (queryError) throw new Error(queryError.message)
  const variantIds = (variantsResult.data ?? []).map((variant) => variant.id)
  const variantPhasesResult = variantIds.length
    ? await supabase.from('challenge_variant_phases').select('*').in('variant_id', variantIds).order('phase_number')
    : { data: [], error: null }
  if (variantPhasesResult.error) throw new Error(variantPhasesResult.error.message)
  const plans = (plansResult.data ?? []) as AccountPlan[]
  const phases = (phasesResult.data ?? []) as EditableChallengePhase[]
  const resolved = resolveChallenge({
    challenge,
    plans,
    phases: phases as ChallengePhase[],
    variants: (variantsResult.data ?? []) as ChallengeVariant[],
    variantPhases: (variantPhasesResult.data ?? []) as ChallengeVariantPhase[],
    rewardOptions: (rewardOptionsResult.data ?? []) as ChallengeRewardOption[],
    now: visibleAt,
  })
  const variantName = new Map(resolved.variants.map((variant) => [variant.id, variant.name]))
  const platform = Array.isArray(challenge.platforms) ? challenge.platforms[0] : challenge.platforms
  if (!platform) throw new Error('La Prop Firm del Challenge no está disponible.')
  const legacyPlanCount = plans.filter((plan) => [
    plan.profit_target,
    plan.daily_drawdown,
    plan.max_drawdown,
    plan.profit_split,
    plan.min_trading_days,
    plan.max_trading_days,
    plan.payout_frequency,
  ].some((value) => value !== null)).length

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <Link href={`/admin/challenges/platform/${challenge.platform_id}`} className="text-sm font-medium text-slate-600">← Volver a {platform.name}</Link>
        <div className="mb-6 mt-5 flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-slate-500">{platform.name}</p><h1 className="text-3xl font-bold">{challenge.name}</h1><div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-slate-900 px-3 py-1 text-white">{challenge.status}</span><span className="rounded-full bg-white px-3 py-1 text-slate-700">{challenge.challenge_type ?? 'Tipo pendiente'}</span><span className="rounded-full bg-white px-3 py-1 text-slate-700">{challenge.phases === null ? 'Fases pendientes' : challenge.phases === 0 ? 'Instant / 0 fases' : `${challenge.phases} fases`}</span></div></div></div>

        <nav className="mb-6 flex gap-2 overflow-x-auto rounded-xl border bg-white p-2 text-sm font-semibold" aria-label="Secciones del Challenge"><a href="#general" className="rounded-lg bg-slate-900 px-4 py-2 text-white">General</a><a href="#planes" className="rounded-lg px-4 py-2 text-slate-700 hover:bg-slate-100">Planes</a><a href="#fases" className="rounded-lg px-4 py-2 text-slate-700 hover:bg-slate-100">Fases</a><a href="#variantes" className="rounded-lg px-4 py-2 text-slate-700 hover:bg-slate-100">Variantes</a><a href="#rewards" className="rounded-lg px-4 py-2 text-slate-700 hover:bg-slate-100">Rewards</a></nav>

        <div className="grid gap-6">
          <section id="general" className="scroll-mt-24 rounded-xl bg-white p-5 shadow sm:p-6"><div className="mb-6"><h2 className="text-xl font-bold">General</h2><p className="mt-1 text-sm text-slate-500">Identidad, clasificación, fases declaradas y publicación.</p></div><ChallengeGeneralForm challenge={challenge} platforms={platformsResult.data ?? []} normalizedPhaseCount={resolved.basePhases.length} /></section>

          <section id="planes" className="scroll-mt-24 rounded-xl bg-white p-5 shadow sm:p-6"><AccountPlansManager challengeId={id} platformSlug={platform.slug} plans={plans} variants={(variantsResult.data ?? []) as ChallengeVariant[]} hasNormalizedPhases={resolved.hasNormalizedPhases} /></section>

          <section id="fases" className="scroll-mt-24 rounded-xl bg-white p-5 shadow sm:p-6"><ChallengePhasesManager challengeId={id} challengeName={challenge.name} platformSlug={platform.slug} declaredPhases={challenge.phases} phases={phases} variantIds={variantIds} legacyPlanCount={legacyPlanCount} /></section>

          <section id="variantes" className="scroll-mt-24 rounded-xl bg-white p-5 shadow sm:p-6"><ChallengeVariantsManager challengeId={id} challengeName={challenge.name} platformSlug={platform.slug} variants={(variantsResult.data ?? []) as EditableChallengeVariant[]} plans={plans} phases={phases} overrides={(variantPhasesResult.data ?? []) as ChallengeVariantPhase[]} rewards={(rewardOptionsResult.data ?? []) as ChallengeRewardOption[]} hasNormalizedPhases={resolved.hasNormalizedPhases} /></section>

          <section id="rewards" className="scroll-mt-24 rounded-xl bg-white p-5 shadow sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Reward principal</h2><p className="mt-1 text-sm text-slate-500">Profit split, frecuencia y espera mínima visibles públicamente.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Edición en próxima etapa</span></div><RewardScope challengeId={id} title="General" options={resolved.generalRewardOptions} />{resolved.variants.filter((variant) => variant.rewardOptionsSource === 'specific').map((variant) => <RewardScope challengeId={id} key={variant.id} title={variant.name} options={variant.rewardOptions} />)}{!resolved.generalRewardOptions.length && !resolved.variants.some((variant) => variant.rewardOptionsSource === 'specific') && <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No hay rewards normalizados visibles.</p>}</section>

          <details className="rounded-xl bg-white p-5 shadow sm:p-6"><summary className="cursor-pointer text-xl font-bold">Detalles avanzados</summary><p className="mt-2 text-sm text-slate-500">Reglas efectivas, campos legacy y trazabilidad.</p><div className="mt-6 space-y-6 border-t pt-6"><section><h3 className="font-semibold">Fuente y reglas completas de las fases</h3>{resolved.hasNormalizedPhases ? <AdminPhaseTable phases={resolved.basePhases} /> : <p className="mt-3 text-sm text-slate-500">Sin fases normalizadas.</p>}</section><LegacyPlansTable plans={plans} variantName={variantName} /><section><h3 className="font-semibold">Reglas efectivas por variante</h3><div className="mt-4 space-y-5">{resolved.variants.map((variant) => <article key={variant.id} className="rounded-xl border p-5"><h4 className="font-bold">{variant.name}</h4><AdminPhaseTable phases={variant.effectivePhases} /></article>)}{!resolved.variants.length && <p className="text-sm text-slate-500">No hay variantes registradas.</p>}</div></section></div></details>
        </div>
      </div>
    </main>
  )
}

function AdminPhaseTable({ phases }: { phases: EffectivePhase[] }) {
  return <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="border-b bg-slate-50"><tr><th className="px-4 py-3 text-left">Fase</th><th className="px-4 py-3 text-left">Target</th><th className="px-4 py-3 text-left">Daily DD</th><th className="px-4 py-3 text-left">Max DD</th><th className="px-4 py-3 text-left">Mín. días</th><th className="px-4 py-3 text-left">Días rentables</th><th className="px-4 py-3 text-left">Tipo / base</th></tr></thead><tbody>{phases.map((phase) => <tr key={phase.phaseNumber} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{phase.name || `Fase ${phase.phaseNumber}`}</td><td className="px-4 py-3">{formatPercent(phase.profitTarget)}</td><td className="px-4 py-3">{formatPercent(phase.dailyDrawdown)}</td><td className="px-4 py-3">{formatPercent(phase.maxDrawdown)}</td><td className="px-4 py-3">{phase.minTradingDays ?? '—'}</td><td className="px-4 py-3">{phase.minProfitableDays ?? '—'}</td><td className="px-4 py-3">{[phase.drawdownType, phase.drawdownBasis].filter(Boolean).join(' · ') || '—'}</td></tr>)}</tbody></table></div>
}

function formatPercent(value: number | null) { return value === null ? '—' : `${value}%` }

function AdminRewardOptions({ challengeId, options }: { challengeId: string; options: ChallengeRewardOption[] }) {
  if (!options.length) return <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No hay reward options visibles en este ámbito.</p>
  return <div className="mt-3 grid gap-3 md:grid-cols-2">{options.map((option) => <article key={option.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold">{option.name}</h4><p className="mt-1 text-sm text-slate-500">{option.payout_frequency ?? 'Frecuencia pendiente'}</p></div><div className="flex flex-col items-end gap-2"><strong className="text-xl text-emerald-700">{formatPercent(option.profit_split)}</strong><TranslationWorkflowLink resourceType="challenge_reward_translation" resourceId={option.id} label="Traducciones" returnTo={`/admin/challenges/${challengeId}#rewards`}/></div></div><p className="mt-3 text-sm"><span className="text-slate-500">Espera mínima:</span> {option.minimum_payout_days === null ? '—' : `${option.minimum_payout_days} días`}</p><details className="mt-4 border-t pt-3 text-sm"><summary className="cursor-pointer font-medium text-slate-600">Detalles avanzados del reward</summary><dl className="mt-3 grid gap-2 text-slate-600"><RewardDetail label="Días rentables" value={option.minimum_profitable_days} /><RewardDetail label="Threshold rentable" value={option.profitable_day_threshold_pct === null ? null : `${option.profitable_day_threshold_pct}%`} /><RewardDetail label="Consistencia" value={option.consistency_rule_pct === null ? null : `${option.consistency_rule_pct}%`} /><RewardDetail label="Vigente desde" value={option.effective_from} /><RewardDetail label="Vigente hasta" value={option.effective_to} /></dl>{option.notes && <p className="mt-3 whitespace-pre-line text-slate-600">{option.notes}</p>}{option.source_url && <Link href={option.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex font-medium text-blue-700">Ver fuente</Link>}</details></article>)}</div>
}

function RewardScope({ challengeId, title, options }: { challengeId: string; title: string; options: ChallengeRewardOption[] }) {
  if (!options.length) return null
  return <div className="mt-5"><h3 className="text-sm font-semibold text-slate-700">{title}</h3><AdminRewardOptions challengeId={challengeId} options={options} /></div>
}

function RewardDetail({ label, value }: { label: string; value: string | number | null }) {
  if (value === null || value === '') return null
  return <div className="flex justify-between gap-4"><dt>{label}</dt><dd className="text-right font-medium">{value}</dd></div>
}

function LegacyPlansTable({ plans, variantName }: { plans: AccountPlan[]; variantName: Map<string, string> }) {
  return <section><h3 className="font-semibold">Campos legacy duplicados por cuenta</h3><p className="mt-1 text-sm text-slate-500">Se conservan para compatibilidad; las fases normalizadas tienen prioridad.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50"><tr><th className="px-3 py-2 text-left">Cuenta</th><th className="px-3 py-2 text-left">Variante</th><th className="px-3 py-2 text-left">Target</th><th className="px-3 py-2 text-left">Daily DD</th><th className="px-3 py-2 text-left">Max DD</th><th className="px-3 py-2 text-left">Mín. días</th><th className="px-3 py-2 text-left">Split</th><th className="px-3 py-2 text-left">Frecuencia</th></tr></thead><tbody>{plans.map((plan) => <tr key={plan.id} className="border-b last:border-0"><td className="px-3 py-2">{plan.account_size === null ? '—' : `$${plan.account_size.toLocaleString()}`}</td><td className="px-3 py-2">{plan.variant_id ? variantName.get(plan.variant_id) ?? 'Desconocida' : 'Base'}</td><td className="px-3 py-2">{formatPercent(plan.profit_target)}</td><td className="px-3 py-2">{formatPercent(plan.daily_drawdown)}</td><td className="px-3 py-2">{formatPercent(plan.max_drawdown)}</td><td className="px-3 py-2">{plan.min_trading_days ?? '—'}</td><td className="px-3 py-2">{formatPercent(plan.profit_split)}</td><td className="px-3 py-2">{plan.payout_frequency ?? '—'}</td></tr>)}{!plans.length && <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">No hay campos legacy.</td></tr>}</tbody></table></div></section>
}
