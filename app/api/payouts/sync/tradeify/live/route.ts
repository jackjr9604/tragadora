import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createPayoutRows,
  deduplicatePayouts,
  getErrorMessage,
  getExistingHashes,
  getTradeifyPayoutPage,
  getTradeifySource,
  insertPayoutRows,
  isAuthorized,
  recordTradeifyError,
  updateSourceSuccess,
} from '../shared'

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized',
      },
      { status: 401 }
    )
  }

  try {
    const supabase = createAdminClient()
    const source = await getTradeifySource(supabase)
    const result = await getTradeifyPayoutPage({
      config: source.config,
      page: 1,
      sort: 'desc',
    })
    const payouts = deduplicatePayouts(result.payouts)
    const existingHashes = await getExistingHashes({
      supabase,
      payoutSourceId: source.id,
      hashes: payouts.map((payout) => payout.hash),
    })
    const newPayouts = payouts.filter(
      (payout) => !existingHashes.has(payout.hash)
    )
    const rows = createPayoutRows({
      source,
      payouts: newPayouts,
    })

    await insertPayoutRows({ supabase, rows })
    await updateSourceSuccess({
      supabase,
      sourceId: source.id,
    })

    return NextResponse.json({
      success: true,
      collector: 'tradeify',
      mode: 'live',
      payoutsChecked: result.transactionCount,
      payoutsFound: payouts.length,
      existing: payouts.length - newPayouts.length,
      inserted: newPayouts.length,
    })
  } catch (error) {
    console.error(error)
    await recordTradeifyError(error)

    return NextResponse.json(
      {
        success: false,
        collector: 'tradeify',
        mode: 'live',
        error: getErrorMessage(error),
      },
      { status: 500 }
    )
  }
}
