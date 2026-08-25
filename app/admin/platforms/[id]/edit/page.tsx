'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'

type Media = {
  id: string
  file_name: string
  file_url: string
  alt_text: string | null
}

export default function EditPlatformPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const id = params.id as string

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [logoMediaId, setLogoMediaId] = useState('')
const [media, setMedia] = useState<Media[]>([])

  const [profitSplitMin, setProfitSplitMin] = useState('')
  const [profitSplitMax, setProfitSplitMax] = useState('')

  const [supportsEa, setSupportsEa] = useState(false)
  const [allowsNews, setAllowsNews] = useState(false)
  const [allowsWeekend, setAllowsWeekend] = useState(false)

  const [status, setStatus] = useState('active')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadPlatform() {
      const { data: platform, error } = await supabase
        .from('platforms')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !platform) {
        setError('No se pudo cargar la Prop Firm.')
        setLoading(false)
        return
      }

      setName(platform.name)
      setSlug(platform.slug)
      setWebsiteUrl(platform.website_url ?? '')
      setStatus(platform.status)
      setLogoMediaId(platform.logo_media_id ?? '')

      const { data: details } = await supabase
        .from('prop_firm_details')
        .select('*')
        .eq('platform_id', id)
        .single()

      if (details) {
        setProfitSplitMin(
          details.profit_split_min?.toString() ?? ''
        )

        setProfitSplitMax(
          details.profit_split_max?.toString() ?? ''
        )

        setSupportsEa(details.supports_ea)
        setAllowsNews(details.allows_news_trading)
        setAllowsWeekend(details.allows_weekend_holding)
      }

      const { data: translation } = await supabase
        .from('platform_translations')
        .select('*')
        .eq('platform_id', id)
        .eq('language', 'es')
        .single()

      if (translation) {
        setDescription(
          translation.short_description ?? ''
        )
      }

const { data: mediaData } = await supabase
  .from('media')
  .select(`
    id,
    file_name,
    file_url,
    alt_text
  `)
  .order('created_at', { ascending: false })

setMedia(mediaData ?? [])

      setLoading(false)
    }

    loadPlatform()
  }, [id])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setSaving(true)
    setError('')

    const { error: platformError } = await supabase
      .from('platforms')
      .update({
        name,
        slug,
        website_url: websiteUrl || null,
        logo_media_id: logoMediaId || null,
        status,
      })
      .eq('id', id)

    if (platformError) {
      setError(platformError.message)
      setSaving(false)
      return
    }

    const { error: detailsError } = await supabase
      .from('prop_firm_details')
      .update({
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
      .eq('platform_id', id)

    if (detailsError) {
      setError(detailsError.message)
      setSaving(false)
      return
    }

    const { error: translationError } = await supabase
      .from('platform_translations')
      .update({
        short_description: description,
      })
      .eq('platform_id', id)
      .eq('language', 'es')

    if (translationError) {
      setError(translationError.message)
      setSaving(false)
      return
    }

    router.push('/admin/platforms')
    router.refresh()
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      '¿Seguro que quieres eliminar esta Prop Firm? Esta acción no se puede deshacer.'
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('platforms')
      .delete()
      .eq('id', id)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/admin/platforms')
    router.refresh()
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <p>Cargando...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Editar Prop Firm
          </h1>

          <p className="mt-1 text-slate-500">
            Modifica la información de {name}.
          </p>
        </div>

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
              onChange={(e) =>
                setWebsiteUrl(e.target.value)
              }
              className="w-full rounded-lg border p-3"
            />
          </div>

          <div>
  <label className="mb-2 block text-sm font-medium">
    Logo
  </label>

  <select
    value={logoMediaId}
    onChange={(e) =>
      setLogoMediaId(e.target.value)
    }
    className="w-full rounded-lg border p-3"
  >
    <option value="">
      Sin logo
    </option>

    {media.map((item) => (
      <option
        key={item.id}
        value={item.id}
      >
        {item.file_name}
      </option>
    ))}
  </select>

  {logoMediaId && (
    <div className="mt-4">
      {(() => {
        const selectedMedia = media.find(
          (item) => item.id === logoMediaId
        )

        if (!selectedMedia) return null

        return (
          <div className="flex items-center gap-4">
            <img
              src={selectedMedia.file_url}
              alt={
                selectedMedia.alt_text ||
                selectedMedia.file_name
              }
              className="h-20 w-20 rounded-lg border object-contain"
            />

            <div>
              <p className="text-sm font-medium">
                {selectedMedia.file_name}
              </p>

              <p className="text-xs text-slate-500">
                Logo seleccionado
              </p>
            </div>
          </div>
        )
      })()}
    </div>
  )}
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

          <div>
            <label className="mb-2 block text-sm font-medium">
              Estado
            </label>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border p-3"
            >
              <option value="active">Activa</option>
              <option value="draft">Borrador</option>
              <option value="inactive">Inactiva</option>
            </select>
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

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg border border-red-300 px-5 py-3 text-red-600 hover:bg-red-50"
            >
              Eliminar
            </button>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() =>
                  router.push('/admin/platforms')
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
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  )
}
