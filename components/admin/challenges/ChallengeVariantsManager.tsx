'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { mutateChallengeResource } from '@/app/admin/challenges/resource-actions'
import { useAdminPermission } from '@/components/admin/AdminPermissionsProvider'
import { orphanVariantOverrides, overridesForVariant, variantDependencyMessage, type VariantDependencyCounts } from '@/lib/challenge-admin'
import { VariantForm, type EditableChallengeVariant } from './VariantForm'
import { AccountPlansManager } from './AccountPlansManager'
import type { EditableAccountPlan } from './AccountPlanForm'
import type { EditableChallengePhase } from './PhaseForm'
import { VariantPhaseOverrideForm } from './VariantPhaseOverrideForm'
import type { ChallengeVariantPhase } from '@/lib/challenge-resolver'
import { TranslationWorkflowLink } from '@/components/admin/translations/TranslationWorkflowLink'

type Relation = { variant_id: string | null }

export function ChallengeVariantsManager({ challengeId, challengeName, variants, plans, phases, overrides, rewards, hasNormalizedPhases }: {
  challengeId: string
  challengeName: string
  variants: EditableChallengeVariant[]
  plans: EditableAccountPlan[]
  phases: EditableChallengePhase[]
  overrides: ChallengeVariantPhase[]
  rewards: Relation[]
  hasNormalizedPhases: boolean
}) {
  const router = useRouter()
  const canCreate = useAdminPermission('challenges.create')
  const canUpdate = useAdminPermission('challenges.update')
  const canDelete = useAdminPermission('challenges.delete')
  const [mode, setMode] = useState<'closed' | 'create' | string>('closed')
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const editing = variants.find((variant) => variant.id === mode)

  function counts(variantId: string): VariantDependencyCounts {
    return {
      plans: plans.filter((item) => item.variant_id === variantId).length,
      overrides: overrides.filter((item) => item.variant_id === variantId).length,
      rewards: rewards.filter((item) => item.variant_id === variantId).length,
    }
  }

  async function toggle(variant: EditableChallengeVariant) {
    if (!canUpdate) return
    setWorkingId(variant.id)
    setError('')
    const result = await mutateChallengeResource({ operation: 'toggle_variant', id: variant.id, challengeId, status: !variant.status, expectedUpdatedAt: variant.updated_at })
    if (!result.ok) { setError(result.message); setWorkingId(null); return }
    try {
      router.refresh()
    } catch {
      setError('El estado cambió, pero no pudo actualizarse la pantalla.')
    } finally { setWorkingId(null) }
  }

  async function remove(variant: EditableChallengeVariant) {
    if (!canDelete) return
    setWorkingId(variant.id)
    setError('')
    if (!window.confirm(`¿Eliminar definitivamente la variante “${variant.name}” del Challenge “${challengeName}”? Esta acción no se puede deshacer.`)) { setWorkingId(null); return }
    const result = await mutateChallengeResource({ operation: 'delete_variant', id: variant.id, challengeId })
    if (!result.ok) { setError(result.message); setWorkingId(null); return }
    try {
      if (mode === variant.id) setMode('closed')
      router.refresh()
    } catch {
      setError('La variante se eliminó, pero no pudo actualizarse la pantalla.')
    } finally { setWorkingId(null) }
  }

  return <div>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Variantes</h2><p className="mt-1 text-sm text-slate-500">Opciones del Challenge, estado y dependencias asociadas.</p></div>{canCreate && <button onClick={() => setMode(mode === 'create' ? 'closed' : 'create')} className="admin-primary-button px-4 py-2.5 text-sm">+ Nueva variante</button>}</div>
    {mode === 'create' && <Editor title="Crear variante"><VariantForm challengeId={challengeId} variants={variants} onDone={() => setMode('closed')} /></Editor>}
    {editing && <Editor title={`Editar ${editing.name}`}><VariantForm challengeId={challengeId} variants={variants} initial={editing} onDone={() => setMode('closed')} /></Editor>}
    {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="mt-5 space-y-4">{variants.map((variant) => {
      const dependencyCounts = counts(variant.id)
      const variantOverrides = overridesForVariant(overrides, variant.id)
      const orphanOverrides = orphanVariantOverrides(variantOverrides, phases.map((phase) => phase.phase_number))
      return <article key={variant.id} className={`rounded-xl border p-5 ${variant.status ? 'border-slate-200' : 'border-slate-200 bg-slate-50'}`}>
        <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold">{variant.name}</h3><Status active={variant.status} /></div><p className="mt-1 font-mono text-xs text-slate-500">{variant.slug}</p></div><div className="flex flex-wrap gap-2">{canUpdate && <><TranslationWorkflowLink resourceType="challenge_variant_translation" resourceId={variant.id} label="Traducciones" returnTo={`/admin/challenges/${challengeId}#variantes`}/><button onClick={() => setMode(variant.id)} className="admin-secondary-button px-3 py-2 text-xs">Editar</button><button disabled={workingId === variant.id} onClick={() => void toggle(variant)} className="admin-secondary-button px-3 py-2 text-xs">{variant.status ? 'Desactivar' : 'Activar'}</button></>}{canDelete && <button disabled={workingId === variant.id} onClick={() => void remove(variant)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">Eliminar</button>}{!canUpdate && !canDelete && <span className="text-xs text-slate-400">Solo lectura</span>}</div></div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><Fact label="Profit split" value={variant.profit_split === null ? 'Sin dato' : `${variant.profit_split}%`} /><Fact label="Modificador de precio" value={variant.price_modifier === null ? 'Sin dato' : String(variant.price_modifier)} /><Fact label="Frecuencia" value={variant.payout_frequency ?? 'Sin dato'} /><Fact label="Dependencias" value={`${dependencyCounts.plans} planes · ${dependencyCounts.overrides} overrides · ${dependencyCounts.rewards} rewards`} /></dl>
        {variant.notes && <p className="mt-4 whitespace-pre-line border-t pt-4 text-sm text-slate-600">{variant.notes}</p>}
        {variantDependencyMessage(dependencyCounts) && <p className="mt-4 text-xs text-amber-800">La eliminación está protegida mientras existan dependencias. Puedes desactivar la variante.</p>}
        <div className="mt-5 border-t border-slate-200 pt-5"><AccountPlansManager challengeId={challengeId} plans={plans} variants={variants} hasNormalizedPhases={hasNormalizedPhases} scopeVariantId={variant.id} scopeVariantName={variant.name} compact /></div>
        <details className="mt-5 border-t border-slate-200 pt-5">
          <summary className="cursor-pointer font-bold text-slate-900">Phase Overrides <span className="ml-2 text-xs font-normal text-slate-500">{variantOverrides.length} registrados</span></summary>
          {!phases.length ? <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Este Challenge no tiene fases normalizadas. No hay Phase Overrides disponibles para esta variante.</p> : <div className="mt-4 space-y-4">{phases.map((phase) => {
            const existingOverride = variantOverrides.find((item) => item.phase_number === phase.phase_number)
            return <section key={phase.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-semibold">Fase {phase.phase_number}{phase.name ? ` — ${phase.name}` : ''}</h4><p className="mt-1 text-xs text-slate-500">{existingOverride ? 'Override parcial registrado' : 'Herencia completa del Challenge base'}</p></div><div className="flex flex-wrap items-center gap-2">{canUpdate && existingOverride && <TranslationWorkflowLink resourceType="challenge_variant_phase_translation" resourceId={existingOverride.id} label="Traducciones" returnTo={`/admin/challenges/${challengeId}#variantes`}/>}<span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${existingOverride ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-800'}`}>{existingOverride ? 'Personalizada' : 'Heredada'}</span></div></div><VariantPhaseOverrideForm key={existingOverride?.id ?? 'inherited'} variantId={variant.id} basePhase={phase} existingOverride={existingOverride} /></section>
          })}</div>}
          {orphanOverrides.length > 0 && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="font-semibold">Overrides huérfanos detectados</p>{orphanOverrides.map((override) => <p key={override.id} className="mt-1">Override huérfano: Phase {override.phase_number} ya no existe en las fases base. No fue modificado automáticamente.</p>)}</div>}
        </details>
        <div className="mt-5 border-t border-slate-200 pt-5"><h4 className="font-bold text-slate-900">Rewards</h4><p className="mt-1 text-sm text-slate-500">{dependencyCounts.rewards} reward{dependencyCounts.rewards === 1 ? '' : 's'} asociado{dependencyCounts.rewards === 1 ? '' : 's'}. Edición disponible en la Etapa E.</p></div>
      </article>
    })}{!variants.length && <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">No hay variantes registradas.</p>}</div>
  </div>
}

function Editor({ title, children }: { title: string; children: React.ReactNode }) { return <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/40 p-5"><h3 className="mb-4 font-semibold">{title}</h3>{children}</div> }
function Status({ active }: { active: boolean }) { return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>{active ? 'Activa' : 'Inactiva'}</span> }
function Fact({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-800">{value}</dd></div> }
