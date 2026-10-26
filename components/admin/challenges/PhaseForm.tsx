'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { mutateChallengeResource } from '@/app/admin/challenges/resource-actions'
import {
  isValidOptionalNonNegativeInteger,
  isValidOptionalNonNegativeNumber,
  isValidPhaseDrawdownBasis,
  isValidPhaseDrawdownType,
  isValidPhaseNumber,
  optionalInteger,
  optionalNumber,
} from '@/lib/challenge-admin'

export type EditableChallengePhase = {
  id: string
  challenge_id: string
  phase_number: number
  name: string | null
  profit_target: number | null
  daily_drawdown: number | null
  max_drawdown: number | null
  min_trading_days: number | null
  max_trading_days: number | null
  min_profitable_days: number | null
  drawdown_type: string | null
  drawdown_basis: string | null
  notes: string | null
  updated_at: string
}

export function PhaseForm({
  challengeId,
  declaredPhases,
  configuredPhaseCount,
  legacyPlanCount,
  initial,
  onDone,
}: {
  challengeId: string
  declaredPhases: number | null
  configuredPhaseCount: number
  legacyPlanCount: number
  initial?: EditableChallengePhase
  onDone: () => void
}) {
  const router = useRouter()
  const [phaseNumber, setPhaseNumber] = useState(String(initial?.phase_number ?? Math.max(1, configuredPhaseCount + 1)))
  const [name, setName] = useState(initial?.name ?? '')
  const [profitTarget, setProfitTarget] = useState(value(initial?.profit_target))
  const [dailyDrawdown, setDailyDrawdown] = useState(value(initial?.daily_drawdown))
  const [maxDrawdown, setMaxDrawdown] = useState(value(initial?.max_drawdown))
  const [minTradingDays, setMinTradingDays] = useState(value(initial?.min_trading_days))
  const [maxTradingDays, setMaxTradingDays] = useState(value(initial?.max_trading_days))
  const [minProfitableDays, setMinProfitableDays] = useState(value(initial?.min_profitable_days))
  const [drawdownType, setDrawdownType] = useState(initial?.drawdown_type ?? '')
  const [drawdownBasis, setDrawdownBasis] = useState(initial?.drawdown_basis ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [acknowledgedZeroPhase, setAcknowledgedZeroPhase] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    const parsedPhaseNumber = Number(phaseNumber)
    const profit = optionalNumber(profitTarget)
    const daily = optionalNumber(dailyDrawdown)
    const maximum = optionalNumber(maxDrawdown)
    const minDays = optionalInteger(minTradingDays)
    const maxDays = optionalInteger(maxTradingDays)
    const profitableDays = optionalInteger(minProfitableDays)
    const type = drawdownType || null
    const basis = drawdownBasis || null

    if (!isValidPhaseNumber(parsedPhaseNumber)) return setError('El número de fase debe ser un entero mayor o igual a 1.')
    if (!isValidOptionalNonNegativeNumber(profit)) return setError('El Profit Target debe ser cero o mayor.')
    if (!isValidOptionalNonNegativeNumber(daily)) return setError('El Daily Drawdown debe ser cero o mayor.')
    if (!isValidOptionalNonNegativeNumber(maximum)) return setError('El Max Drawdown debe ser cero o mayor.')
    if (!isValidOptionalNonNegativeInteger(minDays) || !isIntegerInput(minTradingDays)) return setError('Los días mínimos deben ser un entero mayor o igual a cero.')
    if (!isValidOptionalNonNegativeInteger(maxDays) || !isIntegerInput(maxTradingDays)) return setError('Los días máximos deben ser un entero mayor o igual a cero.')
    if (!isValidOptionalNonNegativeInteger(profitableDays) || !isIntegerInput(minProfitableDays)) return setError('Los días rentables mínimos deben ser un entero mayor o igual a cero.')
    if (!isValidPhaseDrawdownType(type)) return setError('El tipo de drawdown no es válido.')
    if (!isValidPhaseDrawdownBasis(basis)) return setError('La base del drawdown no es válida.')
    if (!initial && declaredPhases === 0 && !acknowledgedZeroPhase) return setError('Confirma la inconsistencia antes de crear una fase en un Challenge declarado con 0 fases.')

    setSaving(true)
    try {
      const result = await mutateChallengeResource({ operation: 'save_phase', id: initial?.id, challengeId, phaseNumber: parsedPhaseNumber, name: name.trim() || null, profitTarget: profit, dailyDrawdown: daily, maxDrawdown: maximum, minTradingDays: minDays, maxTradingDays: maxDays, minProfitableDays: profitableDays, drawdownType: type, drawdownBasis: basis, notes: notes.trim() || null, expectedUpdatedAt: initial?.updated_at })
      if (!result.ok) return setError(result.message)
      router.refresh()
      onDone()
    } catch {
      setError('No se pudo completar la operación.')
    } finally {
      setSaving(false)
    }
  }

  const creatingFirstPhase = !initial && configuredPhaseCount === 0
  return <form onSubmit={submit} className="space-y-5">
    {creatingFirstPhase && legacyPlanCount > 0 && <Warning strong>Al crear fases normalizadas, estas pasarán a ser la fuente principal de reglas y los valores legacy de los planes dejarán de tener prioridad. Hay {legacyPlanCount} plan{legacyPlanCount === 1 ? '' : 'es'} con reglas legacy; no se modificarán.</Warning>}
    {!initial && declaredPhases === 0 && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p className="font-semibold">Inconsistencia: este Challenge declara 0 fases.</p><p className="mt-1">La fase puede crearse, pero el conteo declarado no se modificará automáticamente.</p><label className="mt-3 flex items-start gap-2 font-medium"><input type="checkbox" checked={acknowledgedZeroPhase} onChange={(event) => setAcknowledgedZeroPhase(event.target.checked)} className="mt-0.5" />Entiendo y quiero crear una fase normalizada.</label></div>}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Input label="Número de fase" type="number" min="1" step="1" value={phaseNumber} set={setPhaseNumber} required />
      <Input label="Nombre" value={name} set={setName} placeholder="Opcional" />
      <Input label="Profit Target %" type="number" min="0" step="any" value={profitTarget} set={setProfitTarget} />
      <Input label="Daily Drawdown %" type="number" min="0" step="any" value={dailyDrawdown} set={setDailyDrawdown} />
      <Input label="Max Drawdown %" type="number" min="0" step="any" value={maxDrawdown} set={setMaxDrawdown} />
      <Input label="Mínimo días" type="number" min="0" step="1" value={minTradingDays} set={setMinTradingDays} />
      <Input label="Máximo días" type="number" min="0" step="1" value={maxTradingDays} set={setMaxTradingDays} />
      <Input label="Días rentables mínimos" type="number" min="0" step="1" value={minProfitableDays} set={setMinProfitableDays} />
      <Select label="Tipo de drawdown" value={drawdownType} set={setDrawdownType} options={[['', 'Sin especificar'], ['static', 'Static'], ['trailing', 'Trailing'], ['dynamic', 'Dynamic'], ['balance_based', 'Balance based'], ['equity_based', 'Equity based']]} />
      <Select label="Base del drawdown" value={drawdownBasis} set={setDrawdownBasis} options={[['', 'Sin especificar'], ['balance', 'Balance'], ['equity', 'Equity'], ['balance_or_equity', 'Balance o Equity']]} />
    </div>
    <label><span className="mb-1.5 block text-sm font-semibold">Notas</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className={INPUT} placeholder="Opcional" /></label>
    {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-3"><button disabled={saving} className="admin-primary-button px-5 py-3 text-sm">{saving ? 'Guardando…' : initial ? 'Guardar fase' : 'Crear fase'}</button><button type="button" disabled={saving} onClick={onDone} className="admin-secondary-button px-5 py-3 text-sm">Cancelar</button></div>
  </form>
}

function value(input: number | null | undefined) { return input === null || input === undefined ? '' : String(input) }
function isIntegerInput(input: string) { return input.trim() === '' || Number.isInteger(Number(input)) }
const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm'
function Input({ label, value, set, ...props }: { label: string; value: string; set: (value: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) { return <label><span className="mb-1.5 block text-sm font-semibold">{label}</span><input {...props} value={value} onChange={(event) => set(event.target.value)} className={INPUT} placeholder={props.placeholder ?? 'Vacío = sin dato'} /></label> }
function Select({ label, value, set, options }: { label: string; value: string; set: (value: string) => void; options: Array<[string, string]> }) { return <label><span className="mb-1.5 block text-sm font-semibold">{label}</span><select value={value} onChange={(event) => set(event.target.value)} className={INPUT}>{options.map(([optionValue, optionLabel]) => <option key={optionValue || 'null'} value={optionValue}>{optionLabel}</option>)}</select></label> }
function Warning({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) { return <div className={`rounded-xl border p-4 text-sm ${strong ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>{children}</div> }
