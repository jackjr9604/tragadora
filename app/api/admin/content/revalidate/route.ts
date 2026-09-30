import { revalidatePath, revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { getContentPage } from '@/lib/content-schema'
import { createClient } from '@/lib/supabase/server'

type Payload = { page?: unknown }

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const { data: allowed } = await supabase.rpc('has_admin_permission', { permission_key: 'content.update' })
  if (allowed !== true) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as Payload
  const page = typeof body.page === 'string' ? getContentPage(body.page) : undefined
  if (!page) return NextResponse.json({ success: false, error: 'Página de contenido inválida.' }, { status: 400 })

  revalidateTag('public-site-content', 'max')
  revalidatePath(page.publicPath)
  return NextResponse.json({ success: true })
}
