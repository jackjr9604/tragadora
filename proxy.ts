import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { permissionForAdminPath } from '@/lib/admin-permissions'

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/admin/denied') return NextResponse.next()
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
  const key = permissionForAdminPath(request.nextUrl.pathname)
  const permission = await supabase.rpc('has_admin_permission', { permission_key: key })
  if (permission.error || permission.data !== true) return NextResponse.redirect(new URL('/admin/denied', request.url))
  return response
}

export const config = { matcher: '/admin/:path*' }
