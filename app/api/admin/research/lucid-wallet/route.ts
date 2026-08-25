import { NextResponse } from 'next/server'

const ETHERSCAN_API_URL =
  'https://api.etherscan.io/v2/api'
const ARBITRUM_CHAIN_ID = '42161'
const RISEUSD_ADDRESS =
  '0xace876e867ecf2c3d1b8097b160a666adce04cd0'
const ZERO_ADDRESS =
  '0x0000000000000000000000000000000000000000'
const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const TOKEN_DECIMALS = 6
const LOGS_PER_PAGE = 1_000
const BLOCK_RANGE_CHUNKS = 12
const MAX_PAGES_PER_CHUNK = 10
const REQUEST_DELAY_MS = 400
const MAX_RETRIES = 3

const REFERENCE_GROUPS = {
  A: [2_000, 2_000, 2_000, 2_000, 3_000, 3_000],
  B: [951, 2_007, 2_000, 1_179, 2_062, 10_304],
} as const

const REFERENCE_AMOUNTS = [
  ...REFERENCE_GROUPS.A,
  ...REFERENCE_GROUPS.B,
]
const REFERENCE_RAW_AMOUNTS = new Set(
  REFERENCE_AMOUNTS.map((amount) =>
    BigInt(amount) *
      BigInt(10) ** BigInt(TOKEN_DECIMALS)
  )
)

type EtherscanResponse = {
  status?: string
  message?: string
  result?: unknown
}

type EtherscanLog = {
  address: string
  topics: string[]
  data: string
  blockNumber: string
  timeStamp: string
  transactionHash: string
  logIndex?: string
}

type MatchingMovement = {
  transactionHash: string
  blockNumber: number
  timestamp: string
  from: string
  to: string
  amount: number
  amountRaw: string
  token: string
  movementType: 'burn' | 'mint' | 'transfer'
  logIndex: number | null
}

type CandidateAccumulator = {
  address: string
  transactions: MatchingMovement[]
}

export const maxDuration = 60

