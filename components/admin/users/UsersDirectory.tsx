'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { SearchInput } from '@/components/shared/SearchInput'
import type { AdminRole } from '@/lib/admin-permissions'

export type UserListRow = {
  id: string; email: string; name: string | null; username: string | null;
  role: AdminRole | null; adminAccess: boolean; createdAt: string; lastAccess: string | null
}

export function UsersDirectory({ users }: { users: UserListRow[] }) {
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('all')
  const visible = useMemo(() => users.filter((user) => role === 'all' || user.role === role).filter((user) => `${user.email} ${user.name ?? ''} ${user.username ?? ''}`.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'))), [users, search, role])
  return <>
    <div className="mb-4 grid gap-3 rounded-xl bg-white p-3 shadow-sm sm:grid-cols-[1fr_200px_auto]"><SearchInput value={search} onChange={setSearch} placeholder="Buscar nombre o email..." /><select value={role} onChange={(event) => setRole(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="all">Todos los roles</option><option value="super_admin">Super Admin</option><option value="admin">Admin</option><option value="editor">Editor</option><option value="user">Usuario</option></select><button type="button" onClick={() => { setSearch(''); setRole('all') }} className="rounded-xl border px-3 py-2.5 text-sm">Limpiar filtros</button></div>
    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">{visible.length} {visible.length === 1 ? 'usuario' : 'usuarios'}</p>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b bg-slate-50 text-slate-500"><tr><th className="p-4">Usuario</th><th className="p-4">Rol base</th><th className="p-4">Acceso admin</th><th className="p-4">Creado</th><th className="p-4">Último acceso</th><th className="p-4">Acción</th></tr></thead><tbody>{visible.map((user) => <tr key={user.id} className="border-b last:border-0"><td className="p-4"><p className="font-semibold">{user.name || user.username || user.email}</p><p className="text-slate-500">{user.email}</p></td><td className="p-4">{user.role ?? 'Sin perfil'}</td><td className="p-4">{user.adminAccess ? 'Sí' : 'No'}</td><td className="p-4">{date(user.createdAt)}</td><td className="p-4">{date(user.lastAccess)}</td><td className="p-4"><Link href={`/admin/users/${user.id}`} className="rounded-lg border px-3 py-2 font-medium">Gestionar</Link></td></tr>)}{visible.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-slate-500">{search ? `No encontramos usuarios que coincidan con «${search.trim()}».` : 'No hay usuarios con estos filtros.'}</td></tr>}</tbody></table></div>
  </>
}

function date(value: string | null) { return value ? new Date(value).toLocaleDateString('es-CO') : '—' }
