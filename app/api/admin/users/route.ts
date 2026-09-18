import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'
import { PERMISSION_KEYS, type AdminRole } from '@/lib/admin-permissions'

const roles: AdminRole[] = ['super_admin', 'admin', 'editor', 'user']
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 })
  const actor = await getCurrentAdminPermissions()
  if (actor.role !== 'super_admin' || !actor.userId) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await request.json() as Record<string, unknown> } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const admin = createAdminClient()
  const validKey = (value: unknown) => typeof value === 'string' && PERMISSION_KEYS.includes(value as typeof PERMISSION_KEYS[number])
  const target = body.targetId
  if (body.type !== 'preset' && (typeof target !== 'string' || !uuid.test(target))) return NextResponse.json({ error: 'Usuario inválido' }, { status: 400 })

  let result: { error: { message: string } | null }
  if (body.type === 'role') {
    if (typeof body.role !== 'string' || !roles.includes(body.role as AdminRole) || typeof body.keepOverrides !== 'boolean') return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    result = await admin.rpc('admin_set_user_role', { actor_id: actor.userId, target_id: target, next_role: body.role, keep_overrides: body.keepOverrides })
  } else if (body.type === 'override') {
    if (!validKey(body.key) || (body.allowed !== null && typeof body.allowed !== 'boolean')) return NextResponse.json({ error: 'Permiso inválido' }, { status: 400 })
    result = await admin.rpc('admin_set_user_override', { actor_id: actor.userId, target_id: target, target_key: body.key, next_allowed: body.allowed })
  } else if (body.type === 'reset') {
    result = await admin.rpc('admin_reset_user_overrides', { actor_id: actor.userId, target_id: target })
  } else if (body.type === 'preset') {
    if (body.role !== 'admin' && body.role !== 'editor') return NextResponse.json({ error: 'Preset inválido' }, { status: 400 })
    if (!validKey(body.key) || typeof body.allowed !== 'boolean') return NextResponse.json({ error: 'Permiso inválido' }, { status: 400 })
    result = await admin.rpc('admin_set_role_permission', { actor_id: actor.userId, target_role: body.role, target_key: body.key, next_allowed: body.allowed })
  } else return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
