'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'

type Platform = {
  id: string
  name: string
}

type Challenge = {
  id: string
  name: string
}

type AffiliateLink = {
  id: string
  url: string
}

export default function EditOfferPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const id = params.id as string

  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [affiliateLinks, setAffiliateLinks] = useState<AffiliateLink[]>([])

  const [platformId, setPlatformId] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [affiliateLinkId, setAffiliateLinkId] = useState('')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [discountValue, setDiscountValue] = useState('')
  const [discountType, setDiscountType] = useState('percentage')
  const [promoCode, setPromoCode] = useState('')
  const [countryCode, setCountryCode] = useState('')
  const [language, setLanguage] = useState('es')
  const [startsAt, setStartsAt] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [priority, setPriority] = useState('1')
  const [status, setStatus] = useState(true)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadData() {
      const [
        offerResult,
        platformsResult,
        affiliateResult,
      ] = await Promise.all([
        supabase
          .from('offers')
          .select('*')
          .eq('id', id)
          .single(),

        supabase
          .from('platforms')
          .select('id, name')
          .eq('type', 'prop_firm')
          .order('name'),

        supabase
          .from('affiliate_links')
          .select('id, url')
          .eq('status', 'active')
          .order('priority'),
      ])

      if (offerResult.error) {
        setError(offerResult.error.message)
        setLoading(false)
        return
      }

      const offer = offerResult.data

      setPlatforms(platformsResult.data ?? [])
      setAffiliateLinks(affiliateResult.data ?? [])

      setPlatformId(offer.platform_id ?? '')
      setChallengeId(offer.challenge_id ?? '')
      setAffiliateLinkId(offer.affiliate_link_id ?? '')

      setTitle(offer.title ?? '')
      setDescription(offer.description ?? '')
      setDiscountValue(
        offer.discount_value?.toString() ?? ''
      )
      setDiscountType(
        offer.discount_type ?? 'percentage'
      )
      setPromoCode(offer.promo_code ?? '')
      setCountryCode(offer.country_code ?? '')
      setLanguage(offer.language ?? 'es')

      setStartsAt(
        offer.starts_at
          ? new Date(offer.starts_at)
              .toISOString()
              .slice(0, 16)
          : ''
      )

      setExpiresAt(
        offer.expires_at
          ? new Date(offer.expires_at)
              .toISOString()
              .slice(0, 16)
          : ''
      )

      setPriority(
        offer.priority?.toString() ?? '1'
      )

      setStatus(offer.status ?? true)

      if (offer.platform_id) {
        const { data } = await supabase
          .from('challenges')
          .select('id, name')
          .eq('platform_id', offer.platform_id)
          .order('name')

        setChallenges(data ?? [])
      }

      setLoading(false)
    }

    loadData()
  }, [id])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setSaving(true)
    setError('')

    const { error } = await supabase
      .from('offers')
      .update({
        platform_id: platformId,
        challenge_id: challengeId || null,
        affiliate_link_id:
          affiliateLinkId || null,

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

        priority: Number(priority),
        status,
      })
      .eq('id', id)

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    router.push('/admin/offers')
    router.refresh()
  }

  async function changePlatform(
    value: string
  ) {
    setPlatformId(value)
    setChallengeId('')

    if (!value) {
      setChallenges([])
      return
    }

    const { data } = await supabase
      .from('challenges')
      .select('id, name')
      .eq('platform_id', value)
      .order('name')

    setChallenges(data ?? [])
  }

  if (loading) {
    return (
      <main className="p-8">
        <p>Cargando oferta...</p>
      </main>
    )
  }

  return (
    <main className="p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-3xl font-bold">
          Editar oferta
        </h1>

        <p className="mb-8 text-slate-500">
          Modifica la información de la promoción.
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
                changePlatform(e.target.value)
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

          <div>
            <label className="mb-2 block text-sm font-medium">
              Enlace de afiliado
            </label>

            <select
              value={affiliateLinkId}
              onChange={(e) =>
                setAffiliateLinkId(e.target.value)
              }
              className="w-full rounded-lg border p-3"
            >
              <option value="">
                Sin enlace específico
              </option>

              {affiliateLinks.map((link) => (
                <option
                  key={link.id}
                  value={link.id}
                >
                  {link.url}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Título
            </label>

            <input
              value={title}
              onChange={(e) =>
                setTitle(e.target.value)
              }
              className="w-full rounded-lg border p-3"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Descripción
            </label>

            <textarea
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
              className="min-h-28 w-full rounded-lg border p-3"
            />
          </div>

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

          <div>
            <label className="mb-2 block text-sm font-medium">
              Código promocional
            </label>

            <input
              value={promoCode}
              onChange={(e) =>
                setPromoCode(e.target.value)
              }
              className="w-full rounded-lg border p-3 uppercase"
            />
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
                maxLength={2}
                placeholder="CO"
                className="w-full rounded-lg border p-3 uppercase"
              />
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
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={status}
              onChange={(e) =>
                setStatus(e.target.checked)
              }
              className="h-4 w-4"
            />

            <span className="text-sm font-medium">
              Oferta activa
            </span>
          </label>

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
              disabled={saving}
              className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
            >
              {saving
                ? 'Guardando...'
                : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
