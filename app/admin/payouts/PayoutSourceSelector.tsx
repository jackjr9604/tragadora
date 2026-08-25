'use client'

import { useRouter } from 'next/navigation'

type PayoutSourceOption = {
  id: string
  label: string
}

export default function PayoutSourceSelector({
  sources,
  selectedId,
}: {
  sources: PayoutSourceOption[]
  selectedId: string
}) {
  const router = useRouter()

  return (
    <div>
      <label
        htmlFor="payout-source"
        className="mb-2 block text-sm font-medium text-slate-700"
      >
        Prop Firm
      </label>
      <select
        id="payout-source"
        value={selectedId}
        onChange={(event) => {
          const params = new URLSearchParams()
          params.set('source', event.target.value)
          router.push(`/admin/payouts?${params.toString()}`)
        }}
        className="min-w-72 rounded-lg border bg-white px-4 py-3 font-medium shadow-sm"
      >
        {sources.map((source) => (
          <option key={source.id} value={source.id}>
            {source.label}
          </option>
        ))}
      </select>
    </div>
  )
}
