import { createAdminClient } from '@/lib/supabase/admin'

export const TRADEIFY_SOURCE_NAME =
  'Tradeify RiseUSD - Arbitrum'

const ETHERSCAN_API_URL =
  'https://api.etherscan.io/v2/api'
const ZERO_ADDRESS =
  '0x0000000000000000000000000000000000000000'
const PAGE_SIZE = 100
const HASH_BATCH_SIZE = 75
const MAX_RATE_LIMIT_RETRIES = 3

type SupabaseAdminClient = ReturnType<
  typeof createAdminClient
>

type EtherscanTokenTransfer = {
  from?: string
  to?: string
  hash: string
  blockNumber: string
  timeStamp: string
  value: string
}

type EtherscanResponse = {
  status?: string
  message?: string
  result?: unknown
}

export type TradeifyConfig = {
  chain: string
  chainId: number
  tokenAddress: string
  tokenSymbol: string
  decimals: number
  settlementAddress: string
  historyPage: number
  historyComplete: boolean
  raw: Record<string, unknown>
}

export type TradeifySource = {
  id: string
  platformId: string
  name: string
  config: TradeifyConfig
}

export type BlockchainPayout = {
  hash: string
  block: number
  date: string
  recipient: string
  amountRaw: string
  amount: number
}

export type PayoutPageResult = {
  payouts: BlockchainPayout[]
  transactionCount: number
  hasMore: boolean
}

export function isAuthorized(request: Request) {
  const authorization =
    request.headers.get('authorization')
  const expected =
    `Bearer ${process.env.CRON_SECRET}`

  return Boolean(
    process.env.CRON_SECRET &&
    authorization === expected
  )
}

export async function getTradeifySource(
  supabase: SupabaseAdminClient
): Promise<TradeifySource> {
  const { data, error } = await supabase
    .from('payout_sources')
    .select(`
      id,
      platform_id,
      name,
      config
    `)
    .eq('name', TRADEIFY_SOURCE_NAME)
    .eq('status', true)
    .single()

  if (error || !data) {
    throw new Error(
      'No se encontró la fuente activa de Tradeify en payout_sources'
    )
  }

  return {
    id: data.id,
    platformId: data.platform_id,
    name: data.name,
    config: parseTradeifyConfig(data.config),
  }
}

export async function getTradeifyPayoutPage({
  config,
  page,
  sort,
}: {
  config: TradeifyConfig
  page: number
  sort: 'asc' | 'desc'
}): Promise<PayoutPageResult> {
  const apiKey = process.env.ETHERSCAN_API_KEY

  if (!apiKey) {
    throw new Error(
      'ETHERSCAN_API_KEY no configurada'
    )
  }

  const searchParams = new URLSearchParams({
    chainid: String(config.chainId),
    module: 'account',
    action: 'tokentx',
    contractaddress: config.tokenAddress,
    address: config.settlementAddress,
    page: String(page),
    offset: String(PAGE_SIZE),
    sort,
    apikey: apiKey,
  })
  const url =
    `${ETHERSCAN_API_URL}?${searchParams.toString()}`
  let result: EtherscanResponse = {}

  for (
    let attempt = 0;
    attempt < MAX_RATE_LIMIT_RETRIES;
    attempt++
  ) {
    const response = await fetch(url, {
      cache: 'no-store',
    })

    if (!response.ok) {
      if (attempt === MAX_RATE_LIMIT_RETRIES - 1) {
        throw new Error(
          `Etherscan respondió HTTP ${response.status}`
        )
      }

      await delay(1_000 * (attempt + 1))
      continue
    }

    result =
      await response.json() as EtherscanResponse

    const responseMessage = getEtherscanMessage(result)
      .toLowerCase()

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

  const noTransactions = getEtherscanMessage(result)
    .toLowerCase()
    .includes('no transactions')

  if (result.status !== '1' && !noTransactions) {
    throw new Error(
      getEtherscanMessage(
        result,
        'Error consultando RiseUSD para Tradeify'
      )
    )
  }

  const transactions: EtherscanTokenTransfer[] =
    Array.isArray(result.result)
      ? result.result as EtherscanTokenTransfer[]
      : []
  const divisor = Math.pow(10, config.decimals)
  const payouts = transactions
    .filter((transaction) => {
      return (
        transaction.from?.toLowerCase() ===
          config.settlementAddress.toLowerCase() &&
        transaction.to?.toLowerCase() === ZERO_ADDRESS
      )
    })
    .map((transaction) => ({
      hash: transaction.hash,
      block: Number(transaction.blockNumber),
      date: new Date(
        Number(transaction.timeStamp) * 1_000
      ).toISOString(),
      recipient: ZERO_ADDRESS,
      amountRaw: transaction.value,
      amount: Number(transaction.value) / divisor,
    }))

  return {
    payouts,
    transactionCount: transactions.length,
    hasMore: transactions.length === PAGE_SIZE,
  }
}

export function deduplicatePayouts(
  payouts: BlockchainPayout[]
) {
  return Array.from(
    new Map(
      payouts.map((payout) => [payout.hash, payout])
    ).values()
  )
}

export async function getExistingHashes({
  supabase,
  payoutSourceId,
  hashes,
}: {
  supabase: SupabaseAdminClient
  payoutSourceId: string
  hashes: string[]
}) {
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
    const { data, error } = await supabase
      .from('payouts')
      .select('external_id')
      .eq('payout_source_id', payoutSourceId)
      .in('external_id', hashBatch)

    if (error) {
      throw error
    }

    for (const payout of data ?? []) {
      if (payout.external_id) {
        existingHashes.add(payout.external_id)
      }
    }
  }

  return existingHashes
}

