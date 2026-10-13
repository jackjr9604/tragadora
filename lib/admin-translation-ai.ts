import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { countValueCharacters, type TranslatableValue } from '@/lib/translation/ai-content'

type Job = { id: string; status: string }

export function publicAiEngineStatus() {
  const enabled = process.env.TRANSLATION_LOCAL_QUEUE_ENABLED === 'true'
  return {
    enabled,
    provider: 'LibreTranslate local',
    message: enabled
      ? 'La solicitud quedará en cola hasta que el worker local esté disponible.'
      : 'La cola local está desactivada en este entorno.',
  }
}

export async function requestIndividualAiDraft(args: {
  stateId: string
  expectedLockVersion: number
  sourceValue: unknown
  force?: boolean
}) {
  if (process.env.TRANSLATION_LOCAL_QUEUE_ENABLED !== 'true') {
    throw new Error('La cola de traducción local está desactivada.')
  }
  const value = normalizeSource(args.sourceValue)
  const limits = queueLimits()
  const session = await createClient()
  const request = await session.rpc('translation_request_ai_draft', {
    p_state_id: args.stateId,
    p_expected_lock_version: args.expectedLockVersion,
    p_input_characters: countValueCharacters(value),
    p_max_attempts: limits.maxAttempts,
    p_daily_request_limit: limits.dailyRequestLimit,
    p_daily_character_limit: limits.dailyCharacterLimit,
    p_force: Boolean(args.force),
  })
  if (request.error) throw new Error(request.error.message)
  const job = normalizeRpcRow<Job>(request.data)
  if (!job?.id) throw new Error('No se pudo crear el trabajo de traducción.')
  return { jobId: job.id, reused: job.status !== 'queued', status: job.status }
}

function normalizeSource(value: unknown): TranslatableValue {
  if (typeof value === 'string' && value.trim()) return value
  if (Array.isArray(value) && value.length && value.every((item) => typeof item === 'string' && item.trim())) return value as string[]
  throw new Error('El texto fuente está vacío o tiene un formato no compatible.')
}

function queueLimits() {
  return {
    maxAttempts: integerEnv('TRANSLATION_LOCAL_MAX_ATTEMPTS', 3, 1, 5),
    dailyRequestLimit: integerEnv('TRANSLATION_LOCAL_MAX_DAILY_REQUESTS', 20, 1, 100),
    dailyCharacterLimit: integerEnv('TRANSLATION_LOCAL_MAX_DAILY_INPUT_CHARACTERS', 100_000, 100, 1_000_000),
  }
}
function normalizeRpcRow<T>(data: unknown): T | null { return (Array.isArray(data) ? data[0] : data) as T | null }
function integerEnv(name: string, fallback: number, min: number, max: number) { const value=Number.parseInt(process.env[name] ?? '',10); return Number.isInteger(value) ? Math.min(max,Math.max(min,value)) : fallback }
