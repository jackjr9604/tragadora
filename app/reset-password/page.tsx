'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const supabaseRef = useRef(createClient())
  const initialized = useRef(false)

  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] =
    useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasRecoverySession, setHasRecoverySession] =
    useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (initialized.current) {
      return
    }

    initialized.current = true
    const supabase = supabaseRef.current

    async function initializeRecoverySession() {
      const code = new URLSearchParams(
        window.location.search
      ).get('code')

      let { data } = await supabase.auth.getSession()

      if (!data.session && code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code)

        if (exchangeError) {
          setError(
            'El enlace de recuperación no es válido o ya expiró.'
          )
          setCheckingSession(false)
          return
        }

        const sessionResult =
          await supabase.auth.getSession()
        data = sessionResult.data
      }

      setHasRecoverySession(Boolean(data.session))
      setCheckingSession(false)
    }

    void initializeRecoverySession()
  }, [])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError(
        'La contraseña debe tener al menos 8 caracteres.'
      )
      return
    }

    if (password !== passwordConfirmation) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)

    const { error: updateError } =
      await supabaseRef.current.auth.updateUser({
        password,
      })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    await supabaseRef.current.auth.signOut()

    setSuccess(true)
    setLoading(false)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
        <h1 className="mb-2 text-2xl font-bold">
          Nueva contraseña
        </h1>

        <p className="mb-6 text-sm text-slate-500">
          Establece una nueva contraseña para tu cuenta de Tragadora.
        </p>

        {checkingSession ? (
          <p className="text-sm text-slate-500">
            Verificando enlace de recuperación...
          </p>
        ) : success ? (
          <div className="space-y-4">
            <p
              className="rounded-lg bg-green-50 p-3 text-sm text-green-700"
              role="status"
            >
              Tu contraseña fue actualizada correctamente.
            </p>

            <Link
              href="/login"
              className="block w-full rounded-lg bg-black p-3 text-center text-white"
            >
              Volver al inicio de sesión
            </Link>
          </div>
        ) : hasRecoverySession ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Nueva contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                className="w-full rounded-lg border p-3"
                minLength={8}
                required
              />
            </div>

            <div>
              <label
                htmlFor="password-confirmation"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Confirmar contraseña
              </label>
              <input
                id="password-confirmation"
                type="password"
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={(event) =>
                  setPasswordConfirmation(event.target.value)
                }
                className="w-full rounded-lg border p-3"
                minLength={8}
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-black p-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? 'Actualizando...'
                : 'Actualizar contraseña'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-red-600" role="alert">
              {error ||
                'El enlace de recuperación no es válido o ya expiró.'}
            </p>

            <Link
              href="/login"
              className="block text-sm font-medium text-slate-700 underline"
            >
              Volver al inicio de sesión
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
