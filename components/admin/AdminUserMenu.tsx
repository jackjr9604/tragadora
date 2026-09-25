'use client'

import Link from 'next/link'
import { ChevronDown, ExternalLink, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const ROLE_LABELS = {
  super_admin: 'Superadministrador',
  admin: 'Administrador',
  editor: 'Editor',
  user: 'Usuario',
} as const

export function AdminUserMenu({ name, email, role, mobile = false }: { name: string | null; email: string | null; role: keyof typeof ROLE_LABELS | null; mobile?: boolean }) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const label = name || email || 'Usuario'
  const initials = label.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U'

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  async function signOut() {
    setSigningOut(true)
    setError('')
    const { error: signOutError } = await createClient().auth.signOut()
    if (signOutError) {
      setError('No fue posible cerrar la sesión.')
      setSigningOut(false)
      return
    }
    router.replace('/login')
    router.refresh()
  }

  return <div ref={rootRef} className={`admin-user-menu ${mobile ? 'mobile' : ''}`}>
    <button type="button" className="admin-user-trigger" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((current) => !current)}>
      <span className="admin-user-avatar">{initials}</span>
      <span className="min-w-0 flex-1 text-left"><strong>{label}</strong><small>{ROLE_LABELS[role ?? 'user']}</small></span>
      <ChevronDown className={`size-4 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="admin-user-popover" role="menu">
      {email && name && <p className="admin-user-email">{email}</p>}
      <Link href="/" role="menuitem" onClick={() => setOpen(false)}><ExternalLink className="size-4" /> Ver sitio público</Link>
      <button type="button" role="menuitem" className="admin-logout-action" disabled={signingOut} onClick={signOut}><LogOut className="size-4" />{signingOut ? 'Cerrando…' : 'Cerrar sesión'}</button>
      {error && <p className="admin-user-error">{error}</p>}
    </div>}
  </div>
}
