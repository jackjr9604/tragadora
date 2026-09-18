'use client'

import { ADMIN_MODULES, type PermissionKey } from '@/lib/admin-permissions'

const labels: Record<string, string> = { view: 'Ver', create: 'Crear', update: 'Editar', delete: 'Eliminar', manage_roles: 'Roles', manage_permissions: 'Permisos' }

export function PermissionCards({ effective, customized, disabled = false, onSetModule, onSetPermission }: {
  effective: Record<string, boolean>
  customized?: Record<string, boolean>
  disabled?: boolean
  onSetModule?: (keys: PermissionKey[], mode: 'none' | 'all' | 'read') => void
  onSetPermission: (key: PermissionKey, allowed: boolean | null) => void
}) {
  return <div className="grid gap-3 lg:grid-cols-2">{ADMIN_MODULES.map((module) => {
    const keys = module.actions.map((action) => `${module.key}.${action}` as PermissionKey)
    return <section key={module.key} className="rounded-xl border bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{module.label}</h3>{onSetModule && !disabled && module.key !== 'users' && <div className="flex gap-2 text-xs"><button type="button" onClick={() => onSetModule(keys, 'none')} className="text-slate-500 hover:underline">Sin acceso</button><button type="button" onClick={() => onSetModule(keys, 'all')} className="text-slate-700 hover:underline">Acceso total</button>{keys.includes(`${module.key}.view` as PermissionKey) && <button type="button" onClick={() => onSetModule(keys, 'read')} className="text-slate-700 hover:underline">Solo lectura</button>}</div>}</div>
      <div className="mt-3 flex flex-wrap gap-2">{module.actions.map((action) => {
        const key = `${module.key}.${action}` as PermissionKey
        const isCustom = Object.hasOwn(customized ?? {}, key)
        return <div key={key} className="min-w-[90px] rounded-lg border bg-slate-50 px-3 py-2"><p className="text-xs text-slate-500">{labels[action] ?? action}</p><button type="button" disabled={disabled || module.key === 'users'} onClick={() => onSetPermission(key, !effective[key])} aria-label={`${module.label}: ${labels[action] ?? action}, ${effective[key] ? 'permitido' : 'denegado'}`} className={`mt-1 text-sm font-semibold disabled:cursor-default ${effective[key] ? 'text-emerald-700' : 'text-slate-500'}`}>{effective[key] ? '✓ Permitido' : '✕ Denegado'}</button><p className="mt-1 text-[10px] text-slate-400">{module.key === 'users' ? 'Solo Super Admin' : isCustom ? 'Personalizado' : 'Heredado del rol'}</p>{isCustom && !disabled && module.key !== 'users' && <button type="button" onClick={() => onSetPermission(key, null)} className="text-[10px] text-blue-700 hover:underline">Restaurar</button>}</div>
      })}</div>
    </section>
  })}</div>
}
