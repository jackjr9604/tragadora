'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight } from 'lucide-react'

export type FirmSection = { id: string; label: string }

type Props = {
  sections: FirmSection[]
  name: string
  score: number | null
  logoUrl: string | null
  logoAlt: string | null
  ctaHref: string
  ctaLabel: string
}

export function FirmProfileNavigation({ sections, name, score, logoUrl, logoAlt, ctaHref, ctaLabel }: Props) {
  const [activeSection, setActiveSection] = useState(sections[0]?.id ?? '')
  const [showCompactHeader, setShowCompactHeader] = useState(false)

  useEffect(() => {
    const hero = document.getElementById('firm-hero')
    const sectionElements = sections.flatMap((section) => {
      const element = document.getElementById(section.id)
      return element ? [element] : []
    })
    const updateFromScroll = () => {
      setShowCompactHeader(Boolean(hero && hero.getBoundingClientRect().bottom <= 0))
      const current = sectionElements.reduce<Element | null>((selected, element) => element.getBoundingClientRect().top <= 150 ? element : selected, sectionElements[0] ?? null)
      if (current) setActiveSection(current.id)
    }
    updateFromScroll()
    window.addEventListener('scroll', updateFromScroll, { passive: true })
    window.addEventListener('resize', updateFromScroll)
    return () => { window.removeEventListener('scroll', updateFromScroll); window.removeEventListener('resize', updateFromScroll) }
  }, [sections])

  const navigate = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return <>
    <div className={`fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0a1321]/95 shadow-xl backdrop-blur transition-transform duration-200 ${showCompactHeader ? 'translate-y-0' : '-translate-y-full'}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        {logoUrl && <Image src={logoUrl} alt={logoAlt || name} width={36} height={36} unoptimized className="size-9 rounded-lg object-contain" />}
        <strong className="min-w-0 flex-1 truncate">{name}</strong>
        {score !== null && <span className="hidden font-mono text-sm text-emerald-400 sm:inline">{score}/10</span>}
        <Link href={ctaHref} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#f7c64b] px-3 py-2 text-xs font-bold text-slate-950 sm:px-4 sm:text-sm">{ctaLabel}<ArrowUpRight className="size-3.5" /></Link>
      </div>
    </div>

    {sections.length > 0 && <nav aria-label="Índice del perfil" className={`${showCompactHeader ? 'fixed inset-x-0 top-16' : 'sticky top-0 -mx-4'} z-40 border-y border-white/10 bg-[#0a1321]/95 px-4 py-2 backdrop-blur lg:hidden`}>
      <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{sections.map((section) => <button key={section.id} type="button" onClick={() => navigate(section.id)} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition ${activeSection === section.id ? 'border-amber-300/30 bg-amber-300/10 text-amber-200' : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-white'}`}>{section.label}</button>)}</div>
    </nav>}

    {sections.length > 0 && <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start"><nav aria-label="Índice del perfil" className="tg-surface space-y-1 rounded-xl p-2">{sections.map((section) => <button key={section.id} type="button" onClick={() => navigate(section.id)} className={`block w-full rounded-lg px-3 py-2.5 text-left text-sm transition ${activeSection === section.id ? 'bg-amber-300/[.07] font-semibold text-amber-100 shadow-[inset_3px_0_0_#f0c454,0_0_16px_rgba(200,148,36,.05)]' : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'}`}>{section.label}</button>)}</nav></aside>}
  </>
}
