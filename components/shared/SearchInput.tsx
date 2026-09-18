'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'

type Props = {
  value?: string
  onChange?: (value: string) => void
  name?: string
  placeholder?: string
  theme?: 'light' | 'dark'
  className?: string
  debounceMs?: number
}

export function SearchInput({ value, onChange, name = 'q', placeholder = 'Buscar...', theme = 'light', className = '', debounceMs = 250 }: Props) {
  const router = useRouter()
  const [local, setLocal] = useState(value ?? '')
  const input = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const text = onChange ? value ?? '' : local

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function update(next: string) {
    if (onChange) { onChange(next); return }
    setLocal(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const url = new URL(window.location.href)
      const form = input.current?.form
      if (form) {
        const values = new FormData(form)
        for (const [key, item] of values.entries()) {
          const field = String(item).trim()
          if (field) url.searchParams.set(key, field)
          else url.searchParams.delete(key)
        }
      } else if (next.trim()) url.searchParams.set(name, next.trim())
      else url.searchParams.delete(name)
      url.searchParams.delete('page')
      router.replace(`${url.pathname}${url.search}`, { scroll: false })
    }, debounceMs)
  }

  return <label className={`relative flex min-w-0 items-center ${className}`}>
    <Search aria-hidden="true" className={`pointer-events-none absolute left-3 size-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
    <span className="sr-only">{placeholder}</span>
    <input ref={input} type="search" name={name} value={text} onChange={(event) => update(event.target.value)} placeholder={placeholder} autoComplete="off" className={`w-full min-w-0 rounded-xl border py-2.5 pl-10 pr-10 text-sm outline-none focus:ring-2 [&::-webkit-search-cancel-button]:hidden ${theme === 'dark' ? 'border-white/10 bg-black/15 text-white placeholder:text-slate-500 focus:ring-amber-300/40' : 'border-slate-200 bg-white text-slate-950 placeholder:text-slate-400 focus:ring-slate-400/30'}`} />
    {text && <button type="button" onClick={() => { update(''); input.current?.focus() }} aria-label="Limpiar búsqueda" className={`absolute right-2 rounded-lg p-1.5 ${theme === 'dark' ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}><X className="size-4" /></button>}
  </label>
}
