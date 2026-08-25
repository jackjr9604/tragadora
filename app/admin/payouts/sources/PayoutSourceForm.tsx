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
    if (form.sourceType !== 'blockchain') {
      return {}
    }

    return {
      chain: form.chain.trim(),
      chain_id: Number(form.chainId),
      settlement_address:
        form.settlementAddress.trim(),
      token_address: form.tokenAddress.trim(),
      token_symbol: form.tokenSymbol.trim(),
      decimals: Number(form.decimals),
      verification: form.verification.trim(),
      history_page: Number(form.historyPage || 1),
      history_complete: form.historyComplete,
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()
    setSaving(true)
    setError('')

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
              required
            />
            <TextField
              label="Chain ID"
              type="number"
              value={form.chainId}
              onChange={(value) => updateField('chainId', value)}
              required
            />
            <TextField
              label="Token symbol"
              value={form.tokenSymbol}
              onChange={(value) =>
                updateField('tokenSymbol', value)
              }
              required
            />
            <TextField
              label="Decimals"
              type="number"
              value={form.decimals}
              onChange={(value) => updateField('decimals', value)}
              required
            />
          </div>

          <TextField
            label="Token address"
            value={form.tokenAddress}
            onChange={(value) =>
              updateField('tokenAddress', value)
            }
            required
          />
          <TextField
            label="Settlement address"
            value={form.settlementAddress}
            onChange={(value) =>
              updateField('settlementAddress', value)
            }
            required
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Verification"
              value={form.verification}
              onChange={(value) =>
                updateField('verification', value)
              }
              required
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
