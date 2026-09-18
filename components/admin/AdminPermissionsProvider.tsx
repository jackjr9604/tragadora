'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { PermissionKey } from '@/lib/admin-permissions'

const PermissionContext = createContext<ReadonlySet<PermissionKey>>(new Set())

export function AdminPermissionsProvider({ permissions, children }: { permissions: PermissionKey[]; children: ReactNode }) {
  return <PermissionContext.Provider value={new Set(permissions)}>{children}</PermissionContext.Provider>
}

export function useAdminPermission(permission: PermissionKey) {
  return useContext(PermissionContext).has(permission)
}

export function AdminAction({ permission, children }: { permission: PermissionKey; children: ReactNode }) {
  return useAdminPermission(permission) ? <>{children}</> : null
}
