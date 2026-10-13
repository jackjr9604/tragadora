import { createClient } from '@supabase/supabase-js'
import { loadEnvConfig } from '@next/env'
import { randomUUID } from 'node:crypto'
import { LibreTranslateLocalProvider, translateLocally } from '../lib/translation/ai-provider'

type TranslationJob = {
  id: string
  source_language: string
  target_language: string
  attempt_count: number
  max_attempts: number
}

loadEnvConfig(process.cwd())
const config = loadConfig()
const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
const provider = new LibreTranslateLocalProvider(config.libreTranslateUrl, config.libreTranslateApiKey)
const workerId = process.env.TRANSLATION_WORKER_ID?.trim() || `windows-${randomUUID()}`
let stopping = false

process.on('SIGINT', () => { stopping = true })
process.on('SIGTERM', () => { stopping = true })

do {
  const processed = await runCycle()
  if (config.runOnce || stopping) break
  if (!processed) await wait(config.pollMs)
} while (!stopping)

async function runCycle() {
  const claim = await supabase.rpc('translation_claim_ai_jobs', {
    p_worker_id: workerId, p_limit: config.batchSize, p_lease_seconds: config.leaseSeconds,
  })
  if (claim.error) throw new Error(`No se pudo reclamar la cola: ${claim.error.message}`)
  const jobs = (claim.data ?? []) as TranslationJob[]
  for (const job of jobs) await processJob(job)
  if (jobs.length) console.log(`[translation-worker] procesados ${jobs.length} trabajo(s)`) // Nunca imprime contenido.
  return jobs.length
}

async function processJob(job: TranslationJob) {
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
    const retry = isRetryable(error) && job.attempt_count < job.max_attempts
    const failed = await supabase.rpc('translation_fail_ai_job', {
      p_job_id: job.id, p_worker_id: workerId, p_error_code: retry ? 'local_provider_unavailable' : 'translation_failed',
      p_error: message, p_retry: retry,
    })
    if (failed.error) console.error(`[translation-worker] no se pudo registrar fallo de ${job.id}: ${failed.error.message}`)
    else console.warn(`[translation-worker] ${job.id}: ${retry ? 'reintento pendiente' : 'fallido'}`)
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
    runOnce: process.argv.includes('--once'),
  }
}
function required(name: string) { const value=process.env[name]?.trim(); if (!value) throw new Error(`Falta ${name}.`); return value }
function integer(name: string,fallback: number,min: number,max: number) { const value=Number.parseInt(process.env[name] ?? '',10); return Number.isInteger(value) ? Math.min(max,Math.max(min,value)) : fallback }
function normalizeValue(value: unknown) { if (typeof value === 'string' && value.trim()) return value; if (Array.isArray(value) && value.length && value.every((item)=>typeof item==='string' && item.trim())) return value as string[]; throw new Error('La fuente no tiene un formato traducible.') }
function safeError(error: unknown) {
  return (error instanceof Error ? error.message : 'Error local de traducción')
    .replace(/eyJ[A-Za-z0-9._-]+/g, '[credential]')
    .replace(/https?:\/\/[^\s]+/gi, '[local-endpoint]')
    .replace(/(api[_-]?key|authorization|token)\s*[:=]\s*\S+/gi, '$1=[credential]')
    .slice(0, 1000)
}
function isRetryable(error: unknown) { const message=error instanceof Error ? `${error.name} ${error.message}` : ''; return /fetch|timeout|abort|connect|network|LibreTranslate|ECONN/i.test(message) }
function wait(ms: number) { return new Promise((resolve)=>setTimeout(resolve,ms)) }
