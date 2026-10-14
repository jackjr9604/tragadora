export type TranslationBulkResult = {
  ok: boolean
  message: string
  requested: number
  succeeded: number
  failed: number
  items: { stateId: string; fieldName: string; language: string; ok: boolean; message: string }[]
}

export const INITIAL_TRANSLATION_BULK_RESULT: TranslationBulkResult = {
  ok: false,
  message: '',
  requested: 0,
  succeeded: 0,
  failed: 0,
  items: [],
}
