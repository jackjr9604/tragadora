'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { mutateChallengeResource } from '@/app/admin/challenges/resource-actions'
import { useAdminPermission } from '@/components/admin/AdminPermissionsProvider'
import { phaseConsistencyMessage } from '@/lib/challenge-admin'
import { PhaseForm, type EditableChallengePhase } from './PhaseForm'
import { TranslationWorkflowLink } from '@/components/admin/translations/TranslationWorkflowLink'

export function ChallengePhasesManager({
  challengeId,
  challengeName,
  declaredPhases,
  phases,
  legacyPlanCount,
}: {
  challengeId: string
  challengeName: string
  declaredPhases: number | null
  phases: EditableChallengePhase[]
  legacyPlanCount: number
}) {
  const router = useRouter()
  const canCreate = useAdminPermission('challenges.create')
  const canUpdate = useAdminPermission('challenges.update')
  const canDelete = useAdminPermission('challenges.delete')
  const [mode, setMode] = useState<'closed' | 'create' | string>('closed')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const editing = phases.find((phase) => phase.id === mode)
  const consistency = phaseConsistencyMessage(declaredPhases, phases.length)

  async function remove(phase: EditableChallengePhase) {
    if (!canDelete) return
    setError('')
    const label = phase.name ? `Fase ${phase.phase_number} — ${phase.name}` : `Fase ${phase.phase_number}`
    if (!window.confirm(`¿Eliminar ${label} del Challenge ${challengeName}? Esta acción no se puede deshacer.`)) return
    setDeletingId(phase.id)
    const result = await mutateChallengeResource({ operation: 'delete_phase', id: phase.id, challengeId, phaseNumber: phase.phase_number })
    if (!result.ok) { setError(result.message); setDeletingId(null); return }
    try {
      if (mode === phase.id) setMode('closed')
      router.refresh()
    } catch {
      setError('La fase se eliminó, pero no pudo actualizarse la pantalla.')
    } finally {
      setDeletingId(null)
    }
  }

  return <div>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Fases de evaluación</h2><p className="mt-1 text-sm text-slate-500">Fuente principal para targets, pérdidas y requisitos por fase.</p></div>{canCreate && <button onClick={() => setMode(mode === 'create' ? 'closed' : 'create')} className="admin-primary-button px-4 py-2.5 text-sm">+ Nueva fase</button>}</div>
    {declaredPhases === 0 && phases.length === 0 && <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Este Challenge está configurado sin fases normalizadas.</p>}
    {consistency && <p className={`mt-5 rounded-xl border p-4 text-sm font-medium ${declaredPhases === 0 && phases.length > 0 ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{consistency}</p>}
    {mode === 'create' && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/40 p-5"><h3 className="mb-4 font-semibold">Crear fase</h3><PhaseForm challengeId={challengeId} declaredPhases={declaredPhases} configuredPhaseCount={phases.length} legacyPlanCount={legacyPlanCount} onDone={() => setMode('closed')} /></div>}
    {editing && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/40 p-5"><h3 className="mb-4 font-semibold">Editar fase {editing.phase_number}</h3><PhaseForm challengeId={challengeId} declaredPhases={declaredPhases} configuredPhaseCount={phases.length} legacyPlanCount={legacyPlanCount} initial={editing} onDone={() => setMode('closed')} /></div>}
    {canUpdate && phases.length > 0 && <details className="mt-4 rounded-xl border bg-slate-50 p-4"><summary className="cursor-pointer text-sm font-semibold">Traducciones de las fases ({phases.length})</summary><div className="mt-3 flex flex-wrap gap-2">{phases.map((phase) => <TranslationWorkflowLink key={phase.id} resourceType="challenge_phase_translation" resourceId={phase.id} label={`Fase ${phase.phase_number}`} returnTo={`/admin/challenges/${challengeId}#fases`}/>)}</div></details>}
    {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[1180px] text-sm"><thead className="border-b bg-slate-50 text-left"><tr><th className="px-3 py-3">#</th><th className="px-3 py-3">Nombre</th><th className="px-3 py-3">Target</th><th className="px-3 py-3">Daily DD</th><th className="px-3 py-3">Max DD</th><th className="px-3 py-3">Mín. días</th><th className="px-3 py-3">Máx. días</th><th className="px-3 py-3">Días rentables</th><th className="px-3 py-3">Tipo</th><th className="px-3 py-3">Base</th><th className="px-3 py-3">Acciones</th></tr></thead><tbody>{phases.map((phase) => <tr key={phase.id} className="border-b last:border-0"><td className="px-3 py-3 font-bold">{phase.phase_number}</td><td className="px-3 py-3">{phase.name ?? '—'}</td><td className="px-3 py-3">{percent(phase.profit_target)}</td><td className="px-3 py-3">{percent(phase.daily_drawdown)}</td><td className="px-3 py-3">{percent(phase.max_drawdown)}</td><td className="px-3 py-3">{phase.min_trading_days ?? '—'}</td><td className="px-3 py-3">{phase.max_trading_days ?? '—'}</td><td className="px-3 py-3">{phase.min_profitable_days ?? '—'}</td><td className="px-3 py-3">{phase.drawdown_type ?? '—'}</td><td className="px-3 py-3">{phase.drawdown_basis ?? '—'}</td><td className="px-3 py-3"><div className="flex gap-2">{canUpdate && <button onClick={() => setMode(phase.id)} className="admin-secondary-button px-3 py-2 text-xs">Editar</button>}{canDelete && <button disabled={deletingId === phase.id} onClick={() => void remove(phase)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">{deletingId === phase.id ? 'Eliminando…' : 'Eliminar'}</button>}{!canUpdate && !canDelete && <span className="text-xs text-slate-400">Solo lectura</span>}</div></td></tr>)}{!phases.length && <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-500">No hay fases normalizadas registradas.</td></tr>}</tbody></table></div>
  </div>
}

function percent(value: number | null) { return value === null ? '—' : `${value}%` }
