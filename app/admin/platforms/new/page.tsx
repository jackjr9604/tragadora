'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function NewPlatformPage() {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [logoUrl, setLogoUrl] = useState('')

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

    const { data: platform, error: platformError } =
      await supabase
        .from('platforms')
        .insert({
          name,
          slug,
          type: 'prop_firm',
          website_url: websiteUrl || null,
          logo_url: logoUrl || null,
          status: 'active',
        })
        .select()
        .single()

    if (platformError) {
      setError(platformError.message)
      setLoading(false)
      return
    }

    const { error: detailsError } = await supabase
      .from('prop_firm_details')
      .insert({
        platform_id: platform.id,
        profit_split_min: profitSplitMin
          ? Number(profitSplitMin)
          : null,
        profit_split_max: profitSplitMax
          ? Number(profitSplitMax)
          : null,
        supports_ea: supportsEa,
        allows_news_trading: allowsNews,
        allows_weekend_holding: allowsWeekend,
      })

    if (detailsError) {
      setError(detailsError.message)
      setLoading(false)
      return
    }

    const { error: translationError } = await supabase
      .from('platform_translations')
      .insert({
        platform_id: platform.id,
        language: 'es',
        short_description: description,
      })

    if (translationError) {
      setError(translationError.message)
      setLoading(false)
      return
    }

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
          Registra una nueva Prop Firm en Tragadora.
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

          <div>
            <label className="mb-2 block text-sm font-medium">
              URL del logo
            </label>

            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border p-3"
            />
          </div>

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
