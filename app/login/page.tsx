'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [recoveryLoading, setRecoveryLoading] =
    useState(false)
  const [recoveryMessage, setRecoveryMessage] =
    useState('')

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
  console.error('SUPABASE LOGIN ERROR:', error)

  setError(error.message)

  setLoading(false)
  return
}

    router.push('/admin')
    router.refresh()
  }

  async function handlePasswordRecovery() {
    setError('')
    setRecoveryMessage('')

    if (!email) {
      setError(
        'Escribe tu correo electrónico para recuperar la contraseña.'
      )
      return
    }

    setRecoveryLoading(true)

    const { error: recoveryError } =
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo:
          `${window.location.origin}/reset-password`,
      })

    if (recoveryError) {
      setError(recoveryError.message)
      setRecoveryLoading(false)
      return
    }

    setRecoveryMessage(
      'Revisa tu correo para continuar con la recuperación.'
    )
    setRecoveryLoading(false)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
        <h1 className="mb-2 text-2xl font-bold">
          Tragadora
        </h1>

        <p className="mb-6 text-sm text-slate-500">
          Panel de administración
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border p-3"
            required
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border p-3"
            required
          />

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          {recoveryMessage && (
            <p
              className="text-sm text-green-700"
              role="status"
            >
              {recoveryMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black p-3 text-white"
          >
            {loading ? 'Ingresando...' : 'Iniciar sesión'}
          </button>

          <button
            type="button"
            onClick={handlePasswordRecovery}
            disabled={loading || recoveryLoading}
            className="w-full text-sm font-medium text-slate-600 underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {recoveryLoading
              ? 'Enviando enlace...'
              : 'Olvidé mi contraseña'}
          </button>
        </form>
      </div>
    </main>
  )
}
