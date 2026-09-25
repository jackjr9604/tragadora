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
    <main className="admin-login flex min-h-screen items-center justify-center p-4">
      <div className="admin-login-card">
        <div className="mb-7 flex items-center gap-3 border-b border-slate-100 pb-6"><span className="admin-login-mark">T</span><div><p className="text-xl font-bold tracking-tight text-slate-950">Tradagora</p><p className="text-xs font-semibold uppercase tracking-[.16em] text-amber-700">Administración</p></div></div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">Bienvenido</h1>
        <p className="mt-2 mb-6 text-sm leading-6 text-slate-500">Ingresa con tu cuenta autorizada para administrar el contenido y los catálogos.</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <label className="block"><span className="mb-2 block">Correo electrónico</span><input
            type="email"
            autoComplete="email"
            placeholder="nombre@dominio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          /></label>

          <label className="block"><span className="mb-2 block">Contraseña</span><input
            type="password"
            autoComplete="current-password"
            placeholder="Tu contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          /></label>

          {error && (
            <p className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          {recoveryMessage && (
            <p
              className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700"
              role="status"
            >
              {recoveryMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="admin-login-primary"
          >
            {loading ? 'Ingresando...' : 'Iniciar sesión'}
          </button>

          <button
            type="button"
            onClick={handlePasswordRecovery}
            disabled={loading || recoveryLoading}
            className="w-full rounded-lg py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
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
