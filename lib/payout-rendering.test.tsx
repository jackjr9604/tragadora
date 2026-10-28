import React from 'react'
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { FirmPayoutDashboard } from '../components/public/FirmPayoutDashboard'
import { SummaryTable, money } from '../components/public/PayoutTrackerUI'
import { payoutPeriod } from './payout-periods'
import { selectPayoutSummary } from './payout-summary-selection'
import type { AwaitedPayoutDetail, PayoutFirmSummary } from './payout-tracker'

test('24h URLs in both entry points retain the requested period', () => {
  assert.equal(payoutPeriod('24h', 'all'), '24h')
  for (const file of ['app/payouts/[slug]/page.tsx', 'app/prop-firms/[slug]/page.tsx']) {
    const source = readFileSync(file, 'utf8')
    assert.doesNotMatch(source, /=== '24h' \? '7d'/)
    assert.match(source, /payoutPeriod\((?:requested|requestedPeriod), 'all'\)/)
  }
})

test('cards and table render one source, correct currency and rounded amounts in ES/EN/PT', () => {
  const selected = selectPayoutSummary({ platform_id: 'fixture', period_key: '24h', verified_amount: 99999, verified_payout_count: 1, verified_largest_payout: 99999, verified_average_payout: 99999 }, [{ platform_id: 'fixture', period_key: '24h', id: 'snapshot', metric_type: 'payout_summary', is_current: true, amount: 1234567, payout_count: 1000, largest_payout: null, average_payout: 1235, currency: 'EUR', source_type: 'third_party_public', verification_level: 'blockchain_external' }])
  const summary = { platformId: 'fixture', name: 'Fixture', slug: 'fixture', markets: [], logoUrl: null, periodKey: '24h', displayTotalAmount: selected.display_total_amount, knownPayoutCount: selected.known_payout_count, knownLargestPayout: selected.known_largest_payout, knownAveragePayout: selected.known_average_payout, knownCurrency: selected.known_currency, verifiedAmount: 99999, verifiedPayoutCount: 1, verifiedLargestPayout: 99999, verifiedAveragePayout: 99999 } as unknown as PayoutFirmSummary
  const detail = { summary, payouts: [], trend: [], context: { payoutMethods: [], policies: [] } } as unknown as AwaitedPayoutDetail
  for (const language of ['es', 'en', 'pt']) {
    const card = renderToStaticMarkup(<FirmPayoutDashboard detail={detail} period="24h" basePath="/payouts/fixture" language={language} />)
    const table = renderToStaticMarkup(<SummaryTable summaries={[summary]} language={language} />)
    for (const markup of [card, table]) {
      assert.ok(markup.includes(money(1234567, 'EUR', language)))
      assert.ok(markup.includes(money(1235, 'EUR', language)))
      assert.ok(!markup.includes(money(99999, 'USD', language)))
    }
  }
})
