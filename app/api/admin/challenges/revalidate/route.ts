import { revalidatePath, revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Payload = {
  action?: unknown
  platformSlugs?: unknown
}

const PERMISSIONS = {
  create: 'challenges.create',
  update: 'challenges.update',
  delete: 'challenges.delete',
} as const

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as Payload
  const action = typeof body.action === 'string' && body.action in PERMISSIONS
    ? body.action as keyof typeof PERMISSIONS
    : null
  if (!action) return NextResponse.json({ success: false, error: 'Acción inválida.' }, { status: 400 })

  const { data: allowed } = await supabase.rpc('has_admin_permission', { permission_key: PERMISSIONS[action] })
  if (allowed !== true) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const platformSlugs = Array.isArray(body.platformSlugs)
    ? [...new Set(body.platformSlugs.filter((value): value is string => typeof value === 'string' && /^[a-z0-9-]+$/.test(value)))]
    : []
  if (!platformSlugs.length) return NextResponse.json({ success: false, error: 'Prop Firm inválida.' }, { status: 400 })

  revalidateTag('public-home-data', { expire: 0 })
  revalidatePath('/')
  revalidatePath('/comparador')
  revalidatePath('/admin/challenges')
  for (const slug of platformSlugs) revalidatePath(`/prop-firms/${slug}`)

  return NextResponse.json({ success: true })
}
