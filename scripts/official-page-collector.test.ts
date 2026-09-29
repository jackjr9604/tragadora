import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { chromium } from 'playwright'
import { assertSafeCollectorUrl, collectOfficialPeriod, parseOfficialValue, snapshotsEqual, sourceTrustRank, validateOfficialConfig, type OfficialPageCollectorConfig } from './official-page-collector.ts'

const config: OfficialPageCollectorConfig = {
  enabled: true, kind: 'official_page', version: 1, currency: 'USD', sourceName: 'The Trading Pit Rewards', waitForSelector: '#overall-rewards-card',
  periods: [{ periodKey: 'all', label: 'All time', triggerSelector: 'button[data-period="all"]', activeSelector: 'button[data-period="all"].active' }],
  metrics: { amount: { selector: '#stats-total-value', parser: 'currency', required: true }, averagePayout: { selector: '#stats-avg-value', parser: 'currency', required: false }, payoutCount: { selector: '#missing-count', parser: 'integer', required: false } },
  averageProcessingTime: { selector: '#stats-duration-value', parser: 'hours', required: false },
  recentRewards: { rowSelector: '#recent-rewards-tbody tr', columns: { date: 0, market: 1, accountBalance: 2, reward: 3 } },
}

test('parsers controlados conservan null y unidades', () => {
  assert.equal(parseOfficialValue('$1,435', 'currency'), 1435)
  assert.equal(parseOfficialValue('55.4h', 'hours'), 3324)
  assert.equal(parseOfficialValue('—', 'number'), null)
})

test('config rechaza parsers arbitrarios', () => {
  assert.throws(() => validateOfficialConfig({ ...config, metrics: { amount: { selector: '#x', parser: 'javascript', required: true } } }), /COLLECTOR_CONFIG_INVALID/)
})

test('URL security bloquea esquemas y redes locales', () => {
  assert.throws(() => assertSafeCollectorUrl('http://example.com'), /solo HTTPS/)
  assert.throws(() => assertSafeCollectorUrl('https://127.0.0.1/private'), /privado o local/)
  assert.equal(assertSafeCollectorUrl('https://www.thetradingpit.com/lp/all-rewards').hostname, 'www.thetradingpit.com')
})

test('ranking mantiene oficial por encima de terceros', () => {
  assert.ok(sourceTrustRank('official_firm', 'firm_reported') > sourceTrustRank('third_party_public', 'blockchain_external'))
})

test('fixture extrae métricas, nullable opcional y recent rewards', async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.setContent(await readFile(new URL('./fixtures/the-trading-pit-rewards.html', import.meta.url), 'utf8'))
    const result = await collectOfficialPeriod(page, config, config.periods[0])
    assert.equal(result.metrics.amount, 18_107_910)
    assert.equal(result.metrics.payoutCount, null)
    assert.equal(result.averageProcessingMinutes, 3324)
    assert.equal(result.recentRewards[0].reward, 1593)
    assert.equal(result.diagnostics[0].code, 'SELECTOR_NOT_FOUND')
    assert.ok(snapshotsEqual({ ...result.metrics, raw_data: { average_processing_minutes: 3324 } }, result))
  } finally { await browser.close() }
})

test('selector requerido ausente falla sin inventar cero', async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.setContent('<button class="active">All time</button>')
    const broken = { ...config, periods: [{ ...config.periods[0], triggerSelector: 'button', activeSelector: 'button.active' }], metrics: { amount: { selector: '#missing', parser: 'currency' as const, required: true } } }
    await assert.rejects(() => collectOfficialPeriod(page, broken, broken.periods[0]), /SELECTOR_NOT_FOUND/)
  } finally { await browser.close() }
})
