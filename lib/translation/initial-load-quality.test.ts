import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateInitialLoadTranslation } from './initial-load-quality'

test('aprueba contenido editorial general conservando números y enlaces', () => {
  assert.deepEqual(evaluateInitialLoadTranslation({ resourceType: 'blog_post_translation', fieldName: 'title', source: 'Guía 2026 https://tradagora.com', draft: 'Guide 2026 https://tradagora.com' }), { status: 'passed', codes: [] })
})

test('separa contenido financiero aunque pase controles estructurales', () => {
  assert.deepEqual(evaluateInitialLoadTranslation({ resourceType: 'account_plan_translation', fieldName: 'payout_frequency', source: 'Every 14 days', draft: 'Cada 14 días' }), { status: 'requires_review', codes: ['commercial_sensitive'] })
})

test('bloquea cambios numéricos, placeholders y la regresión trailing/trailer', () => {
  const result = evaluateInitialLoadTranslation({ resourceType: 'challenge_phase_translation', fieldName: 'rules', source: 'Trailing loss 5% for {{firm}}', draft: 'Trailer loss 6% for firm' })
  assert.equal(result.status, 'failed')
  assert.deepEqual(result.codes.sort(), ['financial_trailing_mistranslated', 'numeric_tokens_changed', 'placeholders_changed'])
})

test('rechaza formas incompatibles y no trata texto sin traducir como aprobado general', () => {
  assert.equal(evaluateInitialLoadTranslation({ resourceType: 'blog_post_translation', fieldName: 'body', source: ['uno'], draft: 'one' }).status, 'failed')
  assert.deepEqual(evaluateInitialLoadTranslation({ resourceType: 'blog_post_translation', fieldName: 'body', source: 'This sufficiently long text remained unchanged', draft: 'This sufficiently long text remained unchanged' }), { status: 'requires_review', codes: ['translation_unchanged'] })
})
