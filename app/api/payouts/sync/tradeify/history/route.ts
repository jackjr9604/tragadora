import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  type BlockchainPayout,
  createPayoutRows,
  deduplicatePayouts,
  delay,
  getErrorMessage,
  getExistingHashes,
  getTradeifyPayoutPage,
  getTradeifySource,
  insertPayoutRows,
  isAuthorized,
  recordTradeifyError,
  updateSourceSuccess,
} from '../shared'

const PAGES_PER_RUN = 5

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
    const { config } = source

    if (config.historyComplete) {
      return NextResponse.json({
        success: true,
        collector: 'tradeify',
        mode: 'historical',
        historyComplete: true,
        inserted: 0,
        message:
          'El histórico de Tradeify ya está completo.',
      })
    }

    const historyPage = config.historyPage
    let currentPage = historyPage
    let totalTransactions = 0
    let allPayouts: BlockchainPayout[] = []
    let historyCompletedThisRun = false

    for (let i = 0; i < PAGES_PER_RUN; i++) {
      if (i > 0) {
        await delay(400)
      }

      const result = await getTradeifyPayoutPage({
        config,
        page: currentPage,
        sort: 'asc',
      })

      totalTransactions += result.transactionCount
      allPayouts = [
        ...allPayouts,
        ...result.payouts,
      ]

      if (!result.hasMore) {
        historyCompletedThisRun = true
        break
      }

      if (i < PAGES_PER_RUN - 1) {
        currentPage++
      }
    }

    const payouts = deduplicatePayouts(allPayouts)
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

    const nextPage = historyCompletedThisRun
      ? currentPage
      : currentPage + 1
    const updatedConfig = {
      ...config.raw,
      history_page: nextPage,
      history_complete: historyCompletedThisRun,
    }

    await updateSourceSuccess({
      supabase,
      sourceId: source.id,
      config: updatedConfig,
    })

    return NextResponse.json({
      success: true,
      collector: 'tradeify',
      mode: 'historical',
      startPage: historyPage,
      endPage: currentPage,
      transactionsProcessed: totalTransactions,
      payoutsFound: payouts.length,
      existing: payouts.length - newPayouts.length,
      inserted: newPayouts.length,
      nextPage: historyCompletedThisRun
        ? null
        : nextPage,
      historyComplete: historyCompletedThisRun,
    })
  } catch (error) {
    console.error(error)
    await recordTradeifyError(error)

    return NextResponse.json(
      {
        success: false,
        collector: 'tradeify',
        mode: 'historical',
        error: getErrorMessage(error),
      },
      { status: 500 }
    )
  }
}
