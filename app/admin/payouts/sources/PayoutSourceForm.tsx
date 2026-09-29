'use client'

import { FormEvent, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SourceType =
  | 'blockchain'
  | 'official_api'
  | 'provider'
  | 'public_page'

type PlatformOption = {
  id: string
  name: string
}

export type PayoutSourceFormValue = {
  id: string
  platformId: string
  name: string
  sourceType: SourceType
  sourceUrl: string
  status: boolean
  config: Record<string, unknown>
}

type FormState = {
  platformId: string
  name: string
  sourceType: SourceType
  sourceUrl: string
  status: boolean
  chain: string
  chainId: string
  tokenSymbol: string
  tokenAddress: string
  decimals: string
  settlementAddress: string
  verification: string
  historyPage: string
  historyComplete: boolean
  collectorEnabled: boolean
  collectorCurrency: string
  collectorSourceName: string
  collectorWaitSelector: string
  collectorAll: boolean
  collector30d: boolean
  amountSelector: string
  payoutCountSelector: string
  largestSelector: string
  averageSelector: string
  processingTimeSelector: string
  recentRewardsSelector: string
  allTriggerSelector: string
  allActiveSelector: string
  days30TriggerSelector: string
  days30ActiveSelector: string
}

function configString(
  config: Record<string, unknown>,
  key: string
) {
  const value = config[key]
  return value === null || value === undefined
    ? ''
    : String(value)
}

export default function PayoutSourceForm({
  platforms,
  source,
}: {
  platforms: PlatformOption[]
  source?: PayoutSourceFormValue
}) {
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const isEditing = Boolean(source)
  const initialConfig = source?.config ?? {}
  const initialCollector = objectValue(initialConfig.collector)
  const initialPeriods = Array.isArray(initialCollector.periods) ? initialCollector.periods.map((period) => objectValue(period).periodKey) : []
  const initialMetrics = objectValue(initialCollector.metrics)
  const periodConfig = (key: string) => objectValue((Array.isArray(initialCollector.periods) ? initialCollector.periods : []).find((period) => objectValue(period).periodKey === key))
  const [form, setForm] = useState<FormState>({
    platformId: source?.platformId ?? platforms[0]?.id ?? '',
    name: source?.name ?? '',
    sourceType: source?.sourceType ?? 'blockchain',
    sourceUrl: source?.sourceUrl ?? '',
    status: source?.status ?? true,
    chain: configString(initialConfig, 'chain'),
    chainId: configString(initialConfig, 'chain_id'),
    tokenSymbol: configString(initialConfig, 'token_symbol'),
    tokenAddress: configString(initialConfig, 'token_address'),
    decimals: configString(initialConfig, 'decimals'),
    settlementAddress: configString(
      initialConfig,
      'settlement_address'
    ),
    verification: configString(initialConfig, 'verification'),
    historyPage:
      configString(initialConfig, 'history_page') || '1',
    historyComplete: Boolean(
      initialConfig.history_complete
    ),
    collectorEnabled: Boolean(initialCollector.enabled),
    collectorCurrency: String(initialCollector.currency ?? 'USD'),
    collectorSourceName: String(initialCollector.sourceName ?? source?.name ?? ''),
    collectorWaitSelector: String(initialCollector.waitForSelector ?? ''),
    collectorAll: initialPeriods.includes('all'),
    collector30d: initialPeriods.includes('30d'),
    amountSelector: String(objectValue(initialMetrics.amount).selector ?? ''),
    payoutCountSelector: String(objectValue(initialMetrics.payoutCount).selector ?? ''),
    largestSelector: String(objectValue(initialMetrics.largestPayout).selector ?? ''),
    averageSelector: String(objectValue(initialMetrics.averagePayout).selector ?? ''),
    processingTimeSelector: String(objectValue(initialCollector.averageProcessingTime).selector ?? ''),
    recentRewardsSelector: String(objectValue(initialCollector.recentRewards).rowSelector ?? ''),
    allTriggerSelector: String(periodConfig('all').triggerSelector ?? ''),
    allActiveSelector: String(periodConfig('all').activeSelector ?? ''),
    days30TriggerSelector: String(periodConfig('30d').triggerSelector ?? ''),
    days30ActiveSelector: String(periodConfig('30d').activeSelector ?? ''),
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  function updateField<K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function buildConfig() {
    if (form.sourceType === 'public_page') {
      const periods = []
      if (form.collectorAll) periods.push({ periodKey: 'all', label: 'All time', triggerSelector: form.allTriggerSelector.trim(), activeSelector: form.allActiveSelector.trim() })
      if (form.collector30d) periods.push({ periodKey: '30d', label: 'Last 30 days', triggerSelector: form.days30TriggerSelector.trim(), activeSelector: form.days30ActiveSelector.trim() })
      return {
        ...initialConfig,
        collector: {
          enabled: form.collectorEnabled,
          kind: 'official_page',
          version: 1,
          currency: form.collectorCurrency.trim().toUpperCase(),
          sourceName: form.collectorSourceName.trim(),
          waitForSelector: form.collectorWaitSelector.trim(),
          periods,
          metrics: {
            amount: { selector: form.amountSelector.trim(), parser: 'currency', required: true },
            ...(form.payoutCountSelector.trim() ? { payoutCount: { selector: form.payoutCountSelector.trim(), parser: 'integer', required: false } } : {}),
            ...(form.largestSelector.trim() ? { largestPayout: { selector: form.largestSelector.trim(), parser: 'currency', required: false } } : {}),
            ...(form.averageSelector.trim() ? { averagePayout: { selector: form.averageSelector.trim(), parser: 'currency', required: false } } : {}),
          },
          ...(form.processingTimeSelector.trim() ? { averageProcessingTime: { selector: form.processingTimeSelector.trim(), parser: 'hours', required: false } } : {}),
          ...(form.recentRewardsSelector.trim() ? { recentRewards: { rowSelector: form.recentRewardsSelector.trim(), columns: { date: 0, market: 1, accountBalance: 2, reward: 3 }, limit: 20 } } : {}),
        },
      }
    }

    if (form.sourceType !== 'blockchain') {
      return initialConfig
    }

    const config: Record<
      string,
      string | number | boolean
    > = {
      history_page: Number(form.historyPage || 1),
      history_complete: form.historyComplete,
    }

    if (form.chain.trim()) {
      config.chain = form.chain.trim()
    }

    if (form.chainId.trim()) {
      config.chain_id = Number(form.chainId)
    }

    if (form.settlementAddress.trim()) {
      config.settlement_address =
        form.settlementAddress.trim()
    }

    if (form.tokenAddress.trim()) {
      config.token_address = form.tokenAddress.trim()
    }

    if (form.tokenSymbol.trim()) {
      config.token_symbol = form.tokenSymbol.trim()
    }

    if (form.decimals.trim()) {
      config.decimals = Number(form.decimals)
    }

    if (form.verification.trim()) {
      config.verification = form.verification.trim()
    }

    return config
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()
    setError('')

    if (form.sourceType === 'blockchain' && form.status) {
      if (!form.settlementAddress.trim()) {
        setError(
          'Debes configurar la Settlement Address antes de activar esta fuente.'
        )
        return
      }

      if (!form.tokenAddress.trim()) {
        setError(
          'Debes configurar la Token Address antes de activar esta fuente.'
        )
        return
      }

      if (!form.chain.trim()) {
        setError(
          'Debes configurar la Chain antes de activar esta fuente.'
        )
        return
      }

      const chainId = Number(form.chainId)

      if (
        !form.chainId.trim() ||
        !Number.isFinite(chainId) ||
        chainId <= 0
      ) {
        setError(
          'Debes configurar un Chain ID válido antes de activar esta fuente.'
        )
        return
      }
    }

    if (form.sourceType === 'public_page' && form.collectorEnabled) {
      const urlError = validatePublicCollectorUrl(form.sourceUrl)
      if (urlError) { setError(urlError); return }
      if (!form.collectorSourceName.trim() || !form.collectorWaitSelector.trim() || !form.amountSelector.trim()) {
        setError('Completa el nombre de fuente, la condición de carga y el selector del total antes de activar el collector.')
        return
      }
      if (!form.collectorAll && !form.collector30d) {
        setError('Selecciona al menos un periodo para el collector.')
        return
      }
      if ((form.collectorAll && (!form.allTriggerSelector.trim() || !form.allActiveSelector.trim())) || (form.collector30d && (!form.days30TriggerSelector.trim() || !form.days30ActiveSelector.trim()))) {
        setError('Completa los selectores de activación y confirmación para cada periodo habilitado.')
        return
      }
    }

    setSaving(true)

    const payload = {
      platform_id: form.platformId,
      name: form.name.trim(),
      source_type: form.sourceType,
      source_url: form.sourceUrl.trim() || null,
      status: form.status,
      config: buildConfig(),
    }
    const supabase = supabaseRef.current

    if (source) {
      const { error: updateError } = await supabase
        .from('payout_sources')
        .update(payload)
        .eq('id', source.id)

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }

      router.push(`/admin/payouts?source=${source.id}`)
      router.refresh()
      return
    }

    const { data: createdSource, error: insertError } =
      await supabase
        .from('payout_sources')
        .insert(payload)
        .select('id')
        .single()

    if (insertError || !createdSource) {
      setError(
        insertError?.message ||
          'No se pudo crear la fuente.'
      )
      setSaving(false)
      return
    }

    router.push(
      `/admin/payouts?source=${createdSource.id}`
    )
    router.refresh()
  }

  async function handleDelete() {
    if (!source) {
      return
    }

    setDeleting(true)
    setError('')
    const supabase = supabaseRef.current
    const { count, error: countError } = await supabase
      .from('payouts')
      .select('id', { count: 'exact', head: true })
      .eq('payout_source_id', source.id)

    if (countError) {
      setError(countError.message)
      setDeleting(false)
      return
    }

    if ((count ?? 0) > 0) {
      setError(
        'No puedes eliminar esta fuente porque ya tiene payouts asociados. Desactívala en su lugar.'
      )
      setDeleting(false)
      return
    }

    const confirmed = window.confirm(
      '¿Seguro que quieres eliminar esta fuente? Esta acción no se puede deshacer.'
    )

    if (!confirmed) {
      setDeleting(false)
      return
    }

    const { error: deleteError } = await supabase
      .from('payout_sources')
      .delete()
      .eq('id', source.id)

    if (deleteError) {
      setError(deleteError.message)
      setDeleting(false)
      return
    }

    router.push('/admin/payouts')
    router.refresh()
  }

  const inputClass = 'w-full rounded-lg border p-3'

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl bg-white p-8 shadow"
    >
      <div>
        <label className="mb-2 block text-sm font-medium">
          Prop Firm
        </label>
        <select
          value={form.platformId}
          onChange={(event) =>
            updateField('platformId', event.target.value)
          }
          className={inputClass}
          required
        >
          {platforms.map((platform) => (
            <option key={platform.id} value={platform.id}>
              {platform.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Nombre
          </label>
          <input
            value={form.name}
            onChange={(event) =>
              updateField('name', event.target.value)
            }
            className={inputClass}
            placeholder="Ej. FundingPips RiseUSD - Arbitrum"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Tipo de fuente
          </label>
          <select
            value={form.sourceType}
            onChange={(event) =>
              updateField(
                'sourceType',
                event.target.value as SourceType
              )
            }
            className={inputClass}
          >
            <option value="blockchain">Blockchain</option>
            <option value="official_api">API oficial</option>
            <option value="provider">Proveedor</option>
            <option value="public_page">Página pública</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          URL de fuente
        </label>
        <input
          type="url"
          value={form.sourceUrl}
          onChange={(event) =>
            updateField('sourceUrl', event.target.value)
          }
          className={inputClass}
          placeholder="https://..."
        />
      </div>

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={form.status}
          onChange={(event) =>
            updateField('status', event.target.checked)
          }
        />
        Fuente activa
      </label>

      {form.sourceType === 'blockchain' && (
        <fieldset className="space-y-5 rounded-xl border bg-slate-50 p-6">
          <div>
            <legend className="text-lg font-semibold">
              Configuración blockchain
            </legend>
            <p className="mt-1 text-sm text-slate-500">
              Datos utilizados por los collectors automáticos.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Chain"
              value={form.chain}
              onChange={(value) => updateField('chain', value)}
              required={form.status}
            />
            <TextField
              label="Chain ID"
              type="number"
              value={form.chainId}
              onChange={(value) => updateField('chainId', value)}
              required={form.status}
            />
            <TextField
              label="Token symbol"
              value={form.tokenSymbol}
              onChange={(value) =>
                updateField('tokenSymbol', value)
              }
            />
            <TextField
              label="Decimals"
              type="number"
              value={form.decimals}
              onChange={(value) => updateField('decimals', value)}
            />
          </div>

          <TextField
            label="Token address"
            value={form.tokenAddress}
            onChange={(value) =>
              updateField('tokenAddress', value)
            }
            required={form.status}
          />
          <TextField
            label="Settlement address"
            value={form.settlementAddress}
            onChange={(value) =>
              updateField('settlementAddress', value)
            }
            required={form.status}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Verification"
              value={form.verification}
              onChange={(value) =>
                updateField('verification', value)
              }
            />
            <TextField
              label="History page"
              type="number"
              min="1"
              value={form.historyPage}
              onChange={(value) =>
                updateField('historyPage', value)
              }
              required
            />
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.historyComplete}
              onChange={(event) =>
                updateField(
                  'historyComplete',
                  event.target.checked
                )
              }
            />
            Histórico completo
          </label>
        </fieldset>
      )}

      {form.sourceType === 'public_page' && (
        <fieldset className="space-y-5 rounded-xl border bg-slate-50 p-6">
          <div><legend className="text-lg font-semibold">Collector de página oficial</legend><p className="mt-1 text-sm text-slate-500">Configuración declarativa: solo selectores y parsers permitidos, nunca código ejecutable.</p></div>
          <label className="flex items-center gap-3"><input type="checkbox" checked={form.collectorEnabled} onChange={(event) => updateField('collectorEnabled', event.target.checked)} /> Activar collector</label>
          <div className="grid gap-5 sm:grid-cols-2"><TextField label="Nombre público de la fuente" value={form.collectorSourceName} onChange={(value) => updateField('collectorSourceName', value)} required={form.collectorEnabled} /><TextField label="Moneda" value={form.collectorCurrency} onChange={(value) => updateField('collectorCurrency', value)} required={form.collectorEnabled} /></div>
          <TextField label="Selector de carga" value={form.collectorWaitSelector} onChange={(value) => updateField('collectorWaitSelector', value)} required={form.collectorEnabled} />
          <div><p className="mb-2 text-sm font-medium">Periodos publicados</p><div className="flex flex-wrap gap-4"><label className="flex items-center gap-2"><input type="checkbox" checked={form.collectorAll} onChange={(event) => updateField('collectorAll', event.target.checked)} /> Todo el tiempo</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.collector30d} onChange={(event) => updateField('collector30d', event.target.checked)} /> 30 días</label></div></div>
          <div className="grid gap-5 sm:grid-cols-2"><TextField label="Selector · Total pagado" value={form.amountSelector} onChange={(value) => updateField('amountSelector', value)} required={form.collectorEnabled} /><TextField label="Selector · Cantidad de payouts" value={form.payoutCountSelector} onChange={(value) => updateField('payoutCountSelector', value)} /><TextField label="Selector · Mayor payout" value={form.largestSelector} onChange={(value) => updateField('largestSelector', value)} /><TextField label="Selector · Payout promedio" value={form.averageSelector} onChange={(value) => updateField('averageSelector', value)} /></div>
          <details className="rounded-lg border bg-white p-4"><summary className="cursor-pointer font-medium">Configuración avanzada</summary><div className="mt-4 grid gap-5 sm:grid-cols-2"><TextField label="Todo el tiempo · botón" value={form.allTriggerSelector} onChange={(value) => updateField('allTriggerSelector', value)} /><TextField label="Todo el tiempo · estado activo" value={form.allActiveSelector} onChange={(value) => updateField('allActiveSelector', value)} /><TextField label="30 días · botón" value={form.days30TriggerSelector} onChange={(value) => updateField('days30TriggerSelector', value)} /><TextField label="30 días · estado activo" value={form.days30ActiveSelector} onChange={(value) => updateField('days30ActiveSelector', value)} /><TextField label="Selector · Tiempo promedio (horas)" value={form.processingTimeSelector} onChange={(value) => updateField('processingTimeSelector', value)} /><TextField label="Filas · Rewards recientes" value={form.recentRewardsSelector} onChange={(value) => updateField('recentRewardsSelector', value)} /></div><p className="mt-3 text-xs text-slate-500">Los rewards recientes se conservan en raw_data; nunca se insertan como payouts individuales.</p></details>
        </fieldset>
      )}

      {error && (
        <div
          className="rounded-lg bg-red-50 p-4 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row">
        <div>
          {isEditing && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving || deleting}
              className="rounded-lg border border-red-300 px-5 py-3 text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? 'Verificando...' : 'Eliminar fuente'}
            </button>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={saving || deleting}
            className="rounded-lg border px-5 py-3 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || deleting || platforms.length === 0}
            className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
          >
            {saving
              ? 'Guardando...'
              : isEditing
                ? 'Guardar cambios'
                : 'Crear fuente'}
          </button>
        </div>
      </div>
    </form>
  )
}

function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function validatePublicCollectorUrl(value: string) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    if (url.protocol !== 'https:') return 'La URL del collector debe usar HTTPS.'
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) return 'La URL del collector no puede apuntar a una red local.'
    return ''
  } catch { return 'Configura una URL pública válida para el collector.' }
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  min,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number'
  min?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">
        {label}
      </label>
      <input
        type={type}
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border p-3"
        required={required}
      />
    </div>
  )
}
