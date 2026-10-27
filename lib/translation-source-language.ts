export const FIELD_SOURCE_LANGUAGE_OVERRIDES: Readonly<Record<string, string>> = {
  'account_plan_translation:payout_frequency': 'en',
}

export function getEffectiveFieldSourceLanguage(resourceType: string, fieldName: string, defaultLanguage: string) {
  return FIELD_SOURCE_LANGUAGE_OVERRIDES[`${resourceType}:${fieldName}`] ?? defaultLanguage
}

export function isApplicableTranslationTarget(resourceType: string, fieldName: string, targetLanguage: string, defaultLanguage: string) {
  return targetLanguage !== getEffectiveFieldSourceLanguage(resourceType, fieldName, defaultLanguage)
}
