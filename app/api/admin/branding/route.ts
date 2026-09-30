import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { BRANDING_CACHE_TAG, BRANDING_KEYS } from '@/lib/branding-config'

type Payload = { key?: string; mediaId?: string; altText?: string | null }

export async function POST(request: Request) {
  const body = await request.json() as Payload
  if (!body.key || !BRANDING_KEYS.has(body.key) || !body.mediaId) return NextResponse.json({ success: false, error: 'Slot o archivo inválido.' }, { status: 400 })
  const supabase = await createClient()
  const result = await supabase.from('branding_assets').upsert({ key: body.key, media_id: body.mediaId, alt_text: body.altText?.trim() || null, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (result.error) return NextResponse.json({ success: false, error: result.error.message }, { status: 400 })
  await invalidateBranding()
  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const body = await request.json() as Payload
  if (!body.key || !BRANDING_KEYS.has(body.key)) return NextResponse.json({ success: false, error: 'Slot inválido.' }, { status: 400 })
  const supabase = await createClient()
  const result = await supabase.from('branding_assets').delete().eq('key', body.key)
  if (result.error) return NextResponse.json({ success: false, error: result.error.message }, { status: 400 })
  await invalidateBranding()
  return NextResponse.json({ success: true })
}

async function invalidateBranding() {
  revalidateTag(BRANDING_CACHE_TAG, { expire: 0 })
  revalidatePath('/', 'layout')
  revalidatePath('/login')
  revalidatePath('/admin', 'layout')
  revalidatePath('/brand/favicon')
  revalidatePath('/brand/apple-touch-icon')
  revalidatePath('/brand/organization-logo')
}