export function createPayoutRows({
  source,
  payouts,
}: {
  source: TradeifySource
  payouts: BlockchainPayout[]
}) {
  const now = new Date().toISOString()

  return payouts.map((payout) => ({
    platform_id: source.platformId,
    payout_source_id: source.id,
    amount: payout.amount,
    currency: 'USD',
    payout_date: payout.date,
    payment_method: source.config.tokenSymbol,
    source: 'blockchain',
    verification_status: 'automatic',
    external_id: payout.hash,
    source_url:
      `https://arbiscan.io/tx/${payout.hash}`,
    last_verified_at: now,
    raw_data: {
      chain: source.config.chain,
      chain_id: source.config.chainId,
      block: payout.block,
      transaction_hash: payout.hash,
      recipient: payout.recipient,
      amount_raw: payout.amountRaw,
      token: source.config.tokenAddress,
      token_symbol: source.config.tokenSymbol,
      settlement_address:
        source.config.settlementAddress,
    },
  }))
}

export async function insertPayoutRows({
  supabase,
  rows,
}: {
  supabase: SupabaseAdminClient
  rows: ReturnType<typeof createPayoutRows>
}) {
  if (rows.length === 0) {
    return
  }

  const { error } = await supabase
    .from('payouts')
    .insert(rows)

  if (error) {
    throw error
  }
}

export async function updateSourceSuccess({
  supabase,
  sourceId,
  config,
}: {
  supabase: SupabaseAdminClient
  sourceId: string
  config?: Record<string, unknown>
}) {
  const now = new Date().toISOString()
  const values: Record<string, unknown> = {
    last_sync_at: now,
    last_success_at: now,
    last_error: null,
  }

  if (config) {
    values.config = config
  }

  const { error } = await supabase
    .from('payout_sources')
    .update(values)
    .eq('id', sourceId)

  if (error) {
    throw error
  }
}

export async function recordTradeifyError(error: unknown) {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('payout_sources')
      .select('id')
      .eq('name', TRADEIFY_SOURCE_NAME)
      .maybeSingle()

    if (!data) {
      return
    }

    await supabase
      .from('payout_sources')
      .update({
        last_sync_at: new Date().toISOString(),
        last_error: getErrorMessage(error),
      })
      .eq('id', data.id)
  } catch {
    // El error original tiene prioridad.
  }
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null) {
    const details = error as Record<string, unknown>
    const parts = [
      details.message,
      details.details,
      details.hint,
      details.code
        ? `Código: ${details.code}`
        : undefined,
    ].filter(
      (value): value is string =>
        typeof value === 'string' && value.length > 0
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

export function delay(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

function parseTradeifyConfig(
  value: unknown
): TradeifyConfig {
  const config = isRecord(value) ? value : {}
  const chain = requireString(config, 'chain')
  const tokenAddress = requireString(
    config,
    'token_address'
  )
  const tokenSymbol = requireString(
    config,
    'token_symbol'
  )
  const settlementAddress = requireString(
    config,
    'settlement_address'
  )
  const chainId = requirePositiveNumber(
    config,
    'chain_id'
  )
  const decimals = requireNonNegativeNumber(
    config,
    'decimals'
  )
  const historyPageValue = Number(
    config.history_page ?? 1
  )

  if (
    !Number.isSafeInteger(historyPageValue) ||
    historyPageValue < 1
  ) {
    throw new Error(
      'Tradeify config.history_page debe ser un entero mayor o igual a 1'
    )
  }

  return {
    chain,
    chainId,
    tokenAddress,
    tokenSymbol,
    decimals,
    settlementAddress,
    historyPage: historyPageValue,
    historyComplete: Boolean(config.history_complete),
    raw: config,
  }
}

function requireString(
  config: Record<string, unknown>,
  key: string
) {
  const value = config[key]

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(
      `Tradeify config.${key} no está configurado`
    )
  }

  return value.trim()
}

function requirePositiveNumber(
  config: Record<string, unknown>,
  key: string
) {
  const value = Number(config[key])

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(
      `Tradeify config.${key} debe ser un entero positivo`
    )
  }

  return value
}

function requireNonNegativeNumber(
  config: Record<string, unknown>,
  key: string
) {
  const value = Number(config[key])

  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      `Tradeify config.${key} debe ser un entero no negativo`
    )
  }

  return value
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function getEtherscanMessage(
  result: EtherscanResponse,
  fallback = ''
) {
  if (typeof result.result === 'string') {
    return result.result
  }

  return result.message || fallback
}
