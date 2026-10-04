'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useAdminPermission } from '@/components/admin/AdminPermissionsProvider'
import { plansForVariant, revalidateChallengeData } from '@/lib/challenge-admin'
import { AccountPlanForm, type EditableAccountPlan } from './AccountPlanForm'

type Variant = { id: string; name: string; status: boolean }

export function AccountPlansManager({ challengeId, platformSlug, plans, variants, hasNormalizedPhases, scopeVariantId, scopeVariantName, compact = false }: {
  challengeId: string
  platformSlug: string
  plans: EditableAccountPlan[]
  variants: Variant[]
  hasNormalizedPhases: boolean
  scopeVariantId?: string
  scopeVariantName?: string
  compact?: boolean
}) {
  const router = useRouter()
  const canCreate = useAdminPermission('challenges.create')
  const canUpdate = useAdminPermission('challenges.update')
  const canDelete = useAdminPermission('challenges.delete')
  const [mode, setMode] = useState<'closed' | 'create' | string>('closed')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const variantNames = new Map(variants.map((variant) => [variant.id, variant.name]))
  const visiblePlans = scopeVariantId ? plansForVariant(plans, scopeVariantId) : plans
  const editing = visiblePlans.find((plan) => plan.id === mode)

  async function remove(plan: EditableAccountPlan) {
    if (!canDelete) return
    const scope = plan.variant_id ? variantNames.get(plan.variant_id) ?? 'variante desconocida' : 'plan general'
    if (!window.confirm(`¿Eliminar el plan ${money(plan.account_size)} ${plan.currency ?? 'sin moneda'} (${scope})? Esta acción no se puede deshacer.`)) return
    setDeletingId(plan.id)
    setError('')
    const result = await createClient().from('account_plans').delete().eq('id', plan.id).eq('challenge_id', challengeId)
    if (result.error) { setError(result.error.message); setDeletingId(null); return }
    try {
      await revalidateChallengeData('delete', [platformSlug])
      if (mode === plan.id) setMode('closed')
      router.refresh()
    } catch (revalidationError) {
      setError(revalidationError instanceof Error ? `El plan se eliminó, pero ${revalidationError.message}` : 'El plan se eliminó, pero no se pudo revalidar.')
    } finally { setDeletingId(null) }
  }

  return <div>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className={compact ? 'text-base font-bold' : 'text-xl font-bold'}>{scopeVariantId ? 'Account Plans' : 'Planes de cuenta'}</h2><p className="mt-1 text-sm text-slate-500">{scopeVariantId ? `Planes asociados exclusivamente a ${scopeVariantName ?? 'esta variante'}.` : 'Tamaño, precio, moneda, variante y modo de reglas.'}</p></div>{canCreate && <button onClick={() => setMode(mode === 'create' ? 'closed' : 'create')} className="admin-primary-button px-4 py-2.5 text-sm">{scopeVariantId ? '+ Nuevo plan para esta variante' : '+ Nuevo plan'}</button>}</div>
    {mode === 'create' && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/40 p-5"><h3 className="mb-4 font-semibold">Crear plan</h3><AccountPlanForm challengeId={challengeId} platformSlug={platformSlug} variants={variants} hasNormalizedPhases={hasNormalizedPhases} lockedVariantId={scopeVariantId} onDone={() => setMode('closed')} /></div>}
    {editing && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/40 p-5"><h3 className="mb-4 font-semibold">Editar plan {money(editing.account_size)}</h3><AccountPlanForm challengeId={challengeId} platformSlug={platformSlug} variants={variants} hasNormalizedPhases={hasNormalizedPhases} initial={editing} lockedVariantId={scopeVariantId} onDone={() => setMode('closed')} /></div>}
    {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="mt-5 overflow-x-auto"><table className={`w-full text-sm ${compact ? 'min-w-[720px]' : 'min-w-[840px]'}`}><thead className="border-b bg-slate-50 text-left"><tr><th className="px-4 py-3">Cuenta</th><th className="px-4 py-3">Precio</th><th className="px-4 py-3">Moneda</th>{!scopeVariantId && <th className="px-4 py-3">Variante</th>}<th className="px-4 py-3">Modo de reglas</th><th className="px-4 py-3">Acciones</th></tr></thead><tbody>{visiblePlans.map((plan) => <tr key={plan.id} className="border-b last:border-0"><td className="px-4 py-3 font-semibold">{money(plan.account_size)}</td><td className="px-4 py-3">{plan.price === null ? 'Sin dato' : money(plan.price, plan.currency ?? 'USD')}</td><td className="px-4 py-3">{plan.currency ?? '—'}</td>{!scopeVariantId && <td className="px-4 py-3">{plan.variant_id ? variantNames.get(plan.variant_id) ?? 'Variante no disponible' : 'General'}</td>}<td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${hasNormalizedPhases ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{hasNormalizedPhases ? 'Fases normalizadas' : 'Legacy por plan'}</span></td><td className="px-4 py-3"><div className="flex gap-2">{canUpdate && <button onClick={() => setMode(plan.id)} className="admin-secondary-button px-3 py-2 text-xs">Editar</button>}{canDelete && <button disabled={deletingId === plan.id} onClick={() => void remove(plan)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">{deletingId === plan.id ? 'Eliminando…' : 'Eliminar'}</button>}{!canUpdate && !canDelete && <span className="text-xs text-slate-400">Solo lectura</span>}</div></td></tr>)}{!visiblePlans.length && <tr><td colSpan={scopeVariantId ? 5 : 6} className="px-4 py-10 text-center text-slate-500">{scopeVariantId ? 'Esta variante todavía no tiene Account Plans.' : 'No hay planes registrados.'}</td></tr>}</tbody></table></div>
  </div>
}

function money(value: number | null, currency = 'USD') { return value === null ? 'Sin dato' : new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value) }
