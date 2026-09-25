import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { ADMIN_MODULES, PERMISSION_KEYS, type AdminRole, type PermissionKey } from '@/lib/admin-permissions'

type Access = { userId: string | null; email: string | null; displayName: string | null; role: AdminRole | null; permissions: Set<PermissionKey> }

export async function getCurrentAdminPermissions(): Promise<Access> {
  const session = await createClient()
  const { data: { user }, error: authError } = await session.auth.getUser()
  if (authError || !user) return { userId: null, email: null, displayName: null, role: null, permissions: new Set() }

  const admin = createAdminClient()
  const profile = await admin.from('profiles').select('role, name, username').eq('id', user.id).maybeSingle()
  if (profile.error || !profile.data) return { userId: user.id, email: user.email ?? null, displayName: null, role: null, permissions: new Set() }
  const role = profile.data.role as AdminRole
  const displayName = profile.data.name || profile.data.username || null
  if (role === 'super_admin') return { userId: user.id, email: user.email ?? null, displayName, role, permissions: new Set(PERMISSION_KEYS) }

  const [preset, overrides] = await Promise.all([
    admin.from('role_permissions').select('permission_key, allowed').eq('role', role),
    admin.from('user_permission_overrides').select('permission_key, allowed').eq('user_id', user.id),
  ])
  // Antes de aplicar la migración, o ante cualquier error, el acceso es denegado.
  if (preset.error || overrides.error) return { userId: user.id, email: user.email ?? null, displayName, role, permissions: new Set() }
  const valid = new Set<string>(PERMISSION_KEYS)
  const permissions = new Set<PermissionKey>()
  for (const row of preset.data ?? []) if (row.allowed && valid.has(row.permission_key)) permissions.add(row.permission_key as PermissionKey)
  for (const row of overrides.data ?? []) {
    if (!valid.has(row.permission_key)) continue
    if (row.allowed) permissions.add(row.permission_key as PermissionKey)
    else permissions.delete(row.permission_key as PermissionKey)
  }
  return { userId: user.id, email: user.email ?? null, displayName, role, permissions }
}

export function hasPermission(access: Access, permission: PermissionKey) {
  return access.permissions.has(permission)
}

export function availableAdminLinks(access: Access) {
  return ADMIN_MODULES.filter((module) => hasPermission(access, `${module.key}.view` as PermissionKey))
}

export async function requireSuperAdmin() {
  const access = await getCurrentAdminPermissions()
  if (!access.userId) redirect('/login')
  if (access.role !== 'super_admin') redirect('/admin/denied')
  return access.userId
}
