'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAdminPermission } from '@/components/admin/AdminPermissionsProvider'

export default function ToggleOfferStatus({
  id,
  status,
}: {
  id: string
  status: boolean
}) {
  const canUpdate = useAdminPermission('offers.update')
  const supabase = createClient()

  const [active, setActive] = useState(status)
  const [loading, setLoading] = useState(false)

  async function toggleStatus() {
    if (!canUpdate) return
    setLoading(true)

    const newStatus = !active

    const { error } = await supabase
      .from('offers')
      .update({
        status: newStatus,
      })
      .eq('id', id)

    if (!error) {
      setActive(newStatus)
    }

    setLoading(false)
  }

  return (
    <button
      onClick={toggleStatus}
      disabled={loading || !canUpdate}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active
          ? 'bg-green-100 text-green-700'
          : 'bg-slate-100 text-slate-500'
      }`}
    >
      {loading
        ? '...'
        : active
          ? 'Activa'
          : 'Inactiva'}
    </button>
  )
}
