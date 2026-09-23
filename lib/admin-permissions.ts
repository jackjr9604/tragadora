export const ADMIN_MODULES = [
  { key: 'dashboard', label: 'Dashboard', href: '/admin', actions: ['view'] },
  { key: 'home', label: 'Home', href: '/admin/home', actions: ['view', 'create', 'update', 'delete'] },
  { key: 'platforms', label: 'Prop Firms', href: '/admin/platforms', actions: ['view', 'create', 'update', 'delete'] },
  { key: 'platform_research', label: 'Investigación', href: '/admin/platforms/research', actions: ['view', 'create', 'update'] },
  { key: 'challenges', label: 'Challenges', href: '/admin/challenges', actions: ['view', 'create', 'update', 'delete'] },
  { key: 'payouts', label: 'Pagos', href: '/admin/payouts', actions: ['view', 'create', 'update', 'delete'] },
  { key: 'offers', label: 'Ofertas', href: '/admin/offers', actions: ['view', 'create', 'update', 'delete'] },
  { key: 'affiliate_links', label: 'Afiliados', href: '/admin/affiliate-links', actions: ['view', 'create', 'update', 'delete'] },
  { key: 'content', label: 'Contenido', href: '/admin/content', actions: ['view', 'create', 'update', 'delete'] },
  { key: 'media', label: 'Multimedia', href: '/admin/media', actions: ['view', 'create', 'update', 'delete'] },
  { key: 'tools', label: 'Herramientas', href: '/admin/tools', actions: ['view', 'create', 'update', 'delete'] },
  { key: 'users', label: 'Usuarios', href: '/admin/users', actions: ['view', 'manage_roles', 'manage_permissions'] },
] as const

export type AdminModule = (typeof ADMIN_MODULES)[number]['key']
export type PermissionKey = {
  [Index in keyof typeof ADMIN_MODULES]: (typeof ADMIN_MODULES)[Index] extends { key: infer Module extends string; actions: readonly (infer Action extends string)[] }
    ? `${Module}.${Action}` : never
}[number]
export type AdminRole = 'super_admin' | 'admin' | 'editor' | 'user'

export const PERMISSION_KEYS = ADMIN_MODULES.flatMap((module) => module.actions.map((action) => `${module.key}.${action}`)) as PermissionKey[]

export function permissionForAdminPath(pathname: string): PermissionKey {
  const path = pathname.replace(/\/$/, '') || '/admin'
  if (path === '/admin') return 'dashboard.view'
  if (path.startsWith('/admin/users')) return 'users.view'
  if (path === '/admin/brokers/new') return 'platforms.create'
  if (/^\/admin\/brokers\/[^/]+\/edit$/.test(path)) return 'platforms.update'
  if (path.startsWith('/admin/brokers')) return 'platforms.view'
  if (path.startsWith('/admin/platforms/research')) return 'platform_research.view'
  if (path === '/admin/platforms/new') return 'platforms.create'
  if (/^\/admin\/platforms\/[^/]+\/edit$/.test(path)) return 'platforms.update'
  if (path.startsWith('/admin/platforms')) return 'platforms.view'
  if (path === '/admin/challenges/new' || /\/plans\/new$/.test(path)) return 'challenges.create'
  if (path.startsWith('/admin/challenges')) return 'challenges.view'
  if (path.endsWith('/sources/new') && path.startsWith('/admin/payouts')) return 'payouts.create'
  if (/\/sources\/[^/]+\/edit$/.test(path)) return 'payouts.update'
  if (path.startsWith('/admin/payouts')) return 'payouts.view'
  if (path === '/admin/offers/new') return 'offers.create'
  if (/^\/admin\/offers\/[^/]+$/.test(path)) return 'offers.update'
  if (path.startsWith('/admin/offers')) return 'offers.view'
  if (path === '/admin/affiliate-links/new') return 'affiliate_links.create'
  if (path.startsWith('/admin/affiliate-links')) return 'affiliate_links.view'
  if (path.startsWith('/admin/content')) return 'content.view'
  if (path.startsWith('/admin/media')) return 'media.view'
  if (path === '/admin/tools/new') return 'tools.create'
  if (/^\/admin\/tools\/[^/]+\/edit$/.test(path)) return 'tools.update'
  if (path.startsWith('/admin/tools')) return 'tools.view'
  return 'dashboard.view'
}
