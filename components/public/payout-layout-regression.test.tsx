import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { SummaryTable } from './PayoutTrackerUI'
import { HomePayoutRankings } from './HomePayoutRankings'
import { FirmPayoutDashboard } from './FirmPayoutDashboard'
import type { PayoutFirmSummary, AwaitedPayoutDetail } from '@/lib/payout-tracker'
import type { HomeRankings } from '@/lib/home-data'

const summary = {
  platformId: 'fixture', name: 'Fixture firm', slug: 'fixture', logoUrl: null, markets: ['futures'], periodKey: 'all',
  displayTotalAmount: 12000, knownPayoutCount: 4, knownLargestPayout: 5000, knownAveragePayout: 3000,
  displayTotalSourceName: 'Fixture source', displayTotalSourceType: 'third_party_public', knownCurrency: 'USD',
  displayTotalUpdatedAt: '2020-01-01T00:00:00Z', displayTotalLastCheckedAt: '2026-10-28T14:00:00Z',
  verifiedAmount: 0, verifiedPayoutCount: 0,
} as PayoutFirmSummary
const platform = { id: 'fixture', name: summary.name, slug: summary.slug, logoUrl: null }
const row = { platform, amount: 12000, payoutCount: 4, capturedAt: summary.displayTotalUpdatedAt }
const rankings = { thirtyDays: [row], allTime: [row] } as HomeRankings
const detail = { summary, payouts: [], trend: [], context: { country: null, foundedAt: null, profitSplit: null, payoutMethods: [], policies: [] } } as unknown as AwaitedPayoutDetail

test('internal timestamps never add visual notices to home, tracker or firm views in ES/EN/PT', () => {
  for (const language of ['es', 'en', 'pt']) {
    for (const view of [
      <SummaryTable key="tracker" summaries={[summary]} language={language} />,
      <HomePayoutRankings key="home" rankings={rankings} badge="Fixture" title="Fixture" subtitle="Fixture" language={language} />,
      <FirmPayoutDashboard key="firm" detail={detail} period="all" basePath="/payouts/fixture" language={language} />,
      <FirmPayoutDashboard key="embedded" detail={detail} period="all" basePath="/prop-firms/fixture" language={language} embedded />,
    ]) {
      const html = renderToStaticMarkup(view)
      assert.doesNotMatch(html, /2020-01-01|2026-10-28|role="note"|Antigüedad de las cifras|Last data update|Último pagamento registrado/)
      assert.match(html, /12/)
    }
  }
})
