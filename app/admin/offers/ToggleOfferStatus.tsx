'use client'

import { useState } from 'react'
import { useAdminPermission } from '@/components/admin/AdminPermissionsProvider'
import { setOfferStatus } from './actions'

export default function ToggleOfferStatus({
  id,
  status,
  updatedAt,
}: {
  id: string
  status: boolean
  updatedAt: string
}) {
  const canUpdate = useAdminPermission('offers.update')

  const [active, setActive] = useState(status)
  const [snapshot, setSnapshot] = useState(updatedAt)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function toggleStatus() {
    if (!canUpdate) return
    setLoading(true)
    setError('')

    const newStatus = !active

    try {
      const result = await setOfferStatus({ id, expectedUpdatedAt: snapshot, status: newStatus })
      if (result.updatedAt) setSnapshot(result.updatedAt)
      if (typeof result.status === 'boolean') setActive(result.status)
      if (!result.ok) setError(result.message)
    } catch {
      setError('No se recibió confirmación del servidor. Recarga antes de intentar otro cambio.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={toggleStatus}
        disabled={loading || !canUpdate}
        className={`rounded-full px-3 py-1 text-xs font-medium ${active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}
      >
        {loading ? '...' : active ? 'Activa' : 'Inactiva'}
      </button>
      {error && <span role="alert" className="max-w-48 text-xs text-red-600">{error}</span>}
    </div>
  )
}
