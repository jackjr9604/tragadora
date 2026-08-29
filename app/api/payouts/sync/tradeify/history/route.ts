import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createPayoutRows,
  deduplicatePayouts,
  delay,
  getErrorMessage,
  getExistingHashes,
  getTradeifyCurrentBlock,
  getTradeifyFirstTransferBlock,
  getTradeifyPayoutBlockRange,
  getTradeifySource,
  insertPayoutRows,
  isAuthorized,
  recordTradeifyError,
  updateSourceSuccess,
} from '../shared'

const BLOCK_WINDOW = 500_000
const WINDOWS_PER_RUN = 5

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
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
        message: 'El histórico de Tradeify ya está completo.',
      })
    }

    const currentBlock = await getTradeifyCurrentBlock(config)
    const discoveredStartBlock = config.historyStartBlock
      ?? await getTradeifyFirstTransferBlock({ config, currentBlock })

    if (discoveredStartBlock === null) {
      const updatedConfig = {
        ...config.raw,
        history_start_block: null,
        history_last_block: currentBlock + 1,
        history_complete: true,
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
        startBlock: null,
        endBlock: currentBlock,
        blockRangeProcessed: 0,
        windowsProcessed: 0,
        transactionsProcessed: 0,
        payoutsFound: 0,
        existing: 0,
        inserted: 0,
        nextBlock: null,
        historyComplete: true,
        etherscanRequests: 0,
      })
    }

    const startBlock = config.historyLastBlock
      ?? discoveredStartBlock

    if (startBlock > currentBlock) {
      const updatedConfig = {
        ...config.raw,
        history_start_block: discoveredStartBlock,
        history_last_block: startBlock,
        history_complete: true,
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
        startBlock,
        endBlock: currentBlock,
        blockRangeProcessed: 0,
        windowsProcessed: 0,
        transactionsProcessed: 0,
        payoutsFound: 0,
        existing: 0,
        inserted: 0,
        nextBlock: null,
        historyComplete: true,
        etherscanRequests: 0,
      })
    }

    let cursor = startBlock
    let endBlock = startBlock - 1
    let windowsProcessed = 0
    let transactionsProcessed = 0
    let payoutsFound = 0
    let existing = 0
    let inserted = 0
    let etherscanRequests = 0

    for (
      let windowIndex = 0;
      windowIndex < WINDOWS_PER_RUN && cursor <= currentBlock;
      windowIndex++
    ) {
      if (windowIndex > 0) {
        await delay(400)
      }

      const windowEndBlock = Math.min(
        cursor + BLOCK_WINDOW - 1,
        currentBlock
      )
      const result = await getTradeifyPayoutBlockRange({
        config,
        startBlock: cursor,
        endBlock: windowEndBlock,
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
      const rows = createPayoutRows({ source, payouts: newPayouts })

      await insertPayoutRows({ supabase, rows })

      const nextWindowBlock = windowEndBlock + 1
      const completedAfterWindow = nextWindowBlock > currentBlock
      const updatedConfig = {
        ...config.raw,
        history_start_block: discoveredStartBlock,
        history_last_block: nextWindowBlock,
        history_complete: completedAfterWindow,
      }

      // La ventana solo queda confirmada después de consultar,
      // insertar y persistir correctamente su siguiente bloque.
      await updateSourceSuccess({
        supabase,
        sourceId: source.id,
        config: updatedConfig,
      })

      windowsProcessed++
      transactionsProcessed += result.transactionCount
      payoutsFound += payouts.length
      existing += payouts.length - newPayouts.length
      inserted += newPayouts.length
      etherscanRequests += result.requestCount
      endBlock = windowEndBlock
      cursor = nextWindowBlock
    }

    const historyComplete = cursor > currentBlock

    return NextResponse.json({
      success: true,
      collector: 'tradeify',
      mode: 'historical',
      startBlock,
      endBlock,
      blockRangeProcessed:
        endBlock >= startBlock
          ? endBlock - startBlock + 1
          : 0,
      windowsProcessed,
      transactionsProcessed,
      payoutsFound,
      existing,
      inserted,
      nextBlock: historyComplete ? null : cursor,
      historyComplete,
      etherscanRequests,
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
