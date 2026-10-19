import type { TranslationStateRow } from './admin-translation-inventory'

export type EditorialSnapshot = {
  stateId: string
  lockVersion: number
  sourceHash: string
  sourceRevision: number
  draftSourceHash: string | null
  draftSourceRevision: number | null
  status: TranslationStateRow['status']
  workflowStatus: NonNullable<TranslationStateRow['workflow_status']>
  publicationStatus: NonNullable<TranslationStateRow['publication_status']>
  protected: boolean
}

export type EditorialConflictKind = 'concurrent_change' | 'permission_changed' | 'state_changed' | 'missing' | 'unknown'

export function editorialSnapshot(state: TranslationStateRow): EditorialSnapshot {
  return {
    stateId: state.id,
    lockVersion: state.lock_version ?? 0,
    sourceHash: state.source_hash,
    sourceRevision: state.source_revision,
    draftSourceHash: state.draft_source_hash ?? null,
    draftSourceRevision: state.draft_source_revision ?? null,
    status: state.status,
    workflowStatus: state.workflow_status ?? 'none',
    publicationStatus: state.publication_status ?? 'unpublished',
    protected: state.is_protected,
  }
}

export function matchesEditorialSnapshot(state: TranslationStateRow, snapshot: EditorialSnapshot) {
  const current = editorialSnapshot(state)
  return Object.keys(current).every((key) => current[key as keyof EditorialSnapshot] === snapshot[key as keyof EditorialSnapshot])
}

export function classifyEditorialRpcError(error: { code?: string | null; message?: string | null }) {
  const message = error.message ?? ''
  if (error.code === '40001') {
    return conflict('concurrent_change', 'Cambió mientras se procesaba; conserva la selección y vuelve a previsualizar.')
  }
  if (error.code === '42501' || /permiso|forbidden|autoriz/i.test(message)) {
    return conflict('permission_changed', 'Tus permisos cambiaron o ya no autorizan este recurso.')
  }
  if (error.code === 'P0002' || /no encontrado|no existe/i.test(message)) {
    return conflict('missing', 'El campo o su recurso ya no está disponible.')
  }
  if (error.code === '22023' || /borrador|aprob|publicad|revisi[oó]n|estado/i.test(message)) {
    return conflict('state_changed', 'El estado editorial cambió; conserva la selección y vuelve a previsualizar.')
  }
  if (/cambi|anterior|versi[oó]n|revisi[oó]n|fuente/i.test(message)) {
    return conflict('concurrent_change', 'Cambió mientras se procesaba; conserva la selección y vuelve a previsualizar.')
  }
  return { expected: false as const, kind: 'unknown' as const, message: 'No se pudo procesar el campo.' }
}

function conflict(kind: Exclude<EditorialConflictKind, 'unknown'>, message: string) {
  return { expected: true as const, kind, message }
}
