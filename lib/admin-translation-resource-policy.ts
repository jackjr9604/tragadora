import type { TranslationStateRow } from './admin-translation-inventory'

export const RESOURCE_BULK_ACTIONS = [
  'generate_pending',
  'regenerate_stale',
  'submit_review',
  'approve',
  'publish',
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
  return workflow === 'approved' && publication !== 'published'
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
