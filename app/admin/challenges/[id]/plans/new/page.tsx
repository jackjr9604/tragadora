'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'

const supabase = createClient()

export default function NewAccountPlanPage() {
  const params = useParams()
  const router = useRouter()

  const challengeId = params.id as string

  const [accountSize, setAccountSize] = useState('')
  const [variants, setVariants] = useState<Array<{ id: string; name: string }>>([])
  const [variantId, setVariantId] = useState('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [hasNormalizedPhases, setHasNormalizedPhases] = useState(false)
  const [profitTarget, setProfitTarget] = useState('')
  const [dailyDrawdown, setDailyDrawdown] = useState('')
  const [maxDrawdown, setMaxDrawdown] = useState('')
  const [profitSplit, setProfitSplit] = useState('')
  const [minTradingDays, setMinTradingDays] = useState('')
  const [maxTradingDays, setMaxTradingDays] = useState('')
  const [payoutFrequency, setPayoutFrequency] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadChallengeData() {
      const [variantsResult, phasesResult] = await Promise.all([
        supabase.from('challenge_variants').select('id, name').eq('challenge_id', challengeId).eq('status', true).order('name'),
        supabase.from('challenge_phases').select('id', { count: 'exact', head: true }).eq('challenge_id', challengeId),
      ])
      const loadError = variantsResult.error ?? phasesResult.error
      if (loadError) setError(loadError.message)
      else {
        setVariants(variantsResult.data ?? [])
        setHasNormalizedPhases((phasesResult.count ?? 0) > 0)
      }
    }
    void loadChallengeData()
  }, [challengeId])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setLoading(true)
    setError('')

    const { error } = await supabase
      .from('account_plans')
      .insert({
        challenge_id: challengeId,
        variant_id: variantId || null,
        account_size: Number(accountSize),
        price: price ? Number(price) : null,
        currency: currency.trim() || 'USD',
        profit_target: profitTarget
          ? Number(profitTarget)
          : null,
        daily_drawdown: dailyDrawdown
          ? Number(dailyDrawdown)
          : null,
        max_drawdown: maxDrawdown
          ? Number(maxDrawdown)
          : null,
        profit_split: profitSplit
          ? Number(profitSplit)
          : null,
        min_trading_days: minTradingDays
          ? Number(minTradingDays)
          : null,
        max_trading_days: maxTradingDays
          ? Number(maxTradingDays)
          : null,
        payout_frequency:
          payoutFrequency || null,
      })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push(`/admin/challenges/${challengeId}`)
    router.refresh()
  }

  return (
    <main className="p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-3xl font-bold">
          Nueva cuenta
        </h1>

        <p className="mb-8 text-slate-500">
          Añade una cuenta al Challenge.
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-xl bg-white p-8 shadow"
        >
          {variants.length > 0 && <div><label className="mb-2 block text-sm font-medium">Variante</label><select value={variantId} onChange={(event) => setVariantId(event.target.value)} className="w-full rounded-lg border p-3"><option value="">Plan base / sin variante</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}</select></div>}

          <section><h2 className="text-lg font-semibold">Cuenta y precio</h2><p className="mt-1 text-sm text-slate-500">Estos datos alimentan directamente el resumen público y el recomendador.</p><div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input
              label="Tamaño de cuenta"
              type="number"
              value={accountSize}
              onChange={setAccountSize}
              placeholder="100000"
              required
            />

            <Input
              label="Precio"
              type="number"
              value={price}
              onChange={setPrice}
              placeholder="549"
            />

            <Input
              label="Moneda"
              value={currency}
              onChange={setCurrency}
              placeholder="USD"
              required
            />
          </div></section>

          <section className="rounded-xl border p-5"><h2 className="text-lg font-semibold">Reward / retiro</h2><p className="mt-1 text-sm text-slate-500">Fallback legacy mientras el reward principal se termina de normalizar.</p><div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input
              label="Profit Split %"
              type="number"
              value={profitSplit}
              onChange={setProfitSplit}
              placeholder="80"
            />

            <Input
              label="Frecuencia de pago"
              value={payoutFrequency}
              onChange={setPayoutFrequency}
              placeholder="Cada 14 días"
            />
          </div></section>

          {!hasNormalizedPhases && <details className="rounded-xl border border-amber-200 bg-amber-50 p-5"><summary className="cursor-pointer font-semibold text-amber-900">Reglas legacy de evaluación</summary><p className="mt-2 text-sm text-amber-800">Este challenge todavía no tiene fases normalizadas. Completa estos campos solo si el plan depende de ellos.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><Input label="Profit Target %" type="number" value={profitTarget} onChange={setProfitTarget} placeholder="10" /><Input label="Daily Drawdown %" type="number" value={dailyDrawdown} onChange={setDailyDrawdown} placeholder="5" /><Input label="Max Drawdown %" type="number" value={maxDrawdown} onChange={setMaxDrawdown} placeholder="10" /><Input label="Mínimo días de trading" type="number" value={minTradingDays} onChange={setMinTradingDays} placeholder="5" /><Input label="Máximo días de trading" type="number" value={maxTradingDays} onChange={setMaxTradingDays} placeholder="30" /></div></details>}

          {hasNormalizedPhases && <p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">Las reglas de evaluación se tomarán de las fases normalizadas. No necesitas repetir target, drawdown ni días en esta cuenta.</p>}

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/admin/challenges/${challengeId}`
                )
              }
              className="rounded-lg border px-5 py-3"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-black px-5 py-3 text-white"
            >
              {loading
                ? 'Guardando...'
                : 'Crear cuenta'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border p-3"
      />
    </div>
  )
}
