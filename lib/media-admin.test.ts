import assert from 'node:assert/strict'
import test from 'node:test'
import { mediaStoragePath, sanitizeMediaIds } from './media-admin'

test('acepta UUID válidos, elimina inválidos y duplicados', () => {
  const id = 'b5815c61-98d4-46e4-a629-3c0229cfb783'
  assert.deepEqual(sanitizeMediaIds([id, 'no-es-uuid', id]), [id])
})

test('extrae únicamente rutas del bucket público Media', () => {
  assert.equal(mediaStoragePath('https://example.supabase.co/storage/v1/object/public/media/logos/Tradagora%20logo.png'), 'logos/Tradagora logo.png')
  assert.equal(mediaStoragePath('https://example.com/image.png'), null)
})
