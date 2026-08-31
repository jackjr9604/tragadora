import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizedLanguage } from '@/lib/public-language'

type AffiliateLink = {
  id: string
  url: string
  challenge_id: string | null
  country_code: string | null
  language: string | null
  priority: number | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = await createClient()
  const countryCode = request.headers.get('x-vercel-ip-country')?.toUpperCase() ?? null
  const knownCountry = countryCode?.trim() || null
  const language = normalizedLanguage(request.nextUrl.searchParams.get('lang') ?? undefined)

  const { data: platform, error: platformError } = await supabase
    .from('platforms')
    .select('id, name')
    .eq('slug', slug)
    .single()

  if (platformError || !platform) {
    return new NextResponse(`Prop Firm no encontrada: ${slug}`, { status: 404 })
  }

  const offerId = request.nextUrl.searchParams.get('offer')
  let offer: {
    affiliate_link_id: string | null
    challenge_id: string | null
    country_code: string | null
    language: string | null
    starts_at: string | null
    expires_at: string | null
  } | null = null

  if (offerId) {
    const { data } = await supabase
      .from('offers')
      .select('affiliate_link_id, challenge_id, country_code, language, starts_at, expires_at')
      .eq('id', offerId)
      .eq('platform_id', platform.id)
      .eq('status', true)
      .maybeSingle()

    const now = Date.now()
    const validCountry = !knownCountry || !data?.country_code || data.country_code.toUpperCase() === knownCountry
    const validLanguage = !data?.language || data.language === language || data.language === 'es'
    const validDates = Boolean(data)
      && (!data?.starts_at || new Date(data.starts_at).getTime() <= now)
      && (!data?.expires_at || new Date(data.expires_at).getTime() >= now)
    if (!data || !validCountry || !validLanguage || !validDates) {
      return new NextResponse('La oferta no está disponible.', { status: 404 })
    }
    offer = data
  }

  const { data: linkRows, error: affiliateError } = await supabase
    .from('affiliate_links')
    .select('id, url, challenge_id, country_code, language, priority')
    .eq('platform_id', platform.id)
    .eq('status', true)
    .order('priority', { ascending: true })

  if (affiliateError) {
    return new NextResponse(`No hay enlace de afiliado activo para ${platform.name}`, { status: 404 })
  }

  const links = (linkRows ?? []) as AffiliateLink[]
  const exactLink = offer?.affiliate_link_id
    ? links.find((link) => link.id === offer?.affiliate_link_id)
    : null
  const eligibleLinks = links.filter((link) => {
    const countryMatches = !knownCountry || !link.country_code || link.country_code.toUpperCase() === knownCountry
    const languageMatches = !link.language || link.language === language || link.language === 'es'
    const challengeMatches = !link.challenge_id || link.challenge_id === offer?.challenge_id
    return countryMatches && languageMatches && challengeMatches
  })
  const affiliateLink = exactLink ?? eligibleLinks[0]

  if (!affiliateLink) {
    return new NextResponse(`No hay enlace de afiliado activo para ${platform.name}`, { status: 404 })
  }

  await supabase.from('affiliate_clicks').insert({
    affiliate_link_id: affiliateLink.id,
    country_code: countryCode,
    language,
    source_page: request.headers.get('referer') ?? null,
  })

  return NextResponse.redirect(affiliateLink.url)
}
