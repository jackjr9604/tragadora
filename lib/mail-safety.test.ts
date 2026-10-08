import assert from 'node:assert/strict'
import test from 'node:test'
import { parseAddressList, safeAttachmentName, validateAttachment, validEmail } from './mail-safety'

test('normaliza destinatarios separados por coma o punto y coma', () => {
  assert.deepEqual(parseAddressList('a@example.com; b@example.com, c@example.com'), ['a@example.com', 'b@example.com', 'c@example.com'])
})

test('valida emails y bloquea adjuntos peligrosos', () => {
  assert.equal(validEmail('contacto@tradagora.com'), true)
  assert.equal(validEmail('correo inválido'), false)
  assert.match(validateAttachment({ name: 'script.js', size: 100 }) ?? '', /bloqueado/)
  assert.equal(validateAttachment({ name: 'reporte.pdf', size: 100 }), null)
})

test('sanea nombres usados en Content-Disposition', () => {
  assert.equal(safeAttachmentName('../reporte:2026.pdf'), '.._reporte_2026.pdf')
})
