'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  isValidChallengeSlug,
  hasDuplicateVariantSlug,
  normalizeChallengeSlug,
  optionalNumber,
  revalidateChallengeData,
  variantMutationError,
} from '@/lib/challenge-admin'

export type EditableChallengeVariant = {
  id: string
  challenge_id: string
  name: string
  slug: string
  profit_split: number | null
  price_modifier: number | null
  payout_frequency: string | null
  notes: string | null
  status: boolean
  created_at: string
  updated_at: string
}

export function VariantForm({ challengeId, platformSlug, variants, initial, onDone }: {
  challengeId: string
  platformSlug: string
  variants: EditableChallengeVariant[]
  initial?: EditableChallengeVariant
  onDone: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState(initial?.name ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [profitSplit, setProfitSplit] = useState(value(initial?.profit_split))
  const [priceModifier, setPriceModifier] = useState(value(initial?.price_modifier))
  const [payoutFrequency, setPayoutFrequency] = useState(initial?.payout_frequency ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [status, setStatus] = useState(initial?.status ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function changeName(nextName: string) {
    setName(nextName)
    if (!slug || slug === normalizeChallengeSlug(name)) setSlug(normalizeChallengeSlug(nextName))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    const normalizedName = name.trim()
    const normalizedSlug = normalizeChallengeSlug(slug)
    const split = optionalNumber(profitSplit)
    const modifier = optionalNumber(priceModifier)
    if (!normalizedName) return setError('El nombre de la variante es obligatorio.')
    if (!normalizedSlug || !isValidChallengeSlug(normalizedSlug)) return setError('El slug es obligatorio y debe usar letras minúsculas, números y guiones.')
    if (split !== null && !Number.isFinite(split)) return setError('El profit split debe ser numérico.')
    if (modifier !== null && !Number.isFinite(modifier)) return setError('El modificador de precio debe ser numérico.')
    if (hasDuplicateVariantSlug(variants, normalizedSlug, initial?.id)) {
      return setError('Ya existe una variante con este slug dentro del Challenge.')
    }

    setSaving(true)
    const payload = {
      challenge_id: challengeId,
      name: normalizedName,
      slug: normalizedSlug,
      profit_split: split,
      price_modifier: modifier,
      payout_frequency: payoutFrequency.trim() || null,
      notes: notes.trim() || null,
      status,
      ...(initial ? { updated_at: new Date().toISOString() } : {}),
    }
    const supabase = createClient()
    const result = initial
      ? await supabase.from('challenge_variants').update(payload).eq('id', initial.id).eq('challenge_id', challengeId)
      : await supabase.from('challenge_variants').insert(payload)
    if (result.error) {
      setError(variantMutationError(result.error.message))
      setSaving(false)
      return
    }
    try {
      await revalidateChallengeData(initial ? 'update' : 'create', [platformSlug])
      router.refresh()
      onDone()
    } catch (revalidationError) {
      setError(revalidationError instanceof Error ? `La variante se guardó, pero ${revalidationError.message}` : 'La variante se guardó, pero no se pudo revalidar.')
    } finally {
      setSaving(false)
    }
  }

  return <form onSubmit={submit} className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <Input label="Nombre" value={name} set={changeName} required />
      <Input label="Slug" value={slug} set={(next) => setSlug(normalizeChallengeSlug(next))} required />
      <Input label="Profit split %" type="number" step="any" value={profitSplit} set={setProfitSplit} />
      <Input label="Modificador de precio" type="number" step="any" value={priceModifier} set={setPriceModifier} />
      <Input label="Frecuencia de payout" value={payoutFrequency} set={setPayoutFrequency} />
      <label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 px-4 py-3"><input type="checkbox" checked={status} onChange={(event) => setStatus(event.target.checked)} /><span className="text-sm font-semibold">Variante activa</span></label>
    </div>
    <label><span className="mb-1.5 block text-sm font-semibold">Notas</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className={INPUT} placeholder="Opcional" /></label>
    {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-3"><button disabled={saving} className="admin-primary-button px-5 py-3 text-sm">{saving ? 'Guardando…' : initial ? 'Guardar variante' : 'Crear variante'}</button><button type="button" disabled={saving} onClick={onDone} className="admin-secondary-button px-5 py-3 text-sm">Cancelar</button></div>
  </form>
}

function value(input: number | null | undefined) { return input === null || input === undefined ? '' : String(input) }
const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm'
function Input({ label, value, set, ...props }: { label: string; value: string; set: (value: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) { return <label><span className="mb-1.5 block text-sm font-semibold">{label}</span><input {...props} value={value} onChange={(event) => set(event.target.value)} className={INPUT} placeholder={props.placeholder ?? 'Opcional'} /></label> }
