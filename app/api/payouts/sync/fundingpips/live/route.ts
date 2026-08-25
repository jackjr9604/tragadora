import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SETTLEMENT_ADDRESS =
  '0x032a1FD6f00AdCB7b60c6cCf806149C3FF5ba861'

const RISEUSD_ADDRESS =
  '0xace876e867ecf2c3d1b8097b160a666adce04cd0'

type EtherscanTokenTransfer = {
  from?: string
  to?: string
  hash: string
  blockNumber: string
  timeStamp: string
  tokenDecimal?: string
  value: string
  contractAddress: string
}

type EtherscanResponse = {
  status?: string
  message?: string
  result?: unknown
}

type LivePayout = {
  hash: string
  block: number
  date: string
  recipient: string
  amountRaw: string
  amount: number
  token: string
}

export async function POST(
  request: Request
) {
  const authorization =
    request.headers.get('authorization')

  const expected =
    `Bearer ${process.env.CRON_SECRET}`

  if (
    !process.env.CRON_SECRET ||
    authorization !== expected
  ) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized',
      },
      {
        status: 401,
      }
    )
  }

  try {
    const supabase = createAdminClient()

    const { data: source, error: sourceError } =
      await supabase
        .from('payout_sources')
        .select(`
          id,
          platform_id,
          name
        `)
        .eq(
          'name',
          'FundingPips RiseUSD - Arbitrum'
        )
        .eq('status', true)
        .single()

    if (sourceError || !source) {
      throw new Error(
        'Fuente FundingPips no encontrada'
      )
    }

    const fetchedPayouts = await getLatestPayouts()
    const payouts = Array.from(
      new Map(
        fetchedPayouts.map((payout) => [
          payout.hash,
          payout,
        ])
      ).values()
    )
    const hashes = payouts.map(
      (payout) => payout.hash
    )
    const existingHashes = new Set<string>()

    if (hashes.length > 0) {
      const { data: existing, error: existingError } =
        await supabase
          .from('payouts')
          .select('external_id')
          .eq(
            'payout_source_id',
            source.id
          )
          .in('external_id', hashes)

      if (existingError) {
        throw existingError
      }

      for (const item of existing ?? []) {
        if (item.external_id) {
          existingHashes.add(item.external_id)
        }
      }
    }

    const newPayouts = payouts.filter(
      (payout) =>
        !existingHashes.has(payout.hash)
    )

    const rows = newPayouts.map(
      (payout) => ({
        platform_id: source.platform_id,
        payout_source_id: source.id,
        amount: payout.amount,
        currency: 'USD',
        payout_date: payout.date,
        payment_method: 'RiseUSD',
        source: 'blockchain',
        verification_status: 'automatic',
        external_id: payout.hash,
        source_url:
          `https://arbiscan.io/tx/${payout.hash}`,
        last_verified_at:
          new Date().toISOString(),
        raw_data: {
          chain: 'arbitrum',
          block: payout.block,
          transaction_hash: payout.hash,
          recipient: payout.recipient,
          amount_raw: payout.amountRaw,
          token: RISEUSD_ADDRESS,
          settlement_address: SETTLEMENT_ADDRESS,
        },
      })
    )

    if (rows.length > 0) {
      const { error: insertError } =
        await supabase
          .from('payouts')
          .insert(rows)

      if (insertError) {
        throw insertError
      }
    }

    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('payout_sources')
      .update({
        last_sync_at: now,
        last_success_at: now,
        last_error: null,
      })
      .eq('id', source.id)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      success: true,
      mode: 'live',
      payoutsChecked: payouts.length,
      existing:
        payouts.length - newPayouts.length,
      inserted: newPayouts.length,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    )
  }
}

async function getLatestPayouts(): Promise<LivePayout[]> {
  const apiKey = process.env.ETHERSCAN_API_KEY

  if (!apiKey) {
    throw new Error(
      'ETHERSCAN_API_KEY no configurada'
    )
  }

  const ZERO_ADDRESS =
    '0x0000000000000000000000000000000000000000'

  const url =
    `https://api.etherscan.io/v2/api` +
    `?chainid=42161` +
    `&module=account` +
    `&action=tokentx` +
    `&contractaddress=${RISEUSD_ADDRESS}` +
    `&address=${SETTLEMENT_ADDRESS}` +
    `&page=1` +
    `&offset=100` +
    `&sort=desc` +
    `&apikey=${apiKey}`

  const response = await fetch(url, {
    cache: 'no-store',
  })
  const result =
    await response.json() as EtherscanResponse
  const noTransactions = String(result.message)
    .toLowerCase()
    .includes('no transactions')

  if (result.status !== '1' && !noTransactions) {
    throw new Error(
      (typeof result.result === 'string'
        ? result.result
        : undefined) ||
        result.message ||
        'Error consultando RiseUSD'
    )
  }

  const transactions: EtherscanTokenTransfer[] =
    Array.isArray(result.result)
      ? result.result as EtherscanTokenTransfer[]
      : []

  return transactions
    .filter((tx) => {
      return (
        tx.from?.toLowerCase() ===
        SETTLEMENT_ADDRESS.toLowerCase() &&
        tx.to?.toLowerCase() === ZERO_ADDRESS
      )
    })
    .map((tx) => {
      const decimals = Number(tx.tokenDecimal || 6)
      const amount =
        Number(tx.value) / Math.pow(10, decimals)

      return {
        hash: tx.hash,
        block: Number(tx.blockNumber),
        date: new Date(
          Number(tx.timeStamp) * 1000
        ).toISOString(),
        recipient: ZERO_ADDRESS,
        amountRaw: tx.value,
        amount,
        token: tx.contractAddress,
      }
    })
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null) {
    const details = error as Record<string, unknown>
    const message = details.message

    if (typeof message === 'string') {
      return message
    }

    return JSON.stringify(error)
  }

  return String(error)
}
