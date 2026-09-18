import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/admin-permissions-server'
import { UsersDirectory, type UserListRow } from '@/components/admin/users/UsersDirectory'

export default async function AdminUsersPage() {
  await requireSuperAdmin()
  const admin = createAdminClient()
  const [profilesResult, presetResult, overrideResult] = await Promise.all([
    admin.from('profiles').select('id, role, name, username, created_at'),
    admin.from('role_permissions').select('role, permission_key, allowed'),
    admin.from('user_permission_overrides').select('user_id, permission_key, allowed'),
  ])
  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]))
  const preset = new Map<string, boolean>((presetResult.data ?? []).map((row) => [`${row.role}:${row.permission_key}`, row.allowed]))
  const overrides = new Map<string, boolean>((overrideResult.data ?? []).map((row) => [`${row.user_id}:${row.permission_key}`, row.allowed]))

  const authUsers = []
  let authError: string | null = null
  for (let page = 1; page <= 100; page++) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (result.error) { authError = result.error.message; break }
    authUsers.push(...result.data.users)
    if (result.data.users.length < 1000) break
  }
  const rows: UserListRow[] = authUsers.map((user) => {
    const profile = profiles.get(user.id)
    const role = profile?.role ?? null
    const adminAccess = role === 'super_admin' || (role !== null && ['dashboard', 'home', 'platforms', 'platform_research', 'challenges', 'payouts', 'offers', 'affiliate_links', 'content', 'media'].some((module) => {
      const key = `${module}.view`
      return overrides.get(`${user.id}:${key}`) ?? preset.get(`${role}:${key}`) ?? false
    }))
    return { id: user.id, email: user.email ?? '', name: profile?.name ?? null, username: profile?.username ?? null, role, adminAccess, createdAt: user.created_at, lastAccess: user.last_sign_in_at ?? null }
  })

  return <main className="p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-6xl"><div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-bold">Usuarios</h1><p className="mt-1 text-sm text-slate-500">Roles base y permisos administrativos.</p></div><Link href="/admin/users/roles" className="rounded-lg border bg-white px-4 py-2.5 text-sm font-medium">Editar presets de roles</Link></div>
    {(authError || profilesResult.error || presetResult.error || overrideResult.error) && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{authError ?? profilesResult.error?.message ?? presetResult.error?.message ?? overrideResult.error?.message}. La migración local de permisos debe revisarse y aplicarse antes de administrar roles.</p>}
    <UsersDirectory users={rows} />
  </div></main>
}
