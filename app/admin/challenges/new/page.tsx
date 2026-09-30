'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { challengeMutationError, normalizeChallengeSlug, optionalInteger, revalidateChallengeData } from '@/lib/challenge-admin'

type Platform = {
  id: string
  name: string
  slug: string
}

const supabase = createClient()

export default function NewChallengePage() {
  const router = useRouter()

  const [platforms, setPlatforms] = useState<Platform[]>([])

  const [platformId, setPlatformId] = useState('')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [challengeType, setChallengeType] = useState('')
  const [phases, setPhases] = useState('')
  const [status, setStatus] = useState('draft')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadPlatforms() {
      const { data } = await supabase
        .from('platforms')
        .select('id, name, slug')
        .eq('type', 'prop_firm')
        .order('name')

      setPlatforms(data ?? [])

      const requestedPlatform = new URLSearchParams(
        window.location.search
      ).get('platform')

      if (
        requestedPlatform &&
        (data ?? []).some(
          (platform) => platform.id === requestedPlatform
        )
      ) {
        setPlatformId(requestedPlatform)
      }
    }

    loadPlatforms()
  }, [])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setError('')
    const normalizedSlug = normalizeChallengeSlug(slug)
    const parsedPhases = optionalInteger(phases)
    if (!platformId || !name.trim() || !normalizedSlug) return setError('Prop Firm, nombre y slug son obligatorios.')
    if (parsedPhases !== null && (!Number.isInteger(Number(phases)) || parsedPhases < 0)) return setError('El número de fases debe ser un entero mayor o igual a cero.')
    setLoading(true)

    const duplicate = await supabase.from('challenges').select('id').eq('slug', normalizedSlug).maybeSingle()
    if (duplicate.error) { setError(duplicate.error.message); setLoading(false); return }
    if (duplicate.data) { setError('Ese slug ya está siendo utilizado por otro Challenge.'); setLoading(false); return }

    const { error } = await supabase
      .from('challenges')
      .insert({
        platform_id: platformId,
        name: name.trim(),
        slug: normalizedSlug,
        challenge_type: challengeType.trim() || null,
        phases: parsedPhases,
        status,
      })

    if (error) {
      setError(challengeMutationError(error.message, 'challenge'))
      setLoading(false)
      return
    }

    const platform = platforms.find((item) => item.id === platformId)
    try {
      await revalidateChallengeData('create', platform ? [platform.slug] : [])
      router.push(`/admin/challenges/platform/${platformId}`)
      router.refresh()
    } catch (revalidationError) {
      setError(revalidationError instanceof Error ? `El Challenge se creó, pero ${revalidationError.message}` : 'El Challenge se creó, pero no se pudo revalidar.')
      setLoading(false)
    }
  }

  return (
    <main className="p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-3xl font-bold">
          Nuevo Challenge
        </h1>

        <p className="mb-8 text-slate-500">
          Añade un modelo de evaluación.
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-xl bg-white p-8 shadow"
        >
          <div>
            <label className="mb-2 block text-sm font-medium">
              Prop Firm
            </label>

            <select
              value={platformId}
              onChange={(e) =>
                setPlatformId(e.target.value)
              }
              className="w-full rounded-lg border p-3"
              required
            >
              <option value="">
                Selecciona una Prop Firm
              </option>

              {platforms.map((platform) => (
                <option
                  key={platform.id}
                  value={platform.id}
                >
                  {platform.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Nombre
            </label>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. 2-Step"
              className="w-full rounded-lg border p-3"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Slug
            </label>

            <input
              value={slug}
              onChange={(e) => setSlug(normalizeChallengeSlug(e.target.value))}
              placeholder="ftmo-2-step"
              className="w-full rounded-lg border p-3"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Tipo
            </label>

            <input
              value={challengeType}
              onChange={(e) =>
                setChallengeType(e.target.value)
              }
              placeholder="2 Step"
              className="w-full rounded-lg border p-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Número de fases
            </label>

            <input
              type="number"
              min="0"
              step="1"
              value={phases}
              onChange={(e) =>
                setPhases(e.target.value)
              }
              placeholder="2"
              className="w-full rounded-lg border p-3"
            />
          </div>

          <div><label className="mb-2 block text-sm font-medium">Estado</label><select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-lg border p-3"><option value="draft">Borrador</option><option value="active">Activo</option><option value="inactive">Inactivo</option></select></div>

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
                  platformId
                    ? `/admin/challenges/platform/${platformId}`
                    : '/admin/challenges'
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
                : 'Crear Challenge'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
