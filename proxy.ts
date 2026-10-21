import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { permissionsForAdminPath } from '@/lib/admin-permissions'
import { hasPublicUiCatalog } from '@/lib/public-i18n'
import { normalizedLanguage, PUBLIC_LANGUAGE_REQUEST_HEADER } from '@/lib/public-language'

export async function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/admin')) return publicLanguageRequest(request)
  if (request.nextUrl.pathname === '/admin/denied') return NextResponse.next()
  if (request.nextUrl.pathname === '/admin/translations') {
    const target = request.nextUrl.clone()
    target.pathname = '/admin/content-center/translations'
    return NextResponse.redirect(target)
  }
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          values.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))
  const { data: profile, error } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (error || !profile) return NextResponse.redirect(new URL('/admin/denied', request.url))
  if (profile.role === 'super_admin') return response
  if (request.nextUrl.pathname.startsWith('/admin/users')) return NextResponse.redirect(new URL('/admin/denied', request.url))
  const keys = permissionsForAdminPath(request.nextUrl.pathname)
  let allowed = false
  for (const key of keys) {
    const permission = await supabase.rpc('has_admin_permission', { permission_key: key })
    if (!permission.error && permission.data === true) { allowed = true; break }
  }
  if (!allowed) return NextResponse.redirect(new URL('/admin/denied', request.url))
  return response
}

function publicLanguageRequest(request: NextRequest) {
  const requested = normalizedLanguage(request.nextUrl.searchParams.get('lang') ?? undefined)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete(PUBLIC_LANGUAGE_REQUEST_HEADER)
  if (requested && hasPublicUiCatalog(requested)) {
    requestHeaders.set(PUBLIC_LANGUAGE_REQUEST_HEADER, requested)
  }
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|brand/|favicon.ico|robots.txt|sitemap.xml).*)'],
}
