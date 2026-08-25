import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SETTLEMENT_ADDRESS =
  '0x032a1FD6f00AdCB7b60c6cCf806149C3FF5ba861'

const RISEUSD_ADDRESS =
  '0xace876e867ecf2c3d1b8097b160a666adce04cd0'

type BlockchainPayout = {
  hash: string
  block: number
  date: string
  recipient: string
  amountRaw: string
  amount: number
  isRiseUSD: boolean
}

type EtherscanTokenTransfer = {
  from?: string
  to?: string
  hash: string
  blockNumber: string
  timeStamp: string
  tokenDecimal?: string
  value: string
}

type EtherscanResponse = {
  status?: string
  message?: string
  result?: unknown
}

type FundingPipsResult = {
  payouts: BlockchainPayout[]
  transactionCount: number
  hasMore: boolean
}

export async function GET() {
  try {
    const { payouts } =
      await getFundingPipsPayouts(1)

    return NextResponse.json({
      success: true,
      mode: 'preview',
      collector: 'fundingpips',
      network: 'arbitrum',
      found: payouts.length,
      payouts,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

/*
 * POST
 * Guarda payouts nuevos en Supabase.
 */
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

    /*
     * 1. Buscar la fuente configurada
     */
    const {
      data: payoutSource,
      error: sourceError,
    } = await supabase
      .from('payout_sources')
      .select(`
        id,
        platform_id,
        name,
        config
      `)
      .eq(
        'name',
        'FundingPips RiseUSD - Arbitrum'
      )
      .eq('status', true)
      .single()

    if (sourceError || !payoutSource) {
      throw new Error(
        'No se encontró la fuente de FundingPips en payout_sources'
      )
    }

    /*
     * 2. Obtener payouts desde blockchain
     */
    const config =
      payoutSource.config ?? {}

    const historyPage =
      Number(config.history_page ?? 1)

    const PAGES_PER_RUN = 5

    let currentPage = historyPage
    let totalTransactions = 0
    let allPayouts: BlockchainPayout[] = []
    let historyComplete = false

    for (let i = 0; i < PAGES_PER_RUN; i++) {
      if (i > 0) {
        await delay(400)
      }

      const result =
        await getFundingPipsPayouts(currentPage)

      totalTransactions +=
        result.transactionCount

      allPayouts = [
        ...allPayouts,
        ...result.payouts,
      ]

      if (!result.hasMore) {
        historyComplete = true
        break
      }

      if (i < PAGES_PER_RUN - 1) {
        currentPage++
      }
    }

    const blockchainPayouts = Array.from(
      new Map(
        allPayouts.map((payout) => [
          payout.hash,
          payout,
        ])
      ).values()
    )

    /*
     * 3. Obtener hashes
     */
    const hashes = blockchainPayouts.map(
      (payout) => payout.hash
    )

    /*
     * 4. Buscar cuáles ya existen
     */
    const HASH_BATCH_SIZE = 75
    const existingHashes = new Set<string>()

    for (
      let offset = 0;
      offset < hashes.length;
      offset += HASH_BATCH_SIZE
    ) {
      const hashBatch = hashes.slice(
        offset,
        offset + HASH_BATCH_SIZE
      )

      const {
        data: existingPayouts,
        error: existingError,
      } = await supabase
        .from('payouts')
        .select('external_id')
        .eq(
          'payout_source_id',
          payoutSource.id
        )
        .in('external_id', hashBatch)

      if (existingError) {
        throw existingError
      }

      for (const payout of existingPayouts ?? []) {
        if (payout.external_id) {
          existingHashes.add(payout.external_id)
        }
      }
    }

    /*
     * 5. Dejar únicamente payouts nuevos
     */
    const newPayouts =
      blockchainPayouts.filter(
        (payout) =>
          !existingHashes.has(payout.hash)
      )

    /*
     * 6. Convertirlos al formato de nuestra BD
     */
    const rows = newPayouts.map(
      (payout) => ({
        platform_id:
          payoutSource.platform_id,

        payout_source_id:
          payoutSource.id,

        amount:
          payout.amount,

        currency: 'USD',

        payout_date:
          payout.date,

        payment_method:
          'RiseUSD',

        source:
          'blockchain',

        verification_status:
          'automatic',

        external_id:
          payout.hash,

        source_url:
          `https://arbiscan.io/tx/${payout.hash}`,

        last_verified_at:
          new Date().toISOString(),

        raw_data: {
          chain: 'arbitrum',
          chain_id: 42161,
          block: payout.block,
          transaction_hash:
            payout.hash,
          recipient:
            payout.recipient,
          amount_raw:
            payout.amountRaw,
          token:
            RISEUSD_ADDRESS,
          token_symbol:
            'RiseUSD',
          settlement_address:
            SETTLEMENT_ADDRESS,
        },
      })
    )

    /*
     * 7. Insertar solamente si hay nuevos
     */
    if (rows.length > 0) {
      const { error: insertError } =
        await supabase
          .from('payouts')
          .insert(rows)

      if (insertError) {
        throw insertError
      }
    }

    const nextPage =
      historyComplete
        ? currentPage
        : currentPage + 1

    const updatedConfig = {
      ...config,

      history_page:
        nextPage,

      history_complete:
        historyComplete,
    }

    await supabase
      .from('payout_sources')
      .update({
        config: updatedConfig,
        last_sync_at:
          new Date().toISOString(),

        last_success_at:
          new Date().toISOString(),

        last_error: null,
      })
      .eq(
        'id',
        payoutSource.id
      )

    return NextResponse.json({
      success: true,

      collector:
        'fundingpips',

      mode:
        'historical',

      startPage:
        historyPage,

      endPage:
        currentPage,

      transactionsProcessed:
        totalTransactions,

      payoutsFound:
        blockchainPayouts.length,

      existing:
        blockchainPayouts.length -
        newPayouts.length,

      inserted:
        newPayouts.length,

      nextPage:
        historyComplete
          ? null
          : nextPage,

      historyComplete,
    })
  } catch (error) {
    console.error(error)

    /*
     * Intentamos registrar el error en payout_sources
     */
    try {
      const supabase =
        createAdminClient()

      const { data } = await supabase
        .from('payout_sources')
        .select('id')
        .eq(
          'name',
          'FundingPips RiseUSD - Arbitrum'
        )
        .maybeSingle()

      if (data) {
        await supabase
          .from('payout_sources')
          .update({
            last_sync_at:
              new Date().toISOString(),

            last_error:
              getErrorMessage(error),
          })
          .eq('id', data.id)
      }
    } catch {
      // No hacemos nada si tampoco
      // podemos registrar el error.
    }

    return errorResponse(error)
  }
}

/*
 * CONSULTAR BLOCKCHAIN
 */
async function getFundingPipsPayouts(
  page: number
): Promise<FundingPipsResult> {
  const apiKey =
    process.env.ETHERSCAN_API_KEY

  if (!apiKey) {
    throw new Error(
      'ETHERSCAN_API_KEY no configurada'
    )
  }

  const PAGE_SIZE = 100

  const ZERO_ADDRESS =
    '0x0000000000000000000000000000000000000000'

  const url =
    `https://api.etherscan.io/v2/api` +
    `?chainid=42161` +
    `&module=account` +
    `&action=tokentx` +
    `&contractaddress=${RISEUSD_ADDRESS}` +
    `&address=${SETTLEMENT_ADDRESS}` +
    `&page=${page}` +
    `&offset=${PAGE_SIZE}` +
    `&sort=asc` +
    `&apikey=${apiKey}`

  const MAX_RATE_LIMIT_RETRIES = 3
  let result: EtherscanResponse = {}

  for (
    let attempt = 0;
    attempt < MAX_RATE_LIMIT_RETRIES;
    attempt++
  ) {
    const response = await fetch(url, {
      cache: 'no-store',
    })

    result =
      await response.json() as EtherscanResponse

    const responseMessage =
      `${result.message ?? ''} ${
        typeof result.result === 'string'
          ? result.result
          : ''
      }`.toLowerCase()

    if (!responseMessage.includes('rate limit')) {
      break
    }

    if (attempt === MAX_RATE_LIMIT_RETRIES - 1) {
      throw new Error(
        'Etherscan rate limit alcanzado después de 3 reintentos'
      )
    }

    await delay(1_000 * (attempt + 1))
  }

  /*
   * Etherscan también puede devolver
   * status 0 cuando no quedan transacciones.
   */
  if (
    result.status !== '1' &&
    !String(result.message)
      .toLowerCase()
      .includes('no transactions')
  ) {
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

  const payouts =
    transactions
    .filter((tx) => {
      return (
        tx.from?.toLowerCase() ===
          SETTLEMENT_ADDRESS.toLowerCase() &&
        tx.to?.toLowerCase() ===
          ZERO_ADDRESS
      )
    })
    .map((tx) => {
      const decimals =
        Number(tx.tokenDecimal || 6)

      return {
        hash: tx.hash,

        block:
          Number(tx.blockNumber),

        date:
          new Date(
            Number(tx.timeStamp) *
              1000
          ).toISOString(),

        recipient:
          ZERO_ADDRESS,

        amountRaw:
          tx.value,

        amount:
          Number(tx.value) /
          Math.pow(10, decimals),

        isRiseUSD: true,
      }
    })

  return {
    payouts,
    transactionCount:
      transactions.length,

    hasMore:
      transactions.length ===
      PAGE_SIZE,
  }
}

function errorResponse(
  error: unknown
) {
  return NextResponse.json(
    {
      success: false,

      error: getErrorMessage(error),
    },
    {
      status: 500,
    }
  )
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (
    typeof error === 'object' &&
    error !== null
  ) {
    const details = error as Record<
      string,
      unknown
    >

    const parts = [
      details.message,
      details.details,
      details.hint,
      details.code
        ? `Código: ${details.code}`
        : undefined,
    ].filter(
      (value): value is string =>
        typeof value === 'string' &&
        value.length > 0
    )

    if (parts.length > 0) {
      return parts.join(' | ')
    }

    try {
      return JSON.stringify(error)
    } catch {
      return 'Error desconocido'
    }
  }

  return String(error)
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}
