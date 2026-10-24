'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MediaPicker, type PickedMedia } from '@/components/admin/MediaPicker'
import { savePropFirmSource } from '@/app/admin/platform-actions'

export default function NewPlatformPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [logoMedia, setLogoMedia] = useState<PickedMedia | null>(null)

  const [profitSplitMin, setProfitSplitMin] = useState('')
  const [profitSplitMax, setProfitSplitMax] = useState('')

  const [supportsEa, setSupportsEa] = useState(false)
  const [allowsNews, setAllowsNews] = useState(false)
  const [allowsWeekend, setAllowsWeekend] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setLoading(true)
    setError('')

    const result = await savePropFirmSource({
      name: name.trim(), slug: slug.trim(), description, websiteUrl: websiteUrl.trim() || null, logoMediaId: logoMedia?.id ?? null,
      status: 'active', score: null, originCountryCode: null, ceoName: null, foundedAt: null, brokerProvider: null,
      inactivityDays: null, isNew: false, profitSplitMin: profitSplitMin ? Number(profitSplitMin) : null,
      profitSplitMax: profitSplitMax ? Number(profitSplitMax) : null, supportsEa, allowsNews, allowsWeekend,
      allowsScalping: null, allowsDayTrading: null, allowsCopyTrading: null, timeLimitPolicy: null,
      consistencyRules: null, specialRules: null, markets: [], tradingPlatformIds: [], instrumentCategoryIds: [], transactionMethods: [],
    })
    if (!result.ok) { setError(result.message); setLoading(false); return }

    router.push('/admin/platforms')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold">
          Nueva Prop Firm
        </h1>

        <p className="mt-1 mb-8 text-slate-500">
          Registra una nueva Prop Firm en Tradagora.
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-xl bg-white p-8 shadow"
        >
          <div>
            <label className="mb-2 block text-sm font-medium">
              Nombre
            </label>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. FTMO"
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
              onChange={(e) => setSlug(e.target.value)}
              placeholder="ftmo"
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
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción de la Prop Firm..."
              className="min-h-32 w-full rounded-lg border p-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Sitio web
            </label>

            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border p-3"
            />
          </div>

          <MediaPicker label="Logo" value={logoMedia} onChange={setLogoMedia} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Profit Split mínimo %
              </label>

              <input
                type="number"
                step="0.01"
                value={profitSplitMin}
                onChange={(e) =>
                  setProfitSplitMin(e.target.value)
                }
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Profit Split máximo %
              </label>

              <input
                type="number"
                step="0.01"
                value={profitSplitMax}
                onChange={(e) =>
                  setProfitSplitMax(e.target.value)
                }
                className="w-full rounded-lg border p-3"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={supportsEa}
                onChange={(e) =>
                  setSupportsEa(e.target.checked)
                }
              />
              Permite EA / Bots
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={allowsNews}
                onChange={(e) =>
                  setAllowsNews(e.target.checked)
                }
              />
              Permite operar noticias
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={allowsWeekend}
                onChange={(e) =>
                  setAllowsWeekend(e.target.checked)
                }
              />
              Permite mantener operaciones el fin de semana
            </label>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
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
                : 'Crear Prop Firm'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
