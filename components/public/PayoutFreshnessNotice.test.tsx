import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { PayoutFreshnessNotice } from './PayoutFreshnessNotice'

test('verified payout uses payment labels in ES/EN/PT and never calls its date a snapshot update', () => {
  for (const [language, label, unknown, wrongLabel] of [
    ['es', 'Último pago registrado', 'No disponible', 'Última actualización de los datos'],
    ['en', 'Last recorded payout', 'Unavailable', 'Last data update'],
    ['pt', 'Último pagamento registrado', 'Indisponível', 'Última atualização dos dados'],
  ]) {
    const html = renderToStaticMarkup(<PayoutFreshnessNotice language={language} summary={{ displayTotalUpdatedAt: '2020-01-01T00:00:00Z', displayTotalSourceType: 'tragadora_blockchain' }} />)
    assert.ok(html.includes(label))
    assert.ok(html.includes(unknown))
    assert.ok(!html.includes(wrongLabel))
    assert.equal((html.match(/<time /g) ?? []).length, 1)
    assert.doesNotMatch(html, /Captura antigua|Old snapshot|Captura antiga/)
  }
})

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
