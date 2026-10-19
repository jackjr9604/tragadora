export type BulkOperationCategory = 'success' | 'skipped' | 'conflict' | 'error'

export type BulkOperationReportItem = {
  stateId: string
  fieldName: string
  language: string
  outcome: string
  category: BulkOperationCategory
  message: string
}

export type BulkOperationSummary = {
  selected: number
  succeeded: number
  skipped: number
  conflicts: number
  errors: number
  complete: boolean
}

export function summarizeBulkOperation(selected: number, items: BulkOperationReportItem[]): BulkOperationSummary {
  const succeeded = items.filter((item) => item.category === 'success').length
  const skipped = items.filter((item) => item.category === 'skipped').length
  const conflicts = items.filter((item) => item.category === 'conflict').length
  const errors = items.filter((item) => item.category === 'error').length
  return { selected, succeeded, skipped, conflicts, errors, complete: selected > 0 && succeeded === selected }
}

export function isConflictReason(reason: string | null | undefined) {
  return reason === 'concurrent_change' || reason === 'source_changed' || reason === 'invalid_version'
}
