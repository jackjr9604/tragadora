'use server'

import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'
import { getTranslationReviewDetails } from '@/lib/admin-translation-review'
import { TRANSLATION_RESOURCES } from '@/lib/admin-translation-inventory-policy'
import { matchesReviewSnapshot, reviewEligibility, type ReviewSnapshot } from '@/lib/admin-translation-review-policy'
import type { ReviewPreviewItem, ReviewPreviewState } from '@/lib/admin-translation-review-state'

const MAX_PREVIEW_FIELDS = 50

export async function previewTranslationReviewSelection(_previous: ReviewPreviewState, formData: FormData): Promise<ReviewPreviewState> {
  const snapshots = parseSnapshots(formData.get('selection'))
  if (!snapshots.length) return { ok: false, message: 'Selecciona al menos una traducción para previsualizar.', items: [] }
  if (snapshots.length > MAX_PREVIEW_FIELDS) return { ok: false, message: `La vista previa admite hasta ${MAX_PREVIEW_FIELDS} campos.`, items: [] }
  const access = await getCurrentAdminPermissions()
  if (!access.userId) return { ok: false, message: 'La sesión expiró. Vuelve a iniciar sesión.', items: [] }
  const items: ReviewPreviewItem[] = []
  const details = await getTranslationReviewDetails(snapshots.map((snapshot) => snapshot.stateId), access.permissions)
  for (const snapshot of snapshots) {
    const detail = details.get(snapshot.stateId)
    if (!detail) continue
    const resource = TRANSLATION_RESOURCES[detail.state.resource_type]
    if (!resource || !access.permissions.has(resource.updatePermission)) continue
    const eligibility = reviewEligibility(detail.state)
    const concurrent = !matchesReviewSnapshot(detail.state, snapshot)
    items.push({ stateId: detail.state.id, resourceType: detail.state.resource_type, resourceId: detail.state.resource_id,
      resourceLabel: detail.resourceLabel, fieldName: detail.state.field_name, sourceLanguage: detail.state.source_language,
      targetLanguage: detail.state.target_language, source: detail.source, draft: displayValue(detail.state.draft_value),
      protected: detail.state.is_protected, eligible: eligibility.eligible && !concurrent,
      exclusionReason: concurrent ? 'concurrent_change' : eligibility.reason })
  }
  if (!items.length) return { ok: false, message: 'No hay traducciones accesibles en la selección.', items: [] }
  const eligible = items.filter((item) => item.eligible).length
  return { ok: eligible === items.length, message: `${eligible} de ${items.length} campos conservan una versión vigente y elegible para revisión. Esta vista previa no modifica ningún dato.`, items }
}

function parseSnapshots(value: FormDataEntryValue | null): ReviewSnapshot[] {
  if (typeof value !== 'string' || value.length > 30_000) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    const unique = new Map<string, ReviewSnapshot>()
    for (const item of parsed.slice(0, MAX_PREVIEW_FIELDS + 1)) {
      if (!item || typeof item !== 'object') continue
      const snapshot = item as Partial<ReviewSnapshot>
      if (!isUuid(snapshot.stateId) || !Number.isInteger(snapshot.lockVersion) || Number(snapshot.lockVersion) < 1 || typeof snapshot.sourceHash !== 'string' || !Number.isInteger(snapshot.sourceRevision)) continue
      if (snapshot.draftSourceHash !== null && typeof snapshot.draftSourceHash !== 'string') continue
      if (snapshot.draftSourceRevision !== null && !Number.isInteger(snapshot.draftSourceRevision)) continue
      unique.set(snapshot.stateId, snapshot as ReviewSnapshot)
    }
    return [...unique.values()]
  } catch { return [] }
}

function isUuid(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) }
function displayValue(value: unknown) { if (value == null) return null; if (Array.isArray(value)) return value.map(String).join('\n'); if (typeof value === 'object') return JSON.stringify(value, null, 2); return String(value) }
