'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAdminPermission } from '@/components/admin/AdminPermissionsProvider'
import { challengeMutationError, normalizeChallengeSlug, optionalInteger, revalidateChallengeData } from '@/lib/challenge-admin'

type Platform = { id: string; name: string; slug: string }
type Challenge = {
  id: string
  platform_id: string
  name: string
  slug: string
  challenge_type: string | null
  phases: number | null
  status: string
}

export function ChallengeGeneralForm({ challenge, platforms, normalizedPhaseCount }: {
  challenge: Challenge
  platforms: Platform[]
  normalizedPhaseCount: number
}) {
  const router = useRouter()
  const canUpdate = useAdminPermission('challenges.update')
  const [platformId, setPlatformId] = useState(challenge.platform_id)
  const [name, setName] = useState(challenge.name)
  const [slug, setSlug] = useState(challenge.slug)
  const [challengeType, setChallengeType] = useState(challenge.challenge_type ?? '')
  const [phases, setPhases] = useState(challenge.phases === null ? '' : String(challenge.phases))
  const [status, setStatus] = useState(challenge.status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const selectedPlatform = platforms.find((platform) => platform.id === platformId)
  const originalPlatform = platforms.find((platform) => platform.id === challenge.platform_id)
  const declaredPhases = phases.trim() === '' ? null : Number(phases)
  const mismatch = normalizedPhaseCount > 0 && declaredPhases !== normalizedPhaseCount
  const suggestions = useMemo(() => [...new Set(['1-step', '2-step', '3-step', 'one_step', 'two_step', 'three_step', 'Evaluation', 'Instant Funding', 'instant', 'sprint', challenge.challenge_type].filter((value): value is string => Boolean(value)))], [challenge.challenge_type])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canUpdate) return
    setError('')
    setSuccess('')
    const normalizedSlug = normalizeChallengeSlug(slug)
    const parsedPhases = optionalInteger(phases)
    if (!platformId || !name.trim() || !normalizedSlug) return setError('Prop Firm, nombre y slug son obligatorios.')
    if (parsedPhases !== null && (!Number.isInteger(Number(phases)) || parsedPhases < 0)) return setError('El número de fases debe ser un entero mayor o igual a cero.')
    setSaving(true)
    const supabase = createClient()
    const duplicate = await supabase.from('challenges').select('id').eq('slug', normalizedSlug).neq('id', challenge.id).maybeSingle()
    if (duplicate.error) { setError(duplicate.error.message); setSaving(false); return }
    if (duplicate.data) { setError('Ese slug ya está siendo utilizado por otro Challenge.'); setSaving(false); return }
    const result = await supabase.from('challenges').update({
      platform_id: platformId,
      name: name.trim(),
      slug: normalizedSlug,
      challenge_type: challengeType.trim() || null,
      phases: parsedPhases,
      status,
    }).eq('id', challenge.id)
    if (result.error) { setError(challengeMutationError(result.error.message, 'challenge')); setSaving(false); return }
    try {
      await revalidateChallengeData('update', [originalPlatform?.slug, selectedPlatform?.slug].filter((value): value is string => Boolean(value)))
      setSlug(normalizedSlug)
      setSuccess('Challenge actualizado correctamente.')
      router.refresh()
    } catch (revalidationError) {
      setError(revalidationError instanceof Error ? `El Challenge se guardó, pero ${revalidationError.message}` : 'El Challenge se guardó, pero no se pudo revalidar.')
    } finally { setSaving(false) }
  }

  return <form onSubmit={submit} className="space-y-5">
    <div className="grid gap-5 md:grid-cols-2">
      <Field label="Prop Firm"><select disabled={!canUpdate || saving} value={platformId} onChange={(event) => setPlatformId(event.target.value)} className={INPUT} required>{platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}</select></Field>
      <Field label="Estado"><select disabled={!canUpdate || saving} value={status} onChange={(event) => setStatus(event.target.value)} className={INPUT}><option value="draft">Borrador</option><option value="active">Activo</option><option value="inactive">Inactivo</option></select></Field>
      <Field label="Nombre"><input disabled={!canUpdate || saving} value={name} onChange={(event) => setName(event.target.value)} className={INPUT} required /></Field>
      <Field label="Slug global"><input disabled={!canUpdate || saving} value={slug} onChange={(event) => setSlug(normalizeChallengeSlug(event.target.value))} className={INPUT} required /><p className="mt-1 text-xs text-slate-500">Debe ser único en toda Tradagora.</p></Field>
      <Field label="Tipo"><input disabled={!canUpdate || saving} value={challengeType} onChange={(event) => setChallengeType(event.target.value)} list="challenge-type-suggestions" className={INPUT} /><datalist id="challenge-type-suggestions">{suggestions.map((value) => <option key={value} value={value} />)}</datalist><p className="mt-1 text-xs text-slate-500">Texto compatible con la taxonomía legacy.</p></Field>
      <Field label="Fases declaradas"><input disabled={!canUpdate || saving} type="number" min="0" step="1" value={phases} onChange={(event) => setPhases(event.target.value)} className={INPUT} /><p className="mt-1 text-xs text-slate-500">Cero es válido para Instant Funding. No modifica fases configuradas.</p></Field>
    </div>
    {mismatch && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Este Challenge declara {declaredPhases ?? 'ningún número de'} fases, pero existen {normalizedPhaseCount} fases configuradas.</p>}
    {!canUpdate && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Tienes acceso de lectura. Se requiere <code>challenges.update</code> para editar.</p>}
    {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {success && <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}
    {canUpdate && <button disabled={saving} className="admin-primary-button px-5 py-3 text-sm">{saving ? 'Guardando…' : 'Guardar cambios'}</button>}
  </form>
}

const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:bg-slate-50 disabled:text-slate-500'
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>{children}</label> }
