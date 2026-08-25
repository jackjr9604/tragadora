'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Content = {
  id: string
  key: string
  language: string
  value: string
  type: string
  updated_at: string
}

type Language = {
  code: string
  name: string
  flag: string
}

const languages: Language[] = [
  {
    code: 'es',
    name: 'Español',
    flag: '🇪🇸',
  },
  {
    code: 'en',
    name: 'English',
    flag: '🇺🇸',
  },
  {
    code: 'pt',
    name: 'Português',
    flag: '🇧🇷',
  },
]

export default function ContentPage() {
  const supabase = createClient()

  const [contents, setContents] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)

  const [key, setKey] = useState('')
  const [type, setType] = useState('text')

  const [values, setValues] = useState<
    Record<string, string>
  >({})

  const [selectedLanguages, setSelectedLanguages] =
    useState<string[]>(['es'])

  async function loadContents() {
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('site_content')
      .select('*')
      .order('key')
      .order('language')

    if (error) {
      setError(error.message)
    } else {
      setContents(data ?? [])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadContents()
  }, [])

  function resetForm() {
    setKey('')
    setType('text')
    setValues({})
    setSelectedLanguages(['es'])
    setEditingKey(null)
    setShowForm(false)
  }

  function toggleLanguage(code: string) {
    setSelectedLanguages((current) => {
      if (current.includes(code)) {
        return current.filter(
          (language) => language !== code
        )
      }

      return [...current, code]
    })
  }

  function updateValue(
    language: string,
    value: string
  ) {
    setValues((current) => ({
      ...current,
      [language]: value,
    }))
  }

  function getLanguagesForKey(
    contentKey: string
  ) {
    return contents.filter(
      (item) => item.key === contentKey
    )
  }

  function getGroupedKeys() {
    const keys = new Set<string>()

    contents.forEach((item) => {
      keys.add(item.key)
    })

    return Array.from(keys)
  }

  function openCreate() {
    resetForm()
    setShowForm(true)
  }

  function openEdit(contentKey: string) {
    const items = getLanguagesForKey(contentKey)

    const existingLanguages = items.map(
      (item) => item.language
    )

    const existingValues: Record<string, string> = {}

    items.forEach((item) => {
      existingValues[item.language] = item.value
    })

    setKey(contentKey)
    setType(items[0]?.type ?? 'text')
    setValues(existingValues)
    setSelectedLanguages(existingLanguages)
    setEditingKey(contentKey)
    setShowForm(true)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setSaving(true)
    setError('')

    const cleanKey = key.trim()

    if (!cleanKey) {
      setError('La clave es obligatoria.')
      setSaving(false)
      return
    }

    if (selectedLanguages.length === 0) {
      setError(
        'Selecciona al menos un idioma.'
      )
      setSaving(false)
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('Debes iniciar sesión.')
      setSaving(false)
      return
    }

    /*
     * CREACIÓN
     */

    if (!editingKey) {
      const { data: existing } = await supabase
        .from('site_content')
        .select('id')
        .eq('key', cleanKey)
        .limit(1)

      if (existing && existing.length > 0) {
        setError(
          'Esta clave ya existe. Debes editarla en lugar de crearla nuevamente.'
        )
        setSaving(false)
        return
      }

      const rows = selectedLanguages.map(
        (language) => ({
          key: cleanKey,
          language,
          value: values[language] ?? '',
          type,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
      )

      const { error } = await supabase
        .from('site_content')
        .insert(rows)

      if (error) {
        setError(error.message)
        setSaving(false)
        return
      }
    }

    /*
     * EDICIÓN
     */

    else {
      /*
       * No permitimos cambiar el nombre de la clave
       * desde aquí. La clave es el identificador lógico.
       */

      const existingItems =
        getLanguagesForKey(editingKey)

      /*
       * Idiomas que ya existían
       */

      const existingLanguageCodes =
        existingItems.map(
          (item) => item.language
        )

      /*
       * Actualizar o crear idiomas seleccionados
       */

      for (const language of selectedLanguages) {
        const existingItem = existingItems.find(
          (item) => item.language === language
        )

        if (existingItem) {
          const { error } = await supabase
            .from('site_content')
            .update({
              value: values[language] ?? '',
              type,
              updated_by: user.id,
              updated_at:
                new Date().toISOString(),
            })
            .eq('id', existingItem.id)

          if (error) {
            setError(error.message)
            setSaving(false)
            return
          }
        } else {
          const { error } = await supabase
            .from('site_content')
            .insert({
              key: editingKey,
              language,
              value: values[language] ?? '',
              type,
              updated_by: user.id,
              updated_at:
                new Date().toISOString(),
            })

          if (error) {
            setError(error.message)
            setSaving(false)
            return
          }
        }
      }

      /*
       * Eliminar idiomas que fueron desmarcados
       */

      const languagesToDelete =
        existingLanguageCodes.filter(
          (language) =>
            !selectedLanguages.includes(language)
        )

      for (const language of languagesToDelete) {
        const { error } = await supabase
          .from('site_content')
          .delete()
          .eq('key', editingKey)
          .eq('language', language)

        if (error) {
          setError(error.message)
          setSaving(false)
          return
        }
      }
    }

    await loadContents()

    resetForm()

    setSaving(false)
  }

  async function deleteKey(contentKey: string) {
    const confirmed = window.confirm(
      `¿Eliminar completamente la clave "${contentKey}" y todos sus idiomas?`
    )

    if (!confirmed) return

    setError('')

    const { error } = await supabase
      .from('site_content')
      .delete()
      .eq('key', contentKey)

    if (error) {
      setError(error.message)
      return
    }

    await loadContents()
  }

  const groupedKeys = getGroupedKeys()

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Contenido del sitio
            </h1>

            <p className="mt-1 text-slate-500">
              Gestiona los textos de Tragadora por
              idioma.
            </p>
          </div>

          {!showForm && (
            <button
              onClick={openCreate}
              className="rounded-lg bg-black px-5 py-3 text-sm font-medium text-white"
            >
              + Nueva clave
            </button>
          )}
        </div>

        {/* FORMULARIO */}

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-8 rounded-xl bg-white p-6 shadow"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {editingKey
                    ? 'Editar contenido'
                    : 'Nueva clave'}
                </h2>

                {editingKey && (
                  <p className="mt-1 text-sm text-slate-500">
                    {editingKey}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={resetForm}
                className="text-sm text-slate-500 hover:underline"
              >
                Cancelar
              </button>
            </div>

            {/* KEY */}

            <div className="mb-5">
              <label className="mb-2 block text-sm font-medium">
                Clave
              </label>

              <input
                value={key}
                onChange={(e) =>
                  setKey(e.target.value)
                }
                disabled={!!editingKey}
                placeholder="home.hero.title"
                className="w-full rounded-lg border p-3 disabled:bg-slate-100"
                required
              />

              {!editingKey && (
                <p className="mt-1 text-xs text-slate-500">
                  Ejemplo: home.hero.title
                </p>
              )}
            </div>

            {/* TYPE */}

            <div className="mb-5">
              <label className="mb-2 block text-sm font-medium">
                Tipo de contenido
              </label>

              <select
                value={type}
                onChange={(e) =>
                  setType(e.target.value)
                }
                className="w-full rounded-lg border p-3"
              >
                <option value="text">
                  Texto
                </option>

                <option value="textarea">
                  Texto largo
                </option>

                <option value="html">
                  HTML
                </option>
              </select>
            </div>

            {/* LANGUAGES */}

            <div className="mb-6">
              <label className="mb-3 block text-sm font-medium">
                Idiomas disponibles
              </label>

              <div className="flex flex-wrap gap-3">
                {languages.map((language) => {
                  const selected =
                    selectedLanguages.includes(
                      language.code
                    )

                  return (
                    <button
                      key={language.code}
                      type="button"
                      onClick={() =>
                        toggleLanguage(
                          language.code
                        )
                      }
                      className={`rounded-lg border px-4 py-3 text-sm transition ${
                        selected
                          ? 'border-black bg-black text-white'
                          : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      {language.flag}{' '}
                      {language.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* VALUES */}

            <div className="space-y-5">
              {selectedLanguages.map(
                (languageCode) => {
                  const language =
                    languages.find(
                      (item) =>
                        item.code ===
                        languageCode
                    )

                  if (!language) return null

                  return (
                    <div key={language.code}>
                      <label className="mb-2 block text-sm font-medium">
                        {language.flag}{' '}
                        {language.name}
                      </label>

                      <textarea
                        value={
                          values[
                            language.code
                          ] ?? ''
                        }
                        onChange={(e) =>
                          updateValue(
                            language.code,
                            e.target.value
                          )
                        }
                        className="min-h-28 w-full rounded-lg border p-3"
                        placeholder={`Contenido en ${language.name}`}
                        required
                      />
                    </div>
                  )
                }
              )}
            </div>

            {error && (
              <div className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border px-5 py-3"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
              >
                {saving
                  ? 'Guardando...'
                  : editingKey
                    ? 'Guardar cambios'
                    : 'Crear clave'}
              </button>
            </div>
          </form>
        )}

        {/* ERROR GLOBAL */}

        {error && !showForm && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* LISTADO */}

        <div className="overflow-hidden rounded-xl bg-white shadow">

          <div className="border-b p-6">
            <h2 className="text-lg font-semibold">
              Claves de contenido
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Cada clave representa un contenido
              independiente del idioma.
            </p>
          </div>

          {loading ? (
            <p className="p-6 text-slate-500">
              Cargando...
            </p>
          ) : groupedKeys.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-500">
                No hay contenido todavía.
              </p>

              <button
                onClick={openCreate}
                className="mt-4 rounded-lg bg-black px-5 py-3 text-sm text-white"
              >
                Crear primera clave
              </button>
            </div>
          ) : (
            <div className="divide-y">

              {groupedKeys.map(
                (contentKey) => {
                  const items =
                    getLanguagesForKey(
                      contentKey
                    )

                  return (
                    <div
                      key={contentKey}
                      className="p-6"
                    >
                      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

                        <div className="min-w-0">

                          <p className="font-semibold">
                            {contentKey}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {items.map(
                              (item) => {
                                const language =
                                  languages.find(
                                    (lang) =>
                                      lang.code ===
                                      item.language
                                  )

                                return (
                                  <span
                                    key={item.id}
                                    className="rounded-full bg-slate-100 px-3 py-1 text-xs"
                                  >
                                    {language?.flag ??
                                      '🌐'}{' '}
                                    {item.language.toUpperCase()}
                                  </span>
                                )
                              }
                            )}
                          </div>

                          <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                            {items.find(
                              (item) =>
                                item.language ===
                                'es'
                            )?.value ??
                              items[0]?.value}
                          </p>

                        </div>

                        <div className="flex shrink-0 gap-3">
                          <button
                            onClick={() =>
                              openEdit(
                                contentKey
                              )
                            }
                            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
                          >
                            Editar
                          </button>

                          <button
                            onClick={() =>
                              deleteKey(
                                contentKey
                              )
                            }
                            className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            Eliminar
                          </button>
                        </div>

                      </div>
                    </div>
                  )
                }
              )}

            </div>
          )}
        </div>
      </div>
    </main>
  )
}
