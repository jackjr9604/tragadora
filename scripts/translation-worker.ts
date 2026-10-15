import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadEnvConfig } from '@next/env'
import { randomUUID } from 'node:crypto'
import { LibreTranslateLocalProvider, translateLocally } from '../lib/translation/ai-provider'
import { isLocalProviderUnavailable, prepareLocalTranslationWorker, reportTranslationWorkerHeartbeat, safeWorkerError, type WorkerHeartbeatStatus } from '../lib/translation/worker-runtime'

type TranslationJob = {
  id: string
  source_language: string
  target_language: string
  attempt_count: number
  max_attempts: number
}

type WorkerContext = {
  config: ReturnType<typeof loadConfig>
  supabase: SupabaseClient
  provider: LibreTranslateLocalProvider
  workerId: string
}

void main().catch((error) => {
  console.error(`[translation-worker] inicio fallido: ${safeError(error)}`)
  process.exitCode = 1
})

async function main() {
  loadEnvConfig(process.cwd())
  const config = loadConfig()
  const context: WorkerContext = {
    config,
    supabase: createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    provider: new LibreTranslateLocalProvider(config.libreTranslateUrl, config.libreTranslateApiKey),
    workerId: process.env.TRANSLATION_WORKER_ID?.trim() || `windows-${randomUUID()}`,
  }
  const startedAt = new Date().toISOString()
  let stopping = false
  const stop = () => { stopping = true }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  let heartbeat: { status: WorkerHeartbeatStatus; supportedCodes: string[]; providerCheckedAt: string | null; lastErrorCode: string | null } | null = null
  let lastSupportedCodes: string[] = []
  let heartbeatSending = false
  const sendHeartbeat = async () => {
    if (!heartbeat || heartbeatSending) return
    heartbeatSending = true
    try {
      const result = await reportTranslationWorkerHeartbeat({ client: context.supabase, workerId: context.workerId, startedAt, ...heartbeat })
      if (!result.ok) console.warn(`[translation-worker] heartbeat no enviado: ${result.error}`)
    } finally { heartbeatSending = false }
  }
  const heartbeatTimer = setInterval(() => { void sendHeartbeat() }, config.heartbeatMs)
  try {
    do {
      const readiness = await prepareLocalTranslationWorker({ client: context.supabase, provider: context.provider,
        recoveryLimit: config.recoveryBatchSize })
      const providerCheckedAt = new Date().toISOString()
      if (!readiness.ready) {
        const shouldReportNow = heartbeat?.status !== 'degraded' || config.runOnce
        heartbeat = { status: 'degraded', supportedCodes: lastSupportedCodes, providerCheckedAt,
          lastErrorCode: isLocalProviderUnavailable(new Error(readiness.reason)) ? 'local_provider_unavailable' : 'worker_readiness_failed' }
        if (shouldReportNow) await sendHeartbeat()
        console.warn(`[translation-worker] LibreTranslate no disponible; la cola permanece pendiente: ${readiness.reason}`)
        if (config.runOnce || stopping) break
        await wait(config.pollMs)
        continue
      }
      const shouldReportNow = heartbeat?.status !== 'ready' || config.runOnce
      lastSupportedCodes = readiness.supportedCodes
      heartbeat = { status: 'ready', supportedCodes: readiness.supportedCodes, providerCheckedAt, lastErrorCode: null }
      if (shouldReportNow) await sendHeartbeat()
      if (readiness.recoveredJobs) console.log(`[translation-worker] recuperados ${readiness.recoveredJobs} trabajo(s) locales elegibles`)
      const processed = await runCycle(context, readiness.supportedCodes)
      if (config.runOnce || stopping) break
      if (!processed) await wait(config.pollMs)
    } while (!stopping)
  } finally {
    clearInterval(heartbeatTimer)
    if (heartbeat) {
      heartbeat = { ...heartbeat, status: 'stopping' }
      await sendHeartbeat()
    }
    process.off('SIGINT', stop)
    process.off('SIGTERM', stop)
  }
}

