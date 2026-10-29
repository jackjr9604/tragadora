import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadEnvConfig } from '@next/env'
import { spawn, type ChildProcess } from 'node:child_process'
import { freemem } from 'node:os'
import { evaluateInitialLoadTranslation } from '../lib/translation/initial-load-quality'

type Counts = Record<string, number>
type Candidate = { resource_type: string; field_name: string; source_hash: string; target_language: string; source_value: unknown; draft_value: unknown; sensitivity: string }

loadEnvConfig(process.cwd())
void main().catch((error) => { console.error(`[initial-load] ${safe(error)}`); process.exitCode = 1 })

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const url = required('NEXT_PUBLIC_SUPABASE_URL')
  const key = required('SUPABASE_SERVICE_ROLE_KEY')
  assertDestination(url, args)
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  await rpc(db, 'translation_initial_load_start', { p_run_id: args.runId, p_actor_user_id: args.actorId, p_max_groups: args.maxGroups, p_max_characters: args.maxCharacters })
  let enqueueOpen = true
  const workers = args.noWorkers ? [] : startWorkers(args.workers)
  try {
    for (;;) {
      if (freemem() < args.minFreeMemoryMb * 1024 * 1024) throw new Error(`Memoria libre inferior a ${args.minFreeMemoryMb} MB; ejecución pausada de forma segura.`)
      if (enqueueOpen) {
        const enqueued = await rpc<Record<string, number>>(db, 'translation_initial_load_enqueue', { p_run_id: args.runId, p_limit: 100 })
        enqueueOpen = Number(enqueued.queued ?? 0) + Number(enqueued.reused ?? 0) > 0
      }
      await rpc(db, 'translation_initial_load_refresh', { p_run_id: args.runId })
      const qa = await rpc<Candidate[]>(db, 'translation_initial_load_qa_candidates', { p_run_id: args.runId, p_limit: 100 })
      for (const item of qa) {
        const result = evaluateInitialLoadTranslation({ resourceType: item.resource_type, fieldName: item.field_name, source: item.source_value, draft: item.draft_value })
        await rpc(db, 'translation_initial_load_record_qa', { p_run_id: args.runId, p_resource_type: item.resource_type, p_field_name: item.field_name, p_source_hash: item.source_hash, p_target_language: item.target_language, p_status: result.status, p_codes: result.codes })
      }
      await rpc(db, 'translation_initial_load_fanout', { p_run_id: args.runId, p_group_limit: 10, p_member_limit: 100 })
      const status = await rpc<{ groups: Counts; applied_fields: number; conflicts: number }>(db, 'translation_initial_load_status', { p_run_id: args.runId })
      const counts = status.groups ?? {}
      const total = Object.values(counts).reduce((sum, count) => sum + Number(count), 0)
      const failed = Number(counts.failed ?? 0) + Number(counts.qa_failed ?? 0)
      if (total >= 20 && failed / total > args.maxErrorRate) throw new Error(`Errores ${(failed / total * 100).toFixed(2)}% superiores al límite ${(args.maxErrorRate * 100).toFixed(2)}%.`)
      console.log(`[initial-load] ${JSON.stringify({ groups: counts, appliedFields: status.applied_fields, conflicts: status.conflicts })}`)
      const active = ['queued', 'processing', 'proposal_ready', 'qa_passed', 'qa_review', 'applying'].some((name) => Number(counts[name] ?? 0) > 0)
      if (!enqueueOpen && !active) break
      await wait(args.pollMs)
    }
    const finished = await rpc(db, 'translation_initial_load_finish', { p_run_id: args.runId })
    console.log(`[initial-load] finalizado ${JSON.stringify(finished)}`)
  } finally { stopWorkers(workers) }
}

function parseArgs(argv: string[]) {
  const value = (name: string) => { const index = argv.indexOf(name); return index >= 0 ? argv[index + 1] : undefined }
  const runId = value('--run-id'); const actorId = value('--actor-id')
  if (!runId?.match(/^[0-9a-f-]{36}$/i) || !actorId?.match(/^[0-9a-f-]{36}$/i)) throw new Error('--run-id y --actor-id UUID son obligatorios.')
  return { runId, actorId, execute: argv.includes('--execute'), allowProduction: argv.includes('--allow-production'), confirmProjectRef: value('--confirm-project-ref'), noWorkers: argv.includes('--no-workers'), workers: integer(value('--workers'), 2, 1, 2), maxGroups: integer(value('--max-groups'), 3500, 1, 4000), maxCharacters: integer(value('--max-characters'), 10_000_000, 1, 10_000_000), minFreeMemoryMb: integer(value('--min-free-memory-mb'), 1024, 512, 8192), maxErrorRate: decimal(value('--max-error-rate'), .02, 0, .2), pollMs: integer(value('--poll-ms'), 3000, 1000, 60000) }
}

function assertDestination(urlValue: string, args: ReturnType<typeof parseArgs>) {
  if (!args.execute) throw new Error('Falta --execute; el runner permanece inerte por defecto.')
  const url = new URL(urlValue); const local = ['127.0.0.1', 'localhost'].includes(url.hostname)
  if (local) return
  const projectRef = url.hostname.split('.')[0]
  if (!args.allowProduction || args.confirmProjectRef !== projectRef) throw new Error('Destino remoto bloqueado. Requiere --allow-production y --confirm-project-ref exacto.')
  if (process.env.TRANSLATION_INITIAL_LOAD_APPROVED !== args.runId) throw new Error('TRANSLATION_INITIAL_LOAD_APPROVED debe coincidir exactamente con --run-id.')
}

function startWorkers(count: number) {
  const children: ChildProcess[] = []
  for (let index = 1; index <= count; index += 1) {
    const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/translation-worker.ts'], { cwd: process.cwd(), stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, TRANSLATION_WORKER_ID: `initial-load-${index}`, TRANSLATION_WORKER_BATCH_SIZE: '3', TRANSLATION_WORKER_POLL_MS: '1000' } })
    children.push(child)
  }
  return children
}
function stopWorkers(children: ChildProcess[]) { for (const child of children) if (!child.killed) child.kill('SIGTERM') }
async function rpc<T=unknown>(db: SupabaseClient, name: string, parameters: Record<string, unknown>) { const result = await db.rpc(name, parameters); if (result.error) throw new Error(`${name}: ${result.error.message}`); return result.data as T }
function required(name: string) { const value = process.env[name]?.trim(); if (!value) throw new Error(`Falta ${name}.`); return value }
function integer(value: string | undefined, fallback: number, min: number, max: number) { const number = Number.parseInt(value ?? '', 10); return Number.isInteger(number) && number >= min && number <= max ? number : fallback }
function decimal(value: string | undefined, fallback: number, min: number, max: number) { const number = Number(value); return Number.isFinite(number) && number >= min && number <= max ? number : fallback }
function wait(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)) }
function safe(error: unknown) { return error instanceof Error ? error.message : 'Error inesperado' }
