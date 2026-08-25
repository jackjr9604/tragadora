'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'

export default function NewAccountPlanPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const challengeId = params.id as string

  const [accountSize, setAccountSize] = useState('')
  const [price, setPrice] = useState('')
  const [profitTarget, setProfitTarget] = useState('')
  const [dailyDrawdown, setDailyDrawdown] = useState('')
  const [maxDrawdown, setMaxDrawdown] = useState('')
  const [profitSplit, setProfitSplit] = useState('')
  const [minTradingDays, setMinTradingDays] = useState('')
  const [maxTradingDays, setMaxTradingDays] = useState('')
  const [payoutFrequency, setPayoutFrequency] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
        account_size: Number(accountSize),
        price: price ? Number(price) : null,
        currency: 'USD',
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
          <div className="grid gap-4 sm:grid-cols-2">
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
              label="Profit Target %"
              type="number"
              value={profitTarget}
              onChange={setProfitTarget}
              placeholder="10"
            />

            <Input
              label="Daily Drawdown %"
              type="number"
              value={dailyDrawdown}
              onChange={setDailyDrawdown}
              placeholder="5"
            />

            <Input
              label="Max Drawdown %"
              type="number"
              value={maxDrawdown}
              onChange={setMaxDrawdown}
              placeholder="10"
            />

            <Input
              label="Profit Split %"
              type="number"
              value={profitSplit}
              onChange={setProfitSplit}
              placeholder="80"
            />

            <Input
              label="Mínimo días de trading"
              type="number"
              value={minTradingDays}
              onChange={setMinTradingDays}
              placeholder="5"
            />

            <Input
              label="Máximo días de trading"
              type="number"
              value={maxTradingDays}
              onChange={setMaxTradingDays}
              placeholder="30"
            />
          </div>

          <Input
            label="Frecuencia de pago"
            value={payoutFrequency}
            onChange={setPayoutFrequency}
            placeholder="Cada 14 días"
          />

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
