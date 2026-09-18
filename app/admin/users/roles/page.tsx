import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/admin-permissions-server'
import { RolePresetsEditor } from '@/components/admin/users/RolePresetsEditor'

export default async function AdminRolesPage() {
  await requireSuperAdmin()
  const admin = createAdminClient()
  const result = await admin.from('role_permissions').select('role, permission_key, allowed')
  const presets = Object.fromEntries((result.data ?? []).map((row) => [`${row.role}:${row.permission_key}`, row.allowed])) as Record<string, boolean>
  return <main className="p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-6xl"><Link href="/admin/users" className="text-sm text-slate-600 hover:underline">← Usuarios</Link><h1 className="mt-4 text-3xl font-bold">Presets de roles</h1><p className="mt-2 text-sm text-slate-500">Se aplican a usuarios sin override individual. Super Admin siempre tiene acceso total; Usuario no tiene acceso administrativo.</p>{result.error ? <p className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">La migración de permisos aún no está disponible: {result.error.message}</p> : <div className="mt-6"><RolePresetsEditor initialPresets={presets} /></div>}</div></main>
}
