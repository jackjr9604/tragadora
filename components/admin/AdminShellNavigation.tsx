'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BadgeDollarSign, BookOpen, BriefcaseBusiness, Building2, FileText, Gift, Home, Image, LayoutDashboard, Link2, Newspaper, Search, Settings2, ShieldCheck, Tags, Users, Wrench } from 'lucide-react'

type AdminLink = { label: string; href: string }

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  '/admin': LayoutDashboard,
  '/admin/home': Home,
  '/admin/platforms': Building2,
  '/admin/platforms/research': Search,
  '/admin/challenges': BriefcaseBusiness,
  '/admin/payouts': BadgeDollarSign,
  '/admin/offers': Tags,
  '/admin/affiliate-links': Link2,
  '/admin/content': FileText,
  '/admin/media': Image,
  '/admin/tools': Wrench,
  '/admin/communities': Users,
  '/admin/blog': Newspaper,
  '/admin/giveaways': Gift,
  '/admin/docs': BookOpen,
  '/admin/users': ShieldCheck,
  '/admin/brokers': Building2,
  '/admin/exchanges': Settings2,
}

export function AdminShellNavigation({ links, mobile = false }: { links: AdminLink[]; mobile?: boolean }) {
  const pathname = usePathname()

  if (mobile) return <nav className="admin-mobile-nav" aria-label="Administración móvil">{links.map((link) => <NavItem key={link.href} link={link} pathname={pathname} mobile />)}</nav>

  const management = links.filter((link) => ['/admin', '/admin/home', '/admin/platforms', '/admin/brokers', '/admin/exchanges', '/admin/challenges', '/admin/payouts', '/admin/offers', '/admin/affiliate-links'].includes(link.href))
  const content = links.filter((link) => ['/admin/content', '/admin/media', '/admin/tools', '/admin/communities', '/admin/blog', '/admin/giveaways', '/admin/docs'].includes(link.href))
  const system = links.filter((link) => !management.includes(link) && !content.includes(link))
  return <nav className="admin-sidebar-nav" aria-label="Administración"><NavGroup title="Gestión" links={management} pathname={pathname} /><NavGroup title="Contenido" links={content} pathname={pathname} />{system.length > 0 && <NavGroup title="Sistema" links={system} pathname={pathname} />}</nav>
}

function NavGroup({ title, links, pathname }: { title: string; links: AdminLink[]; pathname: string }) {
  return <div className="admin-nav-group"><p>{title}</p><div>{links.map((link) => <NavItem key={link.href} link={link} pathname={pathname} />)}</div></div>
}

function NavItem({ link, pathname, mobile = false }: { link: AdminLink; pathname: string; mobile?: boolean }) {
  const Icon = ICONS[link.href] ?? Settings2
  const active = link.href === '/admin' ? pathname === '/admin' : pathname === link.href || pathname.startsWith(`${link.href}/`)
  return <Link href={link.href} aria-current={active ? 'page' : undefined} className={mobile ? 'admin-mobile-link' : 'admin-sidebar-link'}><Icon className="size-4" /><span>{link.label}</span></Link>
}