export async function GET(request: Request) {
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
      { status: 401 }
    )
  }

  const apiKey = process.env.ETHERSCAN_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'ETHERSCAN_API_KEY no configurada',
      },
      { status: 500 }
    )
  }

  try {
    // La fecha pública es aproximada: se analiza el día anterior,
    // el 22 de agosto completo y el día posterior, todo en UTC.
    const windowStart = '2026-08-21T00:00:00.000Z'
    const windowEnd = '2026-08-24T00:00:00.000Z'
    const startTimestamp = Math.floor(
      new Date(windowStart).getTime() / 1_000
    )
    const endTimestamp = Math.floor(
      new Date(windowEnd).getTime() / 1_000
    ) - 1
    const requestState = { calls: 0 }

    const fromBlock = await getBlockByTimestamp({
      apiKey,
      timestamp: startTimestamp,
      closest: 'after',
      requestState,
    })
    const toBlock = await getBlockByTimestamp({
      apiKey,
      timestamp: endTimestamp,
      closest: 'before',
      requestState,
    })
    const {
      logs,
      truncated,
      pagesRead,
      chunksRead,
      truncatedChunks,
    } =
      await getTransferLogs({
        apiKey,
        fromBlock,
        toBlock,
        requestState,
      })

    const matchingMovements = logs
      .map(decodeTransferLog)
      .filter(
        (movement): movement is MatchingMovement =>
          movement !== null &&
          REFERENCE_RAW_AMOUNTS.has(
            BigInt(movement.amountRaw)
          )
      )
    const grouped = new Map<
      string,
      CandidateAccumulator
    >()

    for (const movement of matchingMovements) {
      const key = movement.from.toLowerCase()
      const candidate = grouped.get(key) ?? {
        address: key,
        transactions: [],
      }

      candidate.transactions.push(movement)
      grouped.set(key, candidate)
    }

    const candidates = Array.from(grouped.values())
      .map((candidate) => {
        const transactions = [...candidate.transactions]
          .sort(
            (left, right) =>
              left.timestamp.localeCompare(right.timestamp)
          )
        const hashes = Array.from(
          new Set(
            transactions.map(
              (transaction) =>
                transaction.transactionHash
            )
          )
        )

        return {
          address: candidate.address,
          matches: transactions.length,
          amounts: transactions.map(
            (transaction) => transaction.amount
          ),
          hashes,
          firstMatch: transactions[0]?.timestamp ?? null,
          lastMatch:
            transactions.at(-1)?.timestamp ?? null,
          movementTypes: {
            burns: transactions.filter(
              (transaction) =>
                transaction.movementType === 'burn'
            ).length,
            transfers: transactions.filter(
              (transaction) =>
                transaction.movementType === 'transfer'
            ).length,
            mints: transactions.filter(
              (transaction) =>
                transaction.movementType === 'mint'
            ).length,
          },
          transactions,
        }
      })
      .sort((left, right) => right.matches - left.matches)

    return NextResponse.json({
      success: true,
      researchOnly: true,
      target: 'Lucid Trading',
      date: '2026-08-22',
      network: 'Arbitrum',
      chainId: Number(ARBITRUM_CHAIN_ID),
      token: {
        symbol: 'RiseUSD',
        address: RISEUSD_ADDRESS,
        decimals: TOKEN_DECIMALS,
      },
      referenceGroups: REFERENCE_GROUPS,
      searchWindow: {
        from: windowStart,
        toExclusive: windowEnd,
        fromBlock,
        toBlock,
      },
      scan: {
        strategy: 'ERC-20 Transfer event logs',
        logsRead: logs.length,
        pagesRead,
        chunksRead,
        configuredChunks: BLOCK_RANGE_CHUNKS,
        maxPagesPerChunk: MAX_PAGES_PER_CHUNK,
        maxPages:
          BLOCK_RANGE_CHUNKS * MAX_PAGES_PER_CHUNK,
        truncatedChunks,
        truncated,
        apiCalls: requestState.calls,
      },
      matchingTransfers: matchingMovements.length,
      candidates,
      warning: truncated
        ? 'El límite de seguridad fue alcanzado; los candidatos pueden estar incompletos.'
        : null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        researchOnly: true,
        target: 'Lucid Trading',
        error: getErrorMessage(error),
      },
      { status: 500 }
    )
  }
}

async function getBlockByTimestamp({
  apiKey,
  timestamp,
  closest,
  requestState,
}: {
  apiKey: string
  timestamp: number
  closest: 'before' | 'after'
  requestState: { calls: number }
}) {
  const result = await etherscanRequest({
    apiKey,
    requestState,
    parameters: {
      module: 'block',
      action: 'getblocknobytime',
      timestamp: String(timestamp),
      closest,
    },
  })

  if (
    result.status !== '1' ||
    typeof result.result !== 'string'
  ) {
    throw new Error(
      getEtherscanError(
        result,
        'No se pudo resolver el bloque por timestamp'
      )
    )
  }

  const block = Number(result.result)

  if (!Number.isSafeInteger(block)) {
    throw new Error('Etherscan devolvió un bloque inválido')
  }

  return block
}

async function getTransferLogs({
  apiKey,
  fromBlock,
  toBlock,
  requestState,
}: {
  apiKey: string
  fromBlock: number
  toBlock: number
  requestState: { calls: number }
}) {
  const logs: EtherscanLog[] = []
  let pagesRead = 0
  let chunksRead = 0
  const truncatedChunks: Array<{
    fromBlock: number
    toBlock: number
  }> = []
  const totalBlocks = toBlock - fromBlock + 1
  const chunkSize = Math.ceil(
    totalBlocks / BLOCK_RANGE_CHUNKS
  )

  for (
    let chunkStart = fromBlock;
    chunkStart <= toBlock;
    chunkStart += chunkSize
  ) {
    const chunkEnd = Math.min(
      toBlock,
      chunkStart + chunkSize - 1
    )

    chunksRead++

    for (
      let page = 1;
      page <= MAX_PAGES_PER_CHUNK;
      page++
    ) {
      const result = await etherscanRequest({
        apiKey,
        requestState,
        parameters: {
          module: 'logs',
          action: 'getLogs',
          fromBlock: String(chunkStart),
          toBlock: String(chunkEnd),
          address: RISEUSD_ADDRESS,
          topic0: TRANSFER_TOPIC,
          page: String(page),
          offset: String(LOGS_PER_PAGE),
        },
      })
      const noRecords = getEtherscanError(result, '')
        .toLowerCase()
        .includes('no records')

      if (result.status !== '1' && !noRecords) {
        throw new Error(
          getEtherscanError(
            result,
            'Error consultando logs de RiseUSD'
          )
        )
      }

      const pageLogs = Array.isArray(result.result)
        ? result.result as EtherscanLog[]
        : []

      pagesRead++
      logs.push(...pageLogs)

      if (pageLogs.length < LOGS_PER_PAGE) {
        break
      }

      if (page === MAX_PAGES_PER_CHUNK) {
        truncatedChunks.push({
          fromBlock: chunkStart,
          toBlock: chunkEnd,
        })
      }
    }
  }

  return {
    logs,
    pagesRead,
    chunksRead,
    truncatedChunks,
    truncated: truncatedChunks.length > 0,
  }
}

