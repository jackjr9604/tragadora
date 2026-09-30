'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { challengeMutationError, optionalInteger, optionalNumber, revalidateChallengeData } from '@/lib/challenge-admin'

export type EditableAccountPlan = {
  id: string
  account_size: number | null
  price: number | null
  currency: string | null
  variant_id: string | null
  profit_target: number | null
  daily_drawdown: number | null
  max_drawdown: number | null
  profit_split: number | null
  min_trading_days: number | null
  max_trading_days: number | null
  payout_frequency: string | null
}

type Variant = { id: string; name: string; status: boolean }

export function AccountPlanForm({ challengeId, platformSlug, variants, hasNormalizedPhases, initial, onDone, cancelHref }: {
  challengeId: string
  platformSlug: string
  variants: Variant[]
  hasNormalizedPhases: boolean
  initial?: EditableAccountPlan
  onDone?: () => void
  cancelHref?: string
}) {
  const router = useRouter()
  const [accountSize, setAccountSize] = useState(initial?.account_size === null || initial?.account_size === undefined ? '' : String(initial.account_size))
  const [price, setPrice] = useState(value(initial?.price))
  const [currency, setCurrency] = useState(initial?.currency ?? 'USD')
  const [variantId, setVariantId] = useState(initial?.variant_id ?? '')
  const [profitTarget, setProfitTarget] = useState(value(initial?.profit_target))
  const [dailyDrawdown, setDailyDrawdown] = useState(value(initial?.daily_drawdown))
  const [maxDrawdown, setMaxDrawdown] = useState(value(initial?.max_drawdown))
  const [profitSplit, setProfitSplit] = useState(value(initial?.profit_split))
  const [minTradingDays, setMinTradingDays] = useState(value(initial?.min_trading_days))
  const [maxTradingDays, setMaxTradingDays] = useState(value(initial?.max_trading_days))
  const [payoutFrequency, setPayoutFrequency] = useState(initial?.payout_frequency ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    const size = Number(accountSize)
    const parsedPrice = optionalNumber(price)
    if (!Number.isFinite(size) || size <= 0) return setError('El tamaño de cuenta debe ser mayor que cero.')
    if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) return setError('El precio debe ser cero o mayor.')
    if (!currency.trim()) return setError('La moneda es obligatoria.')
    if (variantId && !variants.some((variant) => variant.id === variantId)) return setError('La variante seleccionada no pertenece a este Challenge.')
    setSaving(true)
    const payload = {
      challenge_id: challengeId,
      account_size: size,
      price: parsedPrice,
      currency: currency.trim().toUpperCase(),
      variant_id: variantId || null,
      ...(hasNormalizedPhases ? {} : {
        profit_target: optionalNumber(profitTarget),
        daily_drawdown: optionalNumber(dailyDrawdown),
        max_drawdown: optionalNumber(maxDrawdown),
        profit_split: optionalNumber(profitSplit),
        min_trading_days: optionalInteger(minTradingDays),
        max_trading_days: optionalInteger(maxTradingDays),
        payout_frequency: payoutFrequency.trim() || null,
      }),
    }
    const supabase = createClient()
    const result = initial
      ? await supabase.from('account_plans').update(payload).eq('id', initial.id).eq('challenge_id', challengeId)
      : await supabase.from('account_plans').insert(payload)
    if (result.error) { setError(challengeMutationError(result.error.message, 'plan', Boolean(variantId))); setSaving(false); return }
    try {
      await revalidateChallengeData(initial ? 'update' : 'create', [platformSlug])
      router.refresh()
      if (onDone) onDone()
      else router.push(cancelHref ?? `/admin/challenges/${challengeId}`)
    } catch (revalidationError) {
      setError(revalidationError instanceof Error ? `El plan se guardó, pero ${revalidationError.message}` : 'El plan se guardó, pero no se pudo revalidar.')
    } finally { setSaving(false) }
  }

  return <form onSubmit={submit} className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <Input label="Tamaño de cuenta" type="number" min="0.01" step="any" value={accountSize} set={setAccountSize} required />
      <Input label="Precio" type="number" min="0" step="any" value={price} set={setPrice} placeholder="Vacío = sin dato" />
      <Input label="Moneda" value={currency} set={setCurrency} required />
      <label><span className="mb-1.5 block text-sm font-semibold">Variante</span><select value={variantId} onChange={(event) => setVariantId(event.target.value)} className={INPUT}><option value="">Plan general</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}{variant.status ? '' : ' (inactiva)'}</option>)}</select></label>
    </div>
    {hasNormalizedPhases ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-semibold">Reglas normalizadas activas</p><p className="mt-1">Target, drawdown y días se resuelven desde las fases. Los valores legacy existentes se conservan sin modificarse.</p>{initial && legacySummary(initial)}</div> : <details open className="rounded-xl border border-amber-200 bg-amber-50 p-4"><summary className="cursor-pointer font-semibold text-amber-950">Reglas legacy de evaluación</summary><p className="mt-2 text-sm text-amber-900">Este Challenge no tiene fases normalizadas; el frontend depende de estos campos.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><Input label="Profit Target %" type="number" step="any" value={profitTarget} set={setProfitTarget} /><Input label="Daily Drawdown %" type="number" step="any" value={dailyDrawdown} set={setDailyDrawdown} /><Input label="Max Drawdown %" type="number" step="any" value={maxDrawdown} set={setMaxDrawdown} /><Input label="Profit Split %" type="number" step="any" value={profitSplit} set={setProfitSplit} /><Input label="Mínimo días" type="number" min="0" step="1" value={minTradingDays} set={setMinTradingDays} /><Input label="Máximo días" type="number" min="0" step="1" value={maxTradingDays} set={setMaxTradingDays} /><Input label="Frecuencia de payout" value={payoutFrequency} set={setPayoutFrequency} /></div></details>}
    {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-3"><button disabled={saving} className="admin-primary-button px-5 py-3 text-sm">{saving ? 'Guardando…' : initial ? 'Guardar plan' : 'Crear plan'}</button>{(onDone || cancelHref) && <button type="button" disabled={saving} onClick={() => onDone ? onDone() : router.push(cancelHref!)} className="admin-secondary-button px-5 py-3 text-sm">Cancelar</button>}</div>
  </form>
}

function value(input: number | null | undefined) { return input === null || input === undefined ? '' : String(input) }
const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm'
function Input({ label, value, set, ...props }: { label: string; value: string; set: (value: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) { return <label><span className="mb-1.5 block text-sm font-semibold">{label}</span><input {...props} value={value} onChange={(event) => set(event.target.value)} className={INPUT} /></label> }
function legacySummary(plan: EditableAccountPlan) { const entries = [['Target', plan.profit_target], ['Daily DD', plan.daily_drawdown], ['Max DD', plan.max_drawdown], ['Split', plan.profit_split], ['Mín. días', plan.min_trading_days], ['Máx. días', plan.max_trading_days], ['Frecuencia', plan.payout_frequency]].filter(([, value]) => value !== null); return entries.length ? <p className="mt-3 text-xs">Legacy conservado: {entries.map(([label, item]) => `${label}: ${item}`).join(' · ')}</p> : null }
