'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { mutateChallengeResource } from '@/app/admin/challenges/resource-actions'
import { useAdminPermission } from '@/components/admin/AdminPermissionsProvider'
import {
  effectiveVariantPhaseValue,
  hasVariantPhaseOverride,
  isValidOptionalNonNegativeInteger,
  isValidOptionalNonNegativeNumber,
  isValidVariantOverrideDrawdownBasis,
  isValidVariantOverrideDrawdownType,
  optionalInteger,
  optionalNumber,
  type VariantPhaseOverrideValues,
} from '@/lib/challenge-admin'
import type { ChallengeVariantPhase } from '@/lib/challenge-resolver'
import type { EditableChallengePhase } from './PhaseForm'

type Props = {
  variantId: string
  basePhase: EditableChallengePhase
  existingOverride?: ChallengeVariantPhase
}

export function VariantPhaseOverrideForm({ variantId, basePhase, existingOverride }: Props) {
  const router = useRouter()
  const canCreate = useAdminPermission('challenges.create')
  const canUpdate = useAdminPermission('challenges.update')
  const canDelete = useAdminPermission('challenges.delete')
  const [profitTarget, setProfitTarget] = useState(value(existingOverride?.profit_target))
  const [dailyDrawdown, setDailyDrawdown] = useState(value(existingOverride?.daily_drawdown))
  const [maxDrawdown, setMaxDrawdown] = useState(value(existingOverride?.max_drawdown))
  const [minTradingDays, setMinTradingDays] = useState(value(existingOverride?.min_trading_days))
  const [minProfitableDays, setMinProfitableDays] = useState(value(existingOverride?.min_profitable_days))
  const [drawdownType, setDrawdownType] = useState(existingOverride?.drawdown_type ?? '')
  const [drawdownBasis, setDrawdownBasis] = useState(existingOverride?.drawdown_basis ?? '')
  const [notes, setNotes] = useState(existingOverride?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const canSave = existingOverride ? canUpdate : canCreate

  function values(): VariantPhaseOverrideValues {
    return {
      profit_target: optionalNumber(profitTarget),
      daily_drawdown: optionalNumber(dailyDrawdown),
      max_drawdown: optionalNumber(maxDrawdown),
      min_trading_days: optionalInteger(minTradingDays),
      min_profitable_days: optionalInteger(minProfitableDays),
      drawdown_type: drawdownType || null,
      drawdown_basis: drawdownBasis || null,
      notes: notes.trim() || null,
    }
  }

  function validate(payload: VariantPhaseOverrideValues) {
    const numeric = [payload.profit_target, payload.daily_drawdown, payload.max_drawdown]
    if (numeric.some((item) => !isValidOptionalNonNegativeNumber(item))) return 'Target y drawdowns deben ser números iguales o mayores que cero.'
    if (![minTradingDays, minProfitableDays].every((item) => item.trim() === '' || Number.isInteger(Number(item)))) return 'Los días deben ser números enteros.'
    if (!isValidOptionalNonNegativeInteger(payload.min_trading_days) || !isValidOptionalNonNegativeInteger(payload.min_profitable_days)) return 'Los días deben ser enteros iguales o mayores que cero.'
    if (!isValidVariantOverrideDrawdownType(payload.drawdown_type)) return 'El tipo de drawdown seleccionado no es válido para un override.'
    if (!isValidVariantOverrideDrawdownBasis(payload.drawdown_basis)) return 'La base del drawdown seleccionada no es válida.'
    return null
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    const payload = values()
    const validationError = validate(payload)
    if (validationError) return setError(validationError)
    if (!hasVariantPhaseOverride(payload)) {
      if (!existingOverride) return setNotice('La fase ya hereda completamente del Challenge base; no se creó ninguna fila.')
      if (!canDelete) return setError('Restaurar la herencia completa elimina físicamente el override y requiere el permiso challenges.delete.')
      return removeOverride(false)
    }
    if (!canSave) return setError(`No tienes permiso para ${existingOverride ? 'actualizar' : 'crear'} este override.`)

    setSaving(true)
    const result = await mutateChallengeResource({ operation: 'save_override', id: existingOverride?.id, variantId, phaseNumber: basePhase.phase_number, profitTarget: payload.profit_target, dailyDrawdown: payload.daily_drawdown, maxDrawdown: payload.max_drawdown, minTradingDays: payload.min_trading_days, minProfitableDays: payload.min_profitable_days, drawdownType: payload.drawdown_type, drawdownBasis: payload.drawdown_basis, notes: payload.notes })
    if (!result.ok) { setError(result.message); setSaving(false); return }
    await finish('Override guardado.')
  }

  async function removeOverride(confirm = true) {
    if (!existingOverride || !canDelete) return
    if (confirm && !window.confirm(`¿Restaurar la herencia completa de la fase ${basePhase.phase_number}? Se eliminará su fila de override.`)) return
    setSaving(true)
    setError('')
    setNotice('')
    const result = await mutateChallengeResource({ operation: 'delete_override', id: existingOverride.id, variantId, phaseNumber: basePhase.phase_number })
    if (!result.ok) { setError(result.message); setSaving(false); return }
    await finish('Herencia completa restaurada.')
  }

  async function finish(message: string) {
    try {
      setNotice(message)
      router.refresh()
    } catch {
      setError('El cambio se guardó, pero no pudo actualizarse la pantalla.')
    } finally {
      setSaving(false)
    }
  }

  const current = values()
  return <form onSubmit={submit} className="mt-4 space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <OverrideInput label="Profit Target %" base={basePhase.profit_target} value={profitTarget} set={setProfitTarget} effective={effectiveVariantPhaseValue(current.profit_target, basePhase.profit_target)} />
      <OverrideInput label="Daily Drawdown %" base={basePhase.daily_drawdown} value={dailyDrawdown} set={setDailyDrawdown} effective={effectiveVariantPhaseValue(current.daily_drawdown, basePhase.daily_drawdown)} />
      <OverrideInput label="Max Drawdown %" base={basePhase.max_drawdown} value={maxDrawdown} set={setMaxDrawdown} effective={effectiveVariantPhaseValue(current.max_drawdown, basePhase.max_drawdown)} />
      <OverrideInput label="Mínimo días" base={basePhase.min_trading_days} value={minTradingDays} set={setMinTradingDays} effective={effectiveVariantPhaseValue(current.min_trading_days, basePhase.min_trading_days)} integer />
      <OverrideInput label="Días rentables mínimos" base={basePhase.min_profitable_days} value={minProfitableDays} set={setMinProfitableDays} effective={effectiveVariantPhaseValue(current.min_profitable_days, basePhase.min_profitable_days)} integer />
      <OverrideSelect label="Tipo de drawdown" base={basePhase.drawdown_type} value={drawdownType} set={setDrawdownType} effective={effectiveVariantPhaseValue(current.drawdown_type, basePhase.drawdown_type)} options={[['static', 'Static'], ['trailing', 'Trailing'], ['dynamic', 'Dynamic']]} />
      <OverrideSelect label="Base del drawdown" base={basePhase.drawdown_basis} value={drawdownBasis} set={setDrawdownBasis} effective={effectiveVariantPhaseValue(current.drawdown_basis, basePhase.drawdown_basis)} options={[['balance', 'Balance'], ['equity', 'Equity'], ['balance_or_equity', 'Balance o Equity']]} />
    </div>
    <label><span className="mb-1 block text-sm font-semibold">Notas</span><p className="mb-2 text-xs text-slate-500">Base: {basePhase.notes ?? 'Sin dato'} · Efectivo: {effectiveVariantPhaseValue(current.notes, basePhase.notes) ?? 'Sin dato'}</p><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className={INPUT} placeholder="Vacío = Heredar" disabled={!canSave} /></label>
    {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <div className="flex flex-wrap gap-2">
      {canSave && <button disabled={saving} className="admin-primary-button px-4 py-2 text-xs">{saving ? 'Guardando…' : existingOverride ? 'Guardar override' : 'Crear override'}</button>}
      {existingOverride && canDelete && <button type="button" disabled={saving} onClick={() => void removeOverride()} className="rounded-lg border border-amber-300 px-4 py-2 text-xs font-semibold text-amber-900">Restaurar herencia completa</button>}
      {!canSave && !(existingOverride && canDelete) && <span className="text-xs text-slate-400">Solo lectura</span>}
    </div>
  </form>
}

function value(input: number | null | undefined) { return input === null || input === undefined ? '' : String(input) }
const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:bg-slate-100'
function display(value: string | number | null) { return value === null || value === '' ? 'Sin dato' : String(value) }
function OverrideInput({ label, base, value: input, set, effective, integer = false }: { label: string; base: number | null; value: string; set: (value: string) => void; effective: number | null; integer?: boolean }) { return <label><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs text-slate-500">Base: {display(base)} · Efectivo: {display(effective)}</span><input type="number" min="0" step={integer ? '1' : 'any'} value={input} onChange={(event) => set(event.target.value)} className={`${INPUT} mt-2`} placeholder={`Heredar: ${display(base)}`} /></label> }
function OverrideSelect({ label, base, value: input, set, effective, options }: { label: string; base: string | null; value: string; set: (value: string) => void; effective: string | null; options: Array<[string, string]> }) { return <label><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs text-slate-500">Base: {display(base)} · Efectivo: {display(effective)}</span><select value={input} onChange={(event) => set(event.target.value)} className={`${INPUT} mt-2`}><option value="">Heredar — {display(base)}</option>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label> }
