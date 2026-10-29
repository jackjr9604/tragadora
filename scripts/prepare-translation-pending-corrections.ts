import { readFileSync, writeFileSync } from 'node:fs'
import { evaluateInitialLoadTranslation } from '../lib/translation/initial-load-quality'

const inputPath = process.env.TRANSLATION_PENDING_REPORT?.trim()
const outputPath = process.env.TRANSLATION_CORRECTIONS_REPORT?.trim()
if (!inputPath || !outputPath) throw new Error('Faltan rutas temporales de diagnóstico/correcciones')
const resolvedInputPath: string = inputPath
const resolvedOutputPath: string = outputPath

void main().catch((error) => { console.error(error instanceof Error ? error.message : 'Error inesperado'); process.exitCode = 1 })

async function main() {
  const report = JSON.parse(readFileSync(resolvedInputPath, 'utf8')) as { details: Pending[] }
  const corrections = []
  for (const [index, item] of report.details.entries()) {
    const sourceLanguage = await detect(textOf(item.source_value))
    const candidate = curatedOverride(item.source_hash, item.target_language) ?? await translateValue(item.source_value, sourceLanguage, item.target_language)
    const repaired = repairValue(item.source_value, candidate)
    const qa = evaluateInitialLoadTranslation({ resourceType: item.resource_type, fieldName: item.field_name, source: item.source_value, draft: repaired })
    corrections.push({ ...item, detected_source_language: sourceLanguage, corrected_value: repaired, corrected_qa: qa })
    if ((index + 1) % 20 === 0) console.error(`[prepare-corrections] ${index + 1}/${report.details.length}`)
  }
  const result = { groups: corrections.length, fields: corrections.reduce((sum, item) => sum + item.resource_count, 0), byQa: countBy(corrections, (item) => item.corrected_qa.status), byCode: countBy(corrections.flatMap((item) => item.corrected_qa.codes.length ? item.corrected_qa.codes : ['none']), (code) => code), corrections }
  writeFileSync(resolvedOutputPath, JSON.stringify(result, null, 2), { encoding: 'utf8', flag: 'w' })
  console.log(JSON.stringify({ ...result, corrections: undefined, outputPath: resolvedOutputPath }))
}

async function detect(value: string) {
  const response = await fetch('http://127.0.0.1:5000/detect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q: value.slice(0, 5000) }) })
  if (!response.ok) throw new Error(`LibreTranslate detect HTTP ${response.status}`)
  const rows = await response.json() as { language: string; confidence: number }[]
  return rows.sort((a, b) => b.confidence - a.confidence)[0]?.language ?? 'es'
}

async function translateValue(source: unknown, sourceLanguage: string, targetLanguage: string): Promise<unknown> {
  if (Array.isArray(source)) return Promise.all(source.map((item) => translateText(String(item), sourceLanguage, targetLanguage)))
  return translateText(String(source), sourceLanguage, targetLanguage)
}

async function translateText(source: string, sourceLanguage: string, targetLanguage: string) {
  if (sourceLanguage === targetLanguage) return source
  const response = await fetch('http://127.0.0.1:5000/translate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q: source, source: sourceLanguage, target: targetLanguage, format: 'text' }) })
  if (!response.ok) throw new Error(`LibreTranslate translate HTTP ${response.status}`)
  return String((await response.json() as { translatedText: string }).translatedText)
}

const numberToken = /(?:[$€£]\s*)?-?\d+(?:[.,]\d+)*(?:\s*%|\s*(?:USD|EUR|GBP))?/gi
function repairValue(source: unknown, candidate: unknown): unknown {
  if (Array.isArray(source) && Array.isArray(candidate)) return candidate.map((value, index) => repairText(String(source[index]), String(value)))
  return repairText(String(source), String(candidate))
}
function repairText(source: string, candidate: string) {
  let repaired = candidate.replace(/\b(?:trailer|training)\b(?=\s+(?:max(?:imum)?\s+)?(?:drawdown|loss|eod))/gi, 'trailing')
    .replace(/\btrailer\b/gi, 'trailing').replace(/(\d):\s+(\d)/g, '$1:$2')
  const sourceTokens = [...source.matchAll(numberToken)].map((match) => match[0])
  const candidateTokens = [...repaired.matchAll(numberToken)]
  if (sourceTokens.length === candidateTokens.length) {
    let offset = 0
    for (let index = 0; index < candidateTokens.length; index += 1) {
      const match = candidateTokens[index]; const start = (match.index ?? 0) + offset; const replacement = sourceTokens[index]
      repaired = repaired.slice(0, start) + replacement + repaired.slice(start + match[0].length); offset += replacement.length - match[0].length
    }
  }
  return repaired
}
function textOf(value: unknown) { return Array.isArray(value) ? value.join('\n') : String(value) }
function curatedOverride(sourceHash: string, targetLanguage: string) {
  if (sourceHash === '0c8297b725729f38f6f7276f944d130d17324b172c2f989118ac462080a228e8' && targetLanguage === 'en') return `
Profit share: 70%.

To qualify:
- 3 profitable days;
- each day must generate at least $100;
- the days do not need to be consecutive.

Requests may be submitted every 14 days for profits above $200.

The $100 threshold is monetary, not percentage-based, so it is not stored in profitable_day_threshold_pct.

The request is reviewed within one business day.

Estimated processing:
- Crypto: same day.
- SEPA: 1–3 business days.
- SWIFT: 5–7 business days.

The trader may request the full profit, but must consider the EOD trailing Max DD and maintain enough buffer to avoid a breach.
`
  if (sourceHash === '0f291d18ff3d50ce6938637f680d8de3f5712fa34a6763b94b072ff684e9fb7a' && targetLanguage === 'pt') return `
Política atual para novas contas.

São necessários 5 dias rentáveis.
Cada dia válido deve gerar pelo menos $150.
Os dias não precisam ser consecutivos.

É possível solicitar um reward a cada 7 dias.

Máximo por solicitação:
- 50K: $2,500.
- 100K: $3,500.
- 150K: $5,000.

Também se aplica o limite de 50% do profit buffer.
É utilizado o menor dos dois limites.

Depois de um reward, deve ser gerado pelo menos $0.01 de novo lucro
e os 5 dias rentáveis devem ser cumpridos novamente.

O threshold de $150 é um valor monetário e, por isso, NÃO é armazenado em
profitable_day_threshold_pct.
`
  return null
}
function countBy<T>(rows: T[], key: (row: T) => string) { return Object.fromEntries([...rows.reduce((map, row) => map.set(key(row), (map.get(key(row)) ?? 0) + 1), new Map<string, number>())].sort()) }
type Pending = { resource_type: string; field_name: string; target_language: string; source_hash: string; source_value: unknown; resource_count: number; members: { state_id: string; lock_version: number }[]; [key: string]: unknown }
