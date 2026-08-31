'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Platform = {
  id: string
  name: string
}

type Challenge = {
  id: string
  name: string
  platform_id: string
}

export default function NewAffiliateLinkPage() {
  const router = useRouter()
  const supabase = createClient()

  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])

  const [platformId, setPlatformId] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [countryCode, setCountryCode] = useState('')
  const [language, setLanguage] = useState('es')
  const [url, setUrl] = useState('')
  const [campaign, setCampaign] = useState('')
  const [priority, setPriority] = useState('1')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadPlatforms() {
      const { data } = await supabase
        .from('platforms')
        .select('id, name')
        .eq('type', 'prop_firm')
        .order('name')

      setPlatforms(data ?? [])
    }

    loadPlatforms()
  }, [])

  useEffect(() => {
    async function loadChallenges() {
      if (!platformId) {
        setChallenges([])
        return
      }

      const { data } = await supabase
        .from('challenges')
        .select('id, name, platform_id')
        .eq('platform_id', platformId)
        .order('name')

      setChallenges(data ?? [])
    }

    loadChallenges()
  }, [platformId])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setLoading(true)
    setError('')

    const { error } = await supabase
      .from('affiliate_links')
      .insert({
        platform_id: platformId,
        challenge_id: challengeId || null,
        country_code: countryCode
          ? countryCode.toUpperCase()
          : null,
        language: language || null,
        url,
        campaign: campaign || null,
        priority: Number(priority),
        status: 'true',
      })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/admin/affiliate-links')
    router.refresh()
  }

  return (
    <main className="p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-3xl font-bold">
          Nuevo enlace de afiliado
        </h1>

        <p className="mb-8 text-slate-500">
          Configura un enlace de referido.
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
              onChange={(e) => {
                setPlatformId(e.target.value)
                setChallengeId('')
              }}
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
              Challenge
            </label>

            <select
              value={challengeId}
              onChange={(e) =>
                setChallengeId(e.target.value)
              }
              className="w-full rounded-lg border p-3"
            >
              <option value="">
                Todos los Challenges
              </option>

              {challenges.map((challenge) => (
                <option
                  key={challenge.id}
                  value={challenge.id}
                >
                  {challenge.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                País
              </label>

              <input
                value={countryCode}
                onChange={(e) =>
                  setCountryCode(e.target.value)
                }
                placeholder="CO"
                maxLength={2}
                className="w-full rounded-lg border p-3 uppercase"
              />

              <p className="mt-1 text-xs text-slate-500">
                Déjalo vacío para todos los países.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Idioma
              </label>

              <select
                value={language}
                onChange={(e) =>
                  setLanguage(e.target.value)
                }
                className="w-full rounded-lg border p-3"
              >
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="pt">Português</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              URL de referido
            </label>

            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border p-3"
              required
            />

            <p className="mt-1 text-xs text-slate-500">
              Este será el enlace al que enviaremos al usuario.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Campaña
            </label>

            <input
              value={campaign}
              onChange={(e) =>
                setCampaign(e.target.value)
              }
              placeholder="tradagora-home"
              className="w-full rounded-lg border p-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Prioridad
            </label>

            <input
              type="number"
              min="1"
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value)
              }
              className="w-full rounded-lg border p-3"
            />

            <p className="mt-1 text-xs text-slate-500">
              1 = mayor prioridad.
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() =>
                router.push('/admin/affiliate-links')
              }
              className="rounded-lg border px-5 py-3"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
            >
              {loading
                ? 'Guardando...'
                : 'Crear enlace'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
