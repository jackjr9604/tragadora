'use client'

import { ChangeEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Media = {
  id: string
  file_name: string
  file_url: string
  file_type: string | null
  alt_text: string | null
  uploaded_by: string | null
  created_at: string
}

export default function MediaPage() {
  const supabase = createClient()

  const [media, setMedia] = useState<Media[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [altText, setAltText] = useState('')

  const [loading, setLoading] = useState(false)
  const [loadingMedia, setLoadingMedia] = useState(true)
  const [error, setError] = useState('')

  async function loadMedia() {
    setLoadingMedia(true)

    const { data, error } = await supabase
      .from('media')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setMedia(data ?? [])
    }

    setLoadingMedia(false)
  }

 useEffect(() => {
  let cancelled = false

  async function fetchMedia() {
    const { data, error } = await supabase
      .from('media')
      .select('*')
      .order('created_at', { ascending: false })

    if (cancelled) return

    if (error) {
      setError(error.message)
    } else {
      setMedia(data ?? [])
    }

    setLoadingMedia(false)
  }

  fetchMedia()

  return () => {
    cancelled = true
  }
}, [])

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setFile(event.target.files?.[0] ?? null)
  }

  async function uploadFile() {
    if (!file) {
      setError('Selecciona una imagen.')
      return
    }

    setLoading(true)
    setError('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('Debes iniciar sesión.')
      setLoading(false)
      return
    }

    const extension =
      file.name.split('.').pop()?.toLowerCase() || 'jpg'

    const fileName = `${crypto.randomUUID()}.${extension}`

    const filePath = `uploads/${fileName}`

    const { error: uploadError } =
      await supabase.storage
        .from('media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

    if (uploadError) {
      setError(uploadError.message)
      setLoading(false)
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from('media')
      .getPublicUrl(filePath)

    const { error: databaseError } = await supabase
      .from('media')
      .insert({
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        alt_text: altText || null,
        uploaded_by: user.id,
      })

    if (databaseError) {
      setError(databaseError.message)
      setLoading(false)
      return
    }

    setFile(null)
    setAltText('')

    const input = document.getElementById(
      'media-file'
    ) as HTMLInputElement | null

    if (input) {
      input.value = ''
    }

    await loadMedia()

    setLoading(false)
  }

  return (
    <main className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          Multimedia
        </h1>

        <p className="mt-1 text-slate-500">
          Gestiona las imágenes utilizadas en Tragadora.
        </p>
      </div>

      <div className="mb-8 rounded-xl bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold">
          Subir imagen
        </h2>

        <div className="space-y-4">
          <input
            id="media-file"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="block w-full rounded-lg border p-3"
          />

          <input
            type="text"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder="Descripción de la imagen"
            className="w-full rounded-lg border p-3"
          />

          <button
            onClick={uploadFile}
            disabled={loading}
            className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
          >
            {loading ? 'Subiendo...' : 'Subir imagen'}
          </button>
        </div>

        {file && (
          <p className="mt-3 text-sm text-slate-500">
            Seleccionado: {file.name}
          </p>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white p-6 shadow">
        <h2 className="mb-6 text-lg font-semibold">
          Biblioteca
        </h2>

        {loadingMedia ? (
          <p className="text-slate-500">
            Cargando imágenes...
          </p>
        ) : media.length === 0 ? (
          <p className="text-slate-500">
            No hay imágenes todavía.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
            {media.map((item) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-xl border bg-white"
              >
                <div className="aspect-square bg-slate-100">
                  <img
                    src={item.file_url}
                    alt={item.alt_text || item.file_name}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="p-3">
                  <p className="truncate text-sm font-medium">
                    {item.file_name}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {item.file_type || 'Imagen'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
