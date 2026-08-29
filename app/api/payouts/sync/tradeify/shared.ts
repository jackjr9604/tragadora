import { createAdminClient } from '@/lib/supabase/admin'

export const TRADEIFY_SOURCE_NAME =
  'Tradeify RiseUSD - Arbitrum'

const ETHERSCAN_API_URL =
  'https://api.etherscan.io/v2/api'
const ZERO_ADDRESS =
  '0x0000000000000000000000000000000000000000'
const PAGE_SIZE = 100
const BLOCK_RESULT_LIMIT = 10_000
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
  historyStartBlock: number | null
  historyLastBlock: number | null
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

export type PayoutBlockRangeResult = {
  payouts: BlockchainPayout[]
  transactionCount: number
  requestCount: number
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

export async function getTradeifyCurrentBlock(
  config: TradeifyConfig
) {
  const result = await requestEtherscan(new URLSearchParams({
    chainid: String(config.chainId),
    module: 'proxy',
    action: 'eth_blockNumber',
  }))
  if (result === 'window-too-large') {
    throw new Error('Respuesta inesperada consultando el bloque actual')
  }
  const block = typeof result.result === 'string'
    ? Number.parseInt(result.result, 16)
    : Number.NaN

  if (!Number.isSafeInteger(block) || block < 0) {
    throw new Error('Etherscan no devolvió un bloque actual válido')
  }

  return block
}

export async function getTradeifyFirstTransferBlock({
  config,
  currentBlock,
}: {
  config: TradeifyConfig
  currentBlock: number
}) {
  const result = await requestEtherscan(new URLSearchParams({
    chainid: String(config.chainId),
    module: 'account',
    action: 'tokentx',
    contractaddress: config.tokenAddress,
    address: config.settlementAddress,
    startblock: '0',
    endblock: String(currentBlock),
    page: '1',
    offset: '1',
    sort: 'asc',
  }), true)
  if (result === 'window-too-large') {
    throw new Error('Respuesta inesperada consultando el primer bloque')
  }
  const transactions = getTokenTransfers(result)

  if (transactions.length === 0) {
    return null
  }

  const block = Number(transactions[0].blockNumber)
  if (!Number.isSafeInteger(block) || block < 0) {
    throw new Error('Etherscan no devolvió un bloque inicial válido')
  }

  return block
}

export async function getTradeifyPayoutBlockRange({
  config,
  startBlock,
  endBlock,
}: {
  config: TradeifyConfig
  startBlock: number
  endBlock: number
}): Promise<PayoutBlockRangeResult> {
  if (startBlock > endBlock) {
    return { payouts: [], transactionCount: 0, requestCount: 0 }
  }

  const result = await requestEtherscan(new URLSearchParams({
    chainid: String(config.chainId),
    module: 'account',
    action: 'tokentx',
    contractaddress: config.tokenAddress,
    address: config.settlementAddress,
    startblock: String(startBlock),
    endblock: String(endBlock),
    page: '1',
    offset: String(BLOCK_RESULT_LIMIT),
    sort: 'asc',
  }), true, true)

  if (result === 'window-too-large') {
    return splitBlockRange({ config, startBlock, endBlock })
  }

  const transactions = getTokenTransfers(result)
  if (transactions.length >= BLOCK_RESULT_LIMIT) {
    return splitBlockRange({ config, startBlock, endBlock })
  }

  return {
    payouts: mapTradeifyPayouts(transactions, config),
    transactionCount: transactions.length,
    requestCount: 1,
  }
}

async function splitBlockRange({
  config,
  startBlock,
  endBlock,
}: {
  config: TradeifyConfig
  startBlock: number
  endBlock: number
}): Promise<PayoutBlockRangeResult> {
  if (startBlock === endBlock) {
    throw new Error(
      `El bloque ${startBlock} contiene al menos ${BLOCK_RESULT_LIMIT} transferencias y no puede subdividirse más`
    )
  }

  const middleBlock = Math.floor((startBlock + endBlock) / 2)
  await delay(400)
  const left = await getTradeifyPayoutBlockRange({
    config,
    startBlock,
    endBlock: middleBlock,
  })
  await delay(400)
  const right = await getTradeifyPayoutBlockRange({
    config,
    startBlock: middleBlock + 1,
    endBlock,
  })

  return {
    payouts: [...left.payouts, ...right.payouts],
    transactionCount:
      left.transactionCount + right.transactionCount,
    requestCount: left.requestCount + right.requestCount + 1,
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

async function requestEtherscan(
  searchParams: URLSearchParams,
  validateTokenTransfers = false,
  allowWindowSplit = false
): Promise<EtherscanResponse | 'window-too-large'> {
  const apiKey = process.env.ETHERSCAN_API_KEY
  if (!apiKey) {
    throw new Error('ETHERSCAN_API_KEY no configurada')
  }

  searchParams.set('apikey', apiKey)
  const url = `${ETHERSCAN_API_URL}?${searchParams.toString()}`
  let result: EtherscanResponse = {}

  for (let attempt = 0; attempt < MAX_RATE_LIMIT_RETRIES; attempt++) {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) {
      if (attempt === MAX_RATE_LIMIT_RETRIES - 1) {
        throw new Error(`Etherscan respondió HTTP ${response.status}`)
      }
      await delay(1_000 * (attempt + 1))
      continue
    }

    result = await response.json() as EtherscanResponse
    const message = getEtherscanMessage(result).toLowerCase()
    if (allowWindowSplit && isWindowTooLargeMessage(message)) {
      return 'window-too-large'
    }
    if (!message.includes('rate limit')) break
    if (attempt === MAX_RATE_LIMIT_RETRIES - 1) {
      throw new Error('Etherscan rate limit alcanzado después de 3 reintentos')
    }
    await delay(1_000 * (attempt + 1))
  }

  if (validateTokenTransfers) {
    const message = getEtherscanMessage(result).toLowerCase()
    const noTransactions = message.includes('no transactions')
    if (result.status !== '1' && !noTransactions) {
      throw new Error(getEtherscanMessage(result, 'Error consultando RiseUSD para Tradeify'))
    }
  }

  return result
}

function isWindowTooLargeMessage(message: string) {
  return (
    message.includes('result window is too large') ||
    message.includes('pageno x offset') ||
    message.includes('page no x offset') ||
    message.includes('query timeout') ||
    message.includes('smaller result dataset') ||
    message.includes('more than 10000')
  )
}

function getTokenTransfers(result: EtherscanResponse) {
  return Array.isArray(result.result)
    ? result.result as EtherscanTokenTransfer[]
    : []
}

function mapTradeifyPayouts(
  transactions: EtherscanTokenTransfer[],
  config: TradeifyConfig
) {
  const divisor = Math.pow(10, config.decimals)
  return transactions
    .filter((transaction) => (
      transaction.from?.toLowerCase() === config.settlementAddress.toLowerCase() &&
      transaction.to?.toLowerCase() === ZERO_ADDRESS
    ))
    .map((transaction) => ({
      hash: transaction.hash,
      block: Number(transaction.blockNumber),
      date: new Date(Number(transaction.timeStamp) * 1_000).toISOString(),
      recipient: ZERO_ADDRESS,
      amountRaw: transaction.value,
      amount: Number(transaction.value) / divisor,
    }))
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
  const historyStartBlock = optionalNonNegativeInteger(
    config.history_start_block,
    'history_start_block'
  )
  const historyLastBlock = optionalNonNegativeInteger(
    config.history_last_block,
    'history_last_block'
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
    historyStartBlock,
    historyLastBlock,
    historyComplete: Boolean(config.history_complete),
    raw: config,
  }
}

function optionalNonNegativeInteger(
  value: unknown,
  key: string
) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`Tradeify config.${key} debe ser un entero no negativo`)
  }

  return number
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
