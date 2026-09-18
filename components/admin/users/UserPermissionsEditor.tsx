'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PermissionCards } from './PermissionCards'
import { PERMISSION_KEYS, type AdminRole, type PermissionKey } from '@/lib/admin-permissions'

type Props = {
  targetId: string; actorId: string; initialRole: AdminRole;
  presets: Record<string, boolean>; initialOverrides: Record<string, boolean>
}

export function UserPermissionsEditor({ targetId, actorId, initialRole, presets, initialOverrides }: Props) {
  const router = useRouter()
  const [role, setRole] = useState<AdminRole>(initialRole)
  const [newRole, setNewRole] = useState<AdminRole>(initialRole)
  const [keepOverrides, setKeepOverrides] = useState(true)
  const [overrides, setOverrides] = useState(initialOverrides)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const effective = Object.fromEntries(PERMISSION_KEYS.map((key) => [key, role === 'super_admin' || (Object.hasOwn(overrides, key) ? overrides[key] : Boolean(presets[`${role}:${key}`]))])) as Record<string, boolean>

  async function send(payload: Record<string, unknown>) {
    const response = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await response.json() as { error?: string }
    if (!response.ok) throw new Error(data.error || 'No se pudieron guardar los cambios')
  }
  async function changeRole() {
    if (newRole === role) return
    const prompt = newRole === 'super_admin' ? 'Escribe SUPER ADMIN para confirmar el acceso total:' : `Cambiar el rol de ${role} a ${newRole}?`
    if (newRole === 'super_admin' ? window.prompt(prompt) !== 'SUPER ADMIN' : !window.confirm(prompt)) return
    if (targetId === actorId && role === 'super_admin' && newRole !== 'super_admin' && !window.confirm('Estás intentando degradar tu propia cuenta. Solo es posible si existe otro super_admin. ¿Continuar?')) return
    setWorking(true); setError('')
    try { await send({ type: 'role', targetId, role: newRole, keepOverrides }); setRole(newRole); if (!keepOverrides) setOverrides({}); router.refresh() } catch (failure) { setError(failure instanceof Error ? failure.message : 'Error desconocido') } finally { setWorking(false) }
  }
  async function setPermission(key: PermissionKey, allowed: boolean | null) {
    if (role === 'super_admin') return
    setWorking(true); setError('')
    try { await send({ type: 'override', targetId, key, allowed }); setOverrides((current) => { const next = { ...current }; if (allowed === null) delete next[key]; else next[key] = allowed; return next }); router.refresh() } catch (failure) { setError(failure instanceof Error ? failure.message : 'Error desconocido') } finally { setWorking(false) }
  }
  async function setModule(keys: PermissionKey[], mode: 'none' | 'all' | 'read') {
    setWorking(true); setError('')
    const values = Object.fromEntries(keys.map((key) => [key, mode === 'all' || (mode === 'read' && key.endsWith('.view'))])) as Record<string, boolean>
    try { for (const key of keys) await send({ type: 'override', targetId, key, allowed: values[key] }); setOverrides((current) => ({ ...current, ...values })); router.refresh() } catch (failure) { setError(failure instanceof Error ? failure.message : 'Error desconocido'); router.refresh() } finally { setWorking(false) }
  }
  async function reset() {
    if (!window.confirm('¿Eliminar todos los permisos personalizados y restaurar los del rol?')) return
    setWorking(true); setError('')
    try { await send({ type: 'reset', targetId }); setOverrides({}); router.refresh() } catch (failure) { setError(failure instanceof Error ? failure.message : 'Error desconocido') } finally { setWorking(false) }
  }

  return <div className="space-y-6"><section className="rounded-xl border bg-white p-5"><h2 className="text-lg font-semibold">Rol base</h2><div className="mt-3 flex flex-wrap items-center gap-3"><select value={newRole} onChange={(event) => setNewRole(event.target.value as AdminRole)} disabled={working} className="rounded-lg border px-3 py-2"><option value="user">Usuario</option><option value="editor">Editor</option><option value="admin">Admin</option><option value="super_admin">Super Admin</option></select><button type="button" onClick={() => void changeRole()} disabled={working || newRole === role} className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-40">Cambiar rol</button></div><fieldset className="mt-3 flex flex-wrap gap-4 text-sm"><legend className="mb-1 text-slate-500">Al cambiar el rol:</legend><label><input type="radio" checked={keepOverrides} onChange={() => setKeepOverrides(true)} /> Conservar permisos personalizados</label><label><input type="radio" checked={!keepOverrides} onChange={() => setKeepOverrides(false)} /> Restablecer al nuevo rol</label></fieldset>{role === 'super_admin' && <p className="mt-3 text-sm text-amber-700">Super Admin siempre tiene acceso total. El último Super Admin no puede ser degradado.</p>}</section>
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Permisos efectivos</h2><p className="text-sm text-slate-500">Los cambios personalizados tienen prioridad sobre el preset del rol.</p></div><button type="button" onClick={() => void reset()} disabled={working || role === 'super_admin'} className="rounded-lg border bg-white px-3 py-2 text-sm disabled:opacity-40">Restaurar permisos del rol</button></div>
    <PermissionCards effective={effective} customized={overrides} disabled={working || role === 'super_admin'} onSetPermission={(key, allowed) => void setPermission(key, allowed)} onSetModule={(keys, mode) => void setModule(keys, mode)} />
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  </div>
}