async function runCycle({ config, supabase, provider, workerId }: WorkerContext, supportedCodes: string[]) {
  const claim = await supabase.rpc('translation_claim_ready_ai_jobs', {
    p_worker_id: workerId, p_supported_codes: supportedCodes, p_limit: config.batchSize, p_lease_seconds: config.leaseSeconds,
  })
  if (claim.error) throw new Error(`No se pudo reclamar la cola: ${claim.error.message}`)
  const jobs = (claim.data ?? []) as TranslationJob[]
  for (const job of jobs) await processJob(job, { config, supabase, provider, workerId })
  if (jobs.length) console.log(`[translation-worker] procesados ${jobs.length} trabajo(s)`) // Nunca imprime contenido.
  return jobs.length
}

async function processJob(job: TranslationJob, { config, supabase, provider, workerId }: WorkerContext) {
  try {
    const source = await supabase.rpc('translation_read_ai_job_source', { p_job_id: job.id, p_worker_id: workerId })
    if (source.error) throw new Error(source.error.message)
    const value = normalizeValue(source.data)
    const result = await translateLocally({ value, sourceLanguage: job.source_language, targetLanguage: job.target_language }, provider, config.timeoutMs)
    const completion = await supabase.rpc('translation_complete_ai_job', {
      p_job_id: job.id, p_worker_id: workerId, p_draft_value: result.value, p_model: result.model,
      p_usage: { output_characters: result.usage.outputCharacters, input_tokens: result.usage.inputTokens,
        output_tokens: result.usage.outputTokens, estimated_cost_usd: 0 },
    })
    if (completion.error) throw new Error(completion.error.message)
  } catch (error) {
    const message = safeError(error)
    if (isLocalProviderUnavailable(error)) {
      const released = await supabase.rpc('translation_release_ai_job_provider_unavailable', {
        p_job_id: job.id, p_worker_id: workerId, p_error: message,
      })
      if (released.error) console.error(`[translation-worker] no se pudo devolver ${job.id} a la cola: ${released.error.message}`)
      else console.warn(`[translation-worker] ${job.id}: proveedor local no disponible; intento conservado`)
      return
    }
    const failed = await supabase.rpc('translation_fail_ai_job', {
      p_job_id: job.id, p_worker_id: workerId, p_error_code: 'translation_failed',
      p_error: message, p_retry: false,
    })
    if (failed.error) console.error(`[translation-worker] no se pudo registrar fallo de ${job.id}: ${failed.error.message}`)
    else console.warn(`[translation-worker] ${job.id}: fallido`)
  }
}

function loadConfig() {
  const supabaseUrl = required('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY')
  const libreTranslateUrl = required('LIBRETRANSLATE_URL')
  return {
    supabaseUrl, serviceRoleKey, libreTranslateUrl,
    libreTranslateApiKey: process.env.LIBRETRANSLATE_API_KEY,
    pollMs: integer('TRANSLATION_WORKER_POLL_MS', 5_000, 1_000, 60_000),
    batchSize: integer('TRANSLATION_WORKER_BATCH_SIZE', 5, 1, 20),
    leaseSeconds: integer('TRANSLATION_WORKER_LEASE_SECONDS', 120, 30, 300),
    timeoutMs: integer('TRANSLATION_WORKER_TIMEOUT_MS', 60_000, 5_000, 240_000),
    recoveryBatchSize: integer('TRANSLATION_WORKER_RECOVERY_BATCH_SIZE', 50, 1, 100),
    heartbeatMs: integer('TRANSLATION_WORKER_HEARTBEAT_MS', 45_000, 15_000, 60_000),
    runOnce: process.argv.includes('--once'),
  }
}
function required(name: string) { const value=process.env[name]?.trim(); if (!value) throw new Error(`Falta ${name}.`); return value }
function integer(name: string,fallback: number,min: number,max: number) { const value=Number.parseInt(process.env[name] ?? '',10); return Number.isInteger(value) ? Math.min(max,Math.max(min,value)) : fallback }
function normalizeValue(value: unknown) { if (typeof value === 'string' && value.trim()) return value; if (Array.isArray(value) && value.length && value.every((item)=>typeof item==='string' && item.trim())) return value as string[]; throw new Error('La fuente no tiene un formato traducible.') }
const safeError = safeWorkerError
function wait(ms: number) { return new Promise((resolve)=>setTimeout(resolve,ms)) }
