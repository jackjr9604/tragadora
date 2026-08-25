import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ slug: string }>
  }
) {
  const { slug } = await params

  const supabase = await createClient()

  console.log('GO SLUG:', slug)

  // 1. Buscar Prop Firm
  const { data: platform, error: platformError } =
    await supabase
      .from('platforms')
      .select('id, name, slug, status')
      .eq('slug', slug)
      .single()

  console.log('PLATFORM:', platform)
  console.log('PLATFORM ERROR:', platformError)

  if (platformError || !platform) {
    return new NextResponse(
      `Prop Firm no encontrada: ${slug}`,
      { status: 404 }
    )
  }

  // 2. Buscar enlace activo
  const { data: affiliateLink, error: affiliateError } =
    await supabase
      .from('affiliate_links')
      .select('*')
      .eq('platform_id', platform.id)
      .eq('status', 'true')
      .order('priority', { ascending: true })
      .limit(1)
      .maybeSingle()

  console.log('AFFILIATE LINK:', affiliateLink)
  console.log('AFFILIATE ERROR:', affiliateError)

  if (affiliateError || !affiliateLink) {
    return new NextResponse(
      `No hay enlace de afiliado activo para ${platform.name}`,
      { status: 404 }
    )
  }

  // 3. Registrar click
  const { error: clickError } = await supabase
  .from('affiliate_clicks')
  .insert({
    affiliate_link_id: affiliateLink.id,
    country_code:
      request.headers.get('x-vercel-ip-country') ?? null,
    language:
      request.headers
        .get('accept-language')
        ?.split(',')[0]
        ?.split('-')[0] ?? null,
    source_page:
      request.headers.get('referer') ?? null,
  })

  console.log('CLICK ERROR:', clickError)

  // 4. Redireccionar
  console.log('REDIRECT TO:', affiliateLink.url)

  return NextResponse.redirect(affiliateLink.url)
}
