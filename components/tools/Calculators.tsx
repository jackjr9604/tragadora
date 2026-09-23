'use client'

import { useState } from 'react'

const INPUT = 'mt-2 w-full rounded-xl border border-white/10 bg-[#0b1423] px-4 py-3 text-base text-white outline-none transition focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/10'

export function DrawdownCalculator() {
  const [initial, setInitial] = useState('100000'), [current, setCurrent] = useState('94500'), [maximum, setMaximum] = useState('10'), [daily, setDaily] = useState('')
  const start = number(initial), equity = number(current), percent = clamp(number(maximum), 0, 100)
  const lossLimit = start * (1 - percent / 100), loss = Math.max(0, start - equity), remaining = Math.max(0, equity - lossLimit), consumed = start * percent / 100 > 0 ? clamp(loss / (start * percent / 100) * 100, 0, 100) : 0
  return <CalculatorLayout fields={<><MoneyField label="Balance inicial de la cuenta" value={initial} onChange={setInitial} /><MoneyField label="Balance / equity actual" value={current} onChange={setCurrent} /><NumberField label="Límite máximo de pérdida (%)" value={maximum} onChange={setMaximum} min={0} max={100} /><NumberField label="Límite diario (%) · opcional" value={daily} onChange={setDaily} min={0} max={100} /></>} results={[['Límite mínimo permitido', money(lossLimit)], ['Pérdida actual', money(loss)], ['Margen restante', money(remaining)], ['Drawdown consumido', `${format(consumed)}%`]]} />
}

export function ProfitSplitCalculator() {
  const [profit, setProfit] = useState('10000'), [split, setSplit] = useState('80')
  const total = number(profit), traderPercent = clamp(number(split), 0, 100), trader = total * traderPercent / 100
  return <CalculatorLayout fields={<><MoneyField label="Ganancia" value={profit} onChange={setProfit} /><NumberField label="Split del trader (%)" value={split} onChange={setSplit} min={0} max={100} /></>} results={[['Trader', money(trader)], ['Firma', money(total - trader)]]} />
}

export function ChallengeTargetCalculator() {
  const [initial, setInitial] = useState('100000'), [target, setTarget] = useState('8'), [current, setCurrent] = useState('104500')
  const start = number(initial), percent = clamp(number(target), 0, 100), equity = number(current), targetAmount = start * percent / 100, targetBalance = start + targetAmount, gain = equity - start, missing = Math.max(0, targetBalance - equity), progress = targetAmount > 0 ? clamp(gain / targetAmount * 100, 0, 100) : 0
  return <CalculatorLayout fields={<><MoneyField label="Balance inicial" value={initial} onChange={setInitial} /><NumberField label="Objetivo (%)" value={target} onChange={setTarget} min={0} max={100} /><MoneyField label="Balance / equity actual" value={current} onChange={setCurrent} /></>} results={[['Objetivo monetario', money(targetAmount)], ['Balance objetivo', money(targetBalance)], ['Ganancia actual', money(gain)], ['Faltante', money(missing)], ['Progreso', `${format(progress)}%`]]} />
}

function CalculatorLayout({ fields, results }: { fields: React.ReactNode; results: Array<[string, string]> }) { return <div className="grid gap-6 lg:grid-cols-2"><div className="space-y-5 rounded-2xl border border-white/10 bg-[#111c2e] p-5 sm:p-6">{fields}</div><div className="rounded-2xl border border-amber-300/20 bg-[linear-gradient(145deg,rgba(232,187,73,.08),rgba(17,28,46,.96)_45%)] p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[.16em] text-amber-300">Resultado</p><dl className="mt-4 divide-y divide-white/8">{results.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 py-4"><dt className="text-sm text-slate-400">{label}</dt><dd className="text-right font-mono text-lg font-semibold text-white">{value}</dd></div>)}</dl></div></div> }
function MoneyField({ label, value, onChange }: FieldProps) { return <NumberField label={label} value={value} onChange={onChange} min={0} step="0.01" prefix="$" /> }
type FieldProps = { label: string; value: string; onChange: (value: string) => void; min?: number; max?: number; step?: string; prefix?: string }
function NumberField({ label, value, onChange, min, max, step = 'any', prefix }: FieldProps) { return <label className="block"><span className="text-sm font-medium text-slate-200">{label}</span><span className="relative block">{prefix && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">{prefix}</span>}<input type="number" inputMode="decimal" min={min} max={max} step={step} value={value} onChange={(event) => onChange(event.target.value)} className={`${INPUT} ${prefix ? 'pl-8' : ''}`} /></span></label> }
function number(value: string) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0 }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)) }
function money(value: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) }
function format(value: number) { return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(value) }
