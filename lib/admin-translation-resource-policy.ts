import type { TranslationStateRow } from './admin-translation-inventory'

export const RESOURCE_BULK_ACTIONS = [
  'generate_pending',
  'regenerate_stale',
  'submit_review',
  'approve',
  'publish',
  'withdraw',
] as const

export type ResourceBulkAction = (typeof RESOURCE_BULK_ACTIONS)[number]

export function isResourceBulkAction(value: string): value is ResourceBulkAction {
  return RESOURCE_BULK_ACTIONS.includes(value as ResourceBulkAction)
}

export function isEligibleForBulkAction(state: TranslationStateRow, action: ResourceBulkAction) {
  const workflow = state.workflow_status ?? 'none'
  const publication = state.publication_status ?? 'unpublished'

  if (action === 'generate_pending') {
    return !state.is_protected
      && publication !== 'published'
      && workflow === 'none'
      && ['missing', 'error'].includes(state.status)
  }
  if (action === 'regenerate_stale') {
    return !state.is_protected
      && publication !== 'published'
      && workflow === 'none'
      && state.status === 'stale'
  }
  if (action === 'submit_review') return workflow === 'draft'
  if (action === 'approve') return workflow === 'in_review'
  if (action === 'publish') return workflow === 'approved' && publication !== 'published'
  return publication === 'published'
}

export function countEligibleByLanguage(
  states: TranslationStateRow[],
  action: ResourceBulkAction,
  languages: readonly string[],
) {
  return Object.fromEntries(languages.map((language) => [
    language,
    states.filter((state) => state.target_language === language && isEligibleForBulkAction(state, action)).length,
  ]))
}

export function summarizeResourceStates(states: TranslationStateRow[]) {
  const total = states.length
  const counts = (language: string) => {
    const rows = states.filter((state) => state.target_language === language)
    const published = rows.filter((state) => state.publication_status === 'published').length
    const reviewed = rows.filter((state) => state.status === 'reviewed' || state.workflow_status === 'approved').length
    const translated = rows.filter((state) => state.status !== 'missing' && state.status !== 'queued').length
    return { total: rows.length, translated, reviewed, published }
  }
  return {
    total,
    pending: states.filter((state) => state.status === 'missing' || state.status === 'queued').length,
    stale: states.filter((state) => state.status === 'stale').length,
    drafts: states.filter((state) => state.workflow_status === 'draft').length,
    inReview: states.filter((state) => state.workflow_status === 'in_review').length,
    approved: states.filter((state) => state.workflow_status === 'approved').length,
    published: states.filter((state) => state.publication_status === 'published').length,
    protected: states.filter((state) => state.is_protected).length,
    languages: { en: counts('en'), pt: counts('pt') },
  }
}

export function summarizeEditorialStages(states: TranslationStateRow[]) {
  const summary = { pending: 0, drafts: 0, inReview: 0, approved: 0, published: 0, stale: 0 }
  for (const state of states) {
    if (state.status === 'stale') summary.stale++
    else if (state.publication_status === 'published') summary.published++
    else if (state.workflow_status === 'approved') summary.approved++
    else if (state.workflow_status === 'in_review') summary.inReview++
    else if (state.workflow_status === 'draft') summary.drafts++
    else summary.pending++
  }
  return summary
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Título', name: 'Nombre', short_description: 'Descripción corta', description: 'Descripción',
  body_markdown: 'Contenido', category: 'Categoría', category_label: 'Etiqueta de categoría', tags: 'Etiquetas',
  badge: 'Insignia', price_label: 'Etiqueta de precio', availability: 'Disponibilidad', promo_label: 'Etiqueta promocional',
  seo_title: 'Título SEO', seo_description: 'Descripción SEO', pros: 'Ventajas', cons: 'Desventajas',
  regulation_summary: 'Resumen regulatorio', product_summary: 'Resumen de productos', free_account_label: 'Etiqueta de cuenta gratuita',
  hot_badge: 'Insignia destacada', short_highlight: 'Destacado corto', prize_title: 'Título del premio',
  prize_description: 'Descripción del premio', reveal_title: 'Título de revelación', reveal_content: 'Contenido de revelación',
  region_label: 'Etiqueta de región', excerpt: 'Extracto', objective: 'Objetivo', rules: 'Reglas', benefits: 'Beneficios',
}

export function translationFieldLabel(fieldName: string) {
  return FIELD_LABELS[fieldName] ?? fieldName.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

export function translationEditorRows(fieldName: string, valueKind: string, maxCharacters: number | null) {
  if (valueKind === 'rich_text' || ['body_markdown', 'reveal_content'].includes(fieldName)) return 18
  if (valueKind === 'text_array') return 10
  if (maxCharacters && maxCharacters <= 180) return 4
  if (maxCharacters && maxCharacters <= 600) return 8
  if (/(^|_)(title|name|label|badge|category|availability)$/.test(fieldName)) return 4
  if (/(description|summary|excerpt|highlight|benefits|rules)/.test(fieldName)) return 8
  return 10
}
