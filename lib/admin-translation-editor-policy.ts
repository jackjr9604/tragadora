export const TRANSLATION_EDITOR_ACTIONS = ['generate_ai', 'save_draft', 'submit_review', 'approve', 'publish', 'withdraw'] as const
export type TranslationEditorAction = (typeof TRANSLATION_EDITOR_ACTIONS)[number]

export function parseTranslationEditorValue(value: FormDataEntryValue | null, valueKind: string) {
  if (typeof value !== 'string') throw new Error('La traducción es obligatoria.')
  if (valueKind === 'text_array') {
    const items = value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
    if (!items.length) throw new Error('Añade al menos un elemento.')
    return items
  }
  const normalized = value.trim()
  if (!normalized) throw new Error('La traducción es obligatoria.')
  return normalized
}

export function canRunTranslationAction(action: TranslationEditorAction, workflowStatus: string, publicationStatus: string) {
  if (action === 'generate_ai') return workflowStatus === 'none'
  if (action === 'save_draft') return true
  if (action === 'submit_review') return workflowStatus === 'draft'
  if (action === 'approve') return workflowStatus === 'in_review'
  if (action === 'publish') return workflowStatus === 'approved'
  return publicationStatus === 'published'
}
