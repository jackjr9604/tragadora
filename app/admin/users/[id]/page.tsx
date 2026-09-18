import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/admin-permissions-server'
import { UserPermissionsEditor } from '@/components/admin/users/UserPermissionsEditor'
import type { AdminRole } from '@/lib/admin-permissions'

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const actorId = await requireSuperAdmin()
  const { id } = await params
  const admin = createAdminClient()
  const [authUser, profile, presets, overrides, history] = await Promise.all([
    admin.auth.admin.getUserById(id),
    admin.from('profiles').select('id, role, name, username').eq('id', id).maybeSingle(),
    admin.from('role_permissions').select('role, permission_key, allowed'),
    admin.from('user_permission_overrides').select('permission_key, allowed').eq('user_id', id),
    admin.from('admin_audit_log').select('id, action, created_at, previous_value, new_value').eq('target_user_id', id).order('created_at', { ascending: false }).limit(12),
  ])
  if (authUser.error || !authUser.data.user || !profile.data) notFound()
  const presetMap = Object.fromEntries((presets.data ?? []).map((row) => [`${row.role}:${row.permission_key}`, row.allowed])) as Record<string, boolean>
  const overrideMap = Object.fromEntries((overrides.data ?? []).map((row) => [row.permission_key, row.allowed])) as Record<string, boolean>

  return <main className="p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-6xl"><Link href="/admin/users" className="text-sm text-slate-600 hover:underline">← Usuarios</Link><h1 className="mt-4 text-3xl font-bold">{profile.data.name || authUser.data.user.email || 'Usuario'}</h1><div className="my-6 grid gap-3 rounded-xl border bg-white p-5 text-sm sm:grid-cols-2"><p><span className="text-slate-500">Email:</span> {authUser.data.user.email || '—'}</p><p><span className="text-slate-500">Username:</span> {profile.data.username || '—'}</p><p><span className="text-slate-500">Rol:</span> {profile.data.role}</p><p><span className="text-slate-500">Último acceso:</span> {authUser.data.user.last_sign_in_at ? new Date(authUser.data.user.last_sign_in_at).toLocaleString('es-CO') : '—'}</p></div>
    <UserPermissionsEditor targetId={id} actorId={actorId} initialRole={profile.data.role as AdminRole} presets={presetMap} initialOverrides={overrideMap} />
    {history.data && history.data.length > 0 && <section className="mt-8 rounded-xl border bg-white p-5"><h2 className="font-semibold">Actividad administrativa reciente</h2><ul className="mt-3 space-y-2 text-sm">{history.data.map((event) => <li key={event.id} className="border-t pt-2"><time className="text-slate-500">{new Date(event.created_at).toLocaleString('es-CO')}</time> · {event.action}</li>)}</ul></section>}
  </div></main>
}
