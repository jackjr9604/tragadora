'use client'

import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export function PromoCodeButton({ code, compact = false }: { code: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<number | null>(null)
  useEffect(() => () => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
  }, [])
  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
      resetTimer.current = window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }
  return <button type="button" onClick={copy} aria-label={`Copiar código ${code}`} className={`group flex items-center justify-between gap-2 rounded-lg border border-dashed border-amber-300/30 bg-amber-300/[.05] text-left transition hover:border-amber-300/55 ${compact ? 'min-h-8 px-2.5 py-1.5' : 'min-h-10 px-3 py-2'}`}><span className="min-w-0"><span className="block text-[9px] uppercase tracking-[.14em] text-slate-500">Código</span><code className="block truncate text-xs font-bold text-amber-200">{code}</code></span><span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-slate-300">{copied ? <><Check className="size-3.5 text-emerald-300" />Copiado</> : <><Copy className="size-3.5" />Copiar</>}</span></button>
}
