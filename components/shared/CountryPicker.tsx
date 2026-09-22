'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CountryFlag } from '@/components/shared/CountryFlag'
import { SearchInput } from '@/components/shared/SearchInput'

type Country = { code: string; name: string }
type Props = { countries: Country[]; value: string; onChange: (code: string) => void; label?: string }
const quickCodes = ['CO', 'MX', 'AR', 'CL', 'PE', 'BR']
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim()

export function CountryPicker({ countries, value, onChange, label = '¿Cuál es tu país?' }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const selected = countries.find((country) => country.code === value)
  const quick = quickCodes.flatMap((code) => countries.find((country) => country.code === code) ?? [])
  const filtered = useMemo(() => countries.filter((country) => `${normalize(country.name)} ${country.code.toLowerCase()}`.includes(normalize(search))), [countries, search])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  function choose(code: string) {
    onChange(code)
    setOpen(false)
    setSearch('')
  }

  return <div className="min-w-0 text-sm text-slate-300">
    <p className="font-medium">{label}</p>
    <p className="mt-1 text-xs text-slate-400">Lo usamos para comprobar las restricciones publicadas por cada firma.</p>
    <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Países frecuentes">
      {quick.map((country) => <div key={country.code} className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 ${value === country.code ? 'border-amber-300 bg-amber-300/15 text-amber-100' : 'border-white/15 bg-[#0a1422]'}`}>
        <CountryFlag countryCode={country.code} countryName={country.name} size="sm" context="País" />
        <button type="button" aria-pressed={value === country.code} onClick={() => choose(country.code)} className="min-h-8 rounded-md px-1.5 focus-visible:outline-2 focus-visible:outline-amber-300">{country.name}</button>
      </div>)}
      <button type="button" onClick={() => setOpen(true)} className="min-h-10 rounded-xl border border-amber-300/30 px-3 text-amber-100 hover:border-amber-300 focus-visible:outline-2 focus-visible:outline-amber-300">{selected && !quick.some((country) => country.code === value) ? selected.name : 'Buscar otro país'}</button>
      {value && <button type="button" onClick={() => choose('')} className="min-h-10 rounded-xl border border-white/15 px-3 text-slate-300 hover:border-white/40">Quitar país</button>}
    </div>
    <dialog ref={dialogRef} onClose={() => setOpen(false)} onClick={(event) => { if (event.target === dialogRef.current) setOpen(false) }} aria-label="Buscar país" className="m-auto max-h-[85vh] w-[min(94vw,520px)] overflow-y-auto rounded-2xl border border-amber-300/25 bg-[#111e2e] p-4 text-white shadow-2xl backdrop:bg-black/75 sm:p-6">
      <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Elige tu país</h2><button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-white/15 px-3 py-2">Cerrar</button></div>
      <div className="mt-4"><SearchInput value={search} onChange={setSearch} placeholder="Buscar por país o código" theme="dark" className="w-full" /></div>
      <div className="mt-4 max-h-[55vh] space-y-1 overflow-y-auto" aria-label="Resultados de países">{filtered.map((country) => <button key={country.code} type="button" onClick={() => choose(country.code)} aria-current={country.code === value ? 'true' : undefined} className="flex w-full items-center gap-3 rounded-xl border border-white/10 p-2.5 text-left hover:border-amber-300/50 focus-visible:outline-2 focus-visible:outline-amber-300"><span aria-hidden="true">{String.fromCodePoint(...[...country.code].map((letter) => 127397 + letter.charCodeAt(0)))}</span><span className="flex-1">{country.name}</span><span className="text-xs text-slate-400">{country.code}</span></button>)}{filtered.length === 0 && <p className="py-6 text-center text-slate-400">No encontramos ese país.</p>}</div>
    </dialog>
  </div>
}
