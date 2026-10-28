import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { PayoutFreshnessNotice } from './PayoutFreshnessNotice'

test('renders old figures beside a recent check with a visible warning', () => {
  const html = renderToStaticMarkup(<PayoutFreshnessNotice language="es" summary={{ displayTotalUpdatedAt: '2020-01-01T00:00:00Z', displayTotalLastCheckedAt: new Date().toISOString(), displayTotalSourceType: 'third_party_public', displayTotalSourceName: 'Fixture source' }} />)
  assert.match(html, /Última actualización de los datos/)
  assert.match(html, /Última comprobación/)
  assert.match(html, /Captura antigua/)
  assert.match(html, /2020-01-01T00:00:00.000Z/)
  assert.match(html, /No renueva la fecha de los datos/)
})

test('missing check records remain unavailable in every public UI language', () => {
  for (const [language, label] of [['es', 'No disponible'], ['en', 'Unavailable'], ['pt', 'Indisponível']]) {
    const html = renderToStaticMarkup(<PayoutFreshnessNotice language={language} compact summary={{ displayTotalUpdatedAt: '2020-01-01T00:00:00Z', displayTotalSourceType: 'third_party_public' }} />)
    assert.ok(html.includes(label))
    assert.equal((html.match(/<time /g) ?? []).length, 1)
  }
})
