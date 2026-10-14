export type WorkerRpcResult<T=unknown> = { data: T; error: { code?: string; message: string } | null }
export type WorkerRpcClient = { rpc(name: string, params: Record<string, unknown>): PromiseLike<WorkerRpcResult> }
export type LanguageCapabilityProvider = { supportedLanguages(signal?: AbortSignal): Promise<string[]> }

export type WorkerReadiness =
  | { ready: true; supportedCodes: string[]; recoveredJobs: number }
  | { ready: false; reason: string }

export async function prepareLocalTranslationWorker(input: {
  client: WorkerRpcClient
  provider: LanguageCapabilityProvider
  recoveryLimit: number
  timeoutMs?: number
}): Promise<WorkerReadiness> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 10_000)
  let supportedCodes: string[]
  try {
    supportedCodes = normalizeLanguageCodes(await input.provider.supportedLanguages(controller.signal))
    if (!supportedCodes.length) return { ready: false, reason: 'LibreTranslate no informó idiomas compatibles.' }
  } catch (error) {
    return { ready: false, reason: safeWorkerError(error) }
  } finally {
    clearTimeout(timeout)
  }

  const report = await input.client.rpc('translation_worker_report_languages', { p_supported_codes: supportedCodes })
  if (report.error) return { ready: false, reason: `No se pudo registrar compatibilidad: ${report.error.message}` }
  const recovery = await input.client.rpc('translation_recover_local_provider_jobs', { p_limit: input.recoveryLimit })
  if (recovery.error) return { ready: false, reason: `No se pudo recuperar la cola local: ${recovery.error.message}` }
  return { ready: true, supportedCodes, recoveredJobs: Array.isArray(recovery.data) ? recovery.data.length : 0 }
}

export function normalizeLanguageCodes(codes: string[]) {
  return [...new Set(codes.map((code) => code.trim().toLowerCase()).filter((code) => /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(code)))].sort()
}

export function isLocalProviderUnavailable(error: unknown) {
  const message = error instanceof Error ? `${error.name} ${error.message}` : ''
  return /fetch|timeout|abort|connect|network|LibreTranslate|ECONN|ENOTFOUND|EHOSTUNREACH/i.test(message)
}

export function safeWorkerError(error: unknown) {
  return (error instanceof Error ? error.message : 'Error local de traducción')
    .replace(/eyJ[A-Za-z0-9._-]+/g, '[credential]')
    .replace(/https?:\/\/[^\s]+/gi, '[local-endpoint]')
    .replace(/(api[_-]?key|authorization|token)\s*[:=]\s*\S+/gi, '$1=[credential]')
    .slice(0, 1000)
}