async function etherscanRequest({
  apiKey,
  parameters,
  requestState,
}: {
  apiKey: string
  parameters: Record<string, string>
  requestState: { calls: number }
}): Promise<EtherscanResponse> {
  const searchParams = new URLSearchParams({
    chainid: ARBITRUM_CHAIN_ID,
    apikey: apiKey,
    ...parameters,
  })

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (requestState.calls > 0) {
      await delay(REQUEST_DELAY_MS)
    }

    requestState.calls++
    const response = await fetch(
      `${ETHERSCAN_API_URL}?${searchParams.toString()}`,
      { cache: 'no-store' }
    )

    if (!response.ok) {
      if (attempt === MAX_RETRIES - 1) {
        throw new Error(
          `Etherscan respondió HTTP ${response.status}`
        )
      }

      await delay(1_000 * (attempt + 1))
      continue
    }

    const result =
      await response.json() as EtherscanResponse
    const message = getEtherscanError(result, '')
      .toLowerCase()

    if (!message.includes('rate limit')) {
      return result
    }

    if (attempt === MAX_RETRIES - 1) {
      throw new Error(
        'Etherscan rate limit alcanzado después de 3 reintentos'
      )
    }

    await delay(1_000 * (attempt + 1))
  }

  throw new Error('No se pudo completar la consulta a Etherscan')
}

function decodeTransferLog(
  log: EtherscanLog
): MatchingMovement | null {
  if (
    log.address.toLowerCase() !==
      RISEUSD_ADDRESS.toLowerCase() ||
    log.topics.length < 3 ||
    log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC
  ) {
    return null
  }

  const from = topicToAddress(log.topics[1])
  const to = topicToAddress(log.topics[2])

  if (!from || !to) {
    return null
  }

  try {
    const amountRaw = BigInt(log.data)
    const divisor = 10 ** TOKEN_DECIMALS
    const amount = Number(amountRaw) / divisor

    return {
      transactionHash: log.transactionHash,
      blockNumber: parseNumericValue(log.blockNumber),
      timestamp: new Date(
        parseNumericValue(log.timeStamp) * 1_000
      ).toISOString(),
      from,
      to,
      amount,
      amountRaw: amountRaw.toString(),
      token: RISEUSD_ADDRESS,
      movementType:
        to === ZERO_ADDRESS
          ? 'burn'
          : from === ZERO_ADDRESS
            ? 'mint'
            : 'transfer',
      logIndex: log.logIndex
        ? parseNumericValue(log.logIndex)
        : null,
    }
  } catch {
    return null
  }
}

function topicToAddress(topic: string | undefined) {
  if (!topic || !/^0x[0-9a-fA-F]{64}$/.test(topic)) {
    return null
  }

  return `0x${topic.slice(-40)}`.toLowerCase()
}

function parseNumericValue(value: string) {
  return Number.parseInt(
    value,
    value.startsWith('0x') ? 16 : 10
  )
}

function getEtherscanError(
  result: EtherscanResponse,
  fallback: string
) {
  if (typeof result.result === 'string') {
    return result.result
  }

  return result.message || fallback
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : String(error)
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}
