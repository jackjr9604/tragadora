'use client'

import { useState } from 'react'
import { PermissionCards } from './PermissionCards'
import { PERMISSION_KEYS, type PermissionKey } from '@/lib/admin-permissions'

export function RolePresetsEditor({ initialPresets }: { initialPresets: Record<string, boolean> }) {
  const [role, setRole] = useState<'admin' | 'editor'>('editor')
  const [presets, setPresets] = useState(initialPresets)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const effective = Object.fromEntries(PERMISSION_KEYS.map((key) => [key, Boolean(presets[`${role}:${key}`])])) as Record<string, boolean>

  async function setKey(key: PermissionKey, allowed: boolean) {
    const response = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'preset', role, key, allowed }) })
    const data = await response.json() as { error?: string }
    if (!response.ok) throw new Error(data.error || 'No se pudo guardar el preset')
    setPresets((current) => ({ ...current, [`${role}:${key}`]: allowed }))
  }
  async function change(keys: PermissionKey[], mode: 'none' | 'all' | 'read') {
    setWorking(true); setError('')
    try { for (const key of keys) await setKey(key, mode === 'all' || (mode === 'read' && key.endsWith('.view'))) } catch (failure) { setError(failure instanceof Error ? failure.message : 'Error desconocido') } finally { setWorking(false) }
  }

  return <><div className="mb-5 flex items-center gap-3"><label htmlFor="preset-role" className="text-sm font-medium">Rol</label><select id="preset-role" value={role} onChange={(event) => setRole(event.target.value as 'admin' | 'editor')} className="rounded-lg border bg-white px-3 py-2"><option value="editor">Editor</option><option value="admin">Admin</option></select></div><PermissionCards effective={effective} disabled={working} onSetPermission={(key, allowed) => void change([key], allowed === true ? 'all' : 'none')} onSetModule={(keys, mode) => void change(keys, mode)} />{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}</>
}
