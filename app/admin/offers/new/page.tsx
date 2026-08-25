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
}

export default function NewOfferPage() {
  const router = useRouter()
  const supabase = createClient()

  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])

  const [platformId, setPlatformId] = useState('')
  const [challengeId, setChallengeId] = useState('')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const [discountValue, setDiscountValue] = useState('')
  const [discountType, setDiscountType] =
    useState('percentage')

  const [promoCode, setPromoCode] = useState('')

  const [countryCode, setCountryCode] = useState('')
  const [language, setLanguage] = useState('es')

  const [startsAt, setStartsAt] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

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
        .select('id, name')
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
      .from('offers')
      .insert({
        platform_id: platformId,
        challenge_id: challengeId || null,
        title,
        description: description || null,
        discount_value: Number(discountValue),
        discount_type: discountType,
        promo_code: promoCode || null,
        country_code: countryCode
          ? countryCode.toUpperCase()
          : null,
        language: language || null,
        starts_at: startsAt
          ? new Date(startsAt).toISOString()
          : null,
        expires_at: expiresAt
          ? new Date(expiresAt).toISOString()
          : null,
        status: 'true',
      })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/admin/offers')
    router.refresh()
  }

  return (
    <main className="p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-3xl font-bold">
          Nueva oferta
        </h1>

        <p className="mb-8 text-slate-500">
          Crea una promoción para una Prop Firm.
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-xl bg-white p-8 shadow"
        >
          {/* PROP FIRM */}

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

          {/* CHALLENGE */}

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

          {/* TITULO */}

          <div>
            <label className="mb-2 block text-sm font-medium">
              Título
            </label>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="20% de descuento"
              className="w-full rounded-lg border p-3"
              required
            />
          </div>

          {/* DESCRIPCION */}

          <div>
            <label className="mb-2 block text-sm font-medium">
              Descripción
            </label>

            <textarea
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
              placeholder="Obtén un descuento especial..."
              className="min-h-28 w-full rounded-lg border p-3"
            />
          </div>

          {/* DESCUENTO */}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Descuento
              </label>

              <input
                type="number"
                step="0.01"
                value={discountValue}
                onChange={(e) =>
                  setDiscountValue(e.target.value)
                }
                placeholder="20"
                className="w-full rounded-lg border p-3"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Tipo
              </label>

              <select
                value={discountType}
                onChange={(e) =>
                  setDiscountType(e.target.value)
                }
                className="w-full rounded-lg border p-3"
              >
                <option value="percentage">
                  Porcentaje
                </option>

                <option value="fixed">
                  Cantidad fija
                </option>
              </select>
            </div>
          </div>

          {/* CODIGO */}

          <div>
            <label className="mb-2 block text-sm font-medium">
              Código promocional
            </label>

            <input
              value={promoCode}
              onChange={(e) =>
                setPromoCode(e.target.value)
              }
              placeholder="TRAGADORA20"
              className="w-full rounded-lg border p-3 uppercase"
            />
          </div>

          {/* PAIS + IDIOMA */}

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
                Vacío = todos los países.
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

          {/* FECHAS */}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Inicio
              </label>

              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) =>
                  setStartsAt(e.target.value)
                }
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Finalización
              </label>

              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) =>
                  setExpiresAt(e.target.value)
                }
                className="w-full rounded-lg border p-3"
              />
            </div>
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
                router.push('/admin/offers')
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
                : 'Crear oferta'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
