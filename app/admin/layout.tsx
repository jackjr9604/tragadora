import Link from 'next/link'
import { redirect } from 'next/navigation'
import { availableAdminLinks, getCurrentAdminPermissions } from '@/lib/admin-permissions-server'
import { AdminPermissionsProvider } from '@/components/admin/AdminPermissionsProvider'
import { AdminShellNavigation } from '@/components/admin/AdminShellNavigation'
import { AdminUserMenu } from '@/components/admin/AdminUserMenu'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await getCurrentAdminPermissions()
  if (!access.userId) redirect('/login')
  const links = availableAdminLinks(access)
  const navigationLinks = links.flatMap((link) => link.href === '/admin/platforms'
    ? [link, { label: 'Brokers', href: '/admin/brokers' }, { label: 'Exchanges', href: '/admin/exchanges' }]
    : [link])
  if (!links.length) redirect('/')

  return <div className="admin-ui min-h-screen text-slate-950">
    <aside className="admin-sidebar fixed inset-y-0 left-0 z-40 hidden w-64 lg:flex lg:flex-col"><AdminBrand /><AdminShellNavigation links={navigationLinks} /><AdminUserMenu name={access.displayName} email={access.email} role={access.role} /></aside>
    <header className="admin-mobile-header sticky top-0 z-40 lg:hidden"><div className="flex items-center justify-between gap-3 px-4 py-3"><AdminBrand compact /><AdminUserMenu name={access.displayName} email={access.email} role={access.role} mobile /></div><AdminShellNavigation links={navigationLinks} mobile /></header>
    <div className="lg:ml-64"><div className="admin-topbar hidden lg:flex"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-amber-700">Tradagora</p><p className="text-sm font-medium text-slate-700">Panel administrativo</p></div><Link href="/" className="admin-secondary-button px-4 py-2 text-sm">Ver sitio público ↗</Link></div><AdminPermissionsProvider permissions={[...access.permissions]}>{children}</AdminPermissionsProvider></div>
  </div>
}

function AdminBrand({ compact = false }: { compact?: boolean }) { return <div className={compact ? 'admin-brand compact' : 'admin-brand'}><span className="admin-brand-mark">T</span><span><strong>Tradagora</strong><small>Administración</small></span></div> }
