import { Landmark } from 'lucide-react'

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 font-semibold text-white">
      <span className="flex size-9 items-center justify-center rounded-xl bg-[#f7c64b] text-[#0a1220] shadow-[0_0_28px_rgba(247,198,75,.24)]">
        <Landmark className="size-5" aria-hidden="true" />
      </span>
      {!compact && <span className="text-lg tracking-tight">Tradagora</span>}
    </span>
  )
}
