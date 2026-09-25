import Link from 'next/link'
import type { ReactNode } from 'react'

type Block =
  | { type: 'line'; value: string; index: number }
  | { type: 'table'; headers: string[]; rows: string[][]; index: number }
  | { type: 'callout'; tone: string; body: string[]; index: number }

export function DocumentationMarkdown({ source }: { source: string }) {
  const headings = source
    .split(/\r?\n/)
    .filter((line) => /^#{2,3} /.test(line))
    .map((line) => ({
      level: line.startsWith('### ') ? 3 : 2,
      text: line.replace(/^#{2,3} /, ''),
      id: headingId(line.replace(/^#{2,3} /, '')),
    }))

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_220px]">
      <div className="min-w-0 space-y-4 text-[15px] leading-7 text-slate-700">
        {parseBlocks(source).map(renderBlock)}
      </div>
      {headings.length > 0 && (
        <aside className="order-first h-fit rounded-xl border bg-slate-50 p-4 xl:order-last xl:sticky xl:top-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">En este artículo</p>
          <nav className="mt-3 space-y-2">
            {headings.map((heading, index) => (
              <a key={`${heading.id}-${index}`} href={`#${heading.id}`} className={`block text-sm text-slate-600 hover:text-black ${heading.level === 3 ? 'pl-3' : 'font-medium'}`}>
                {heading.text}
              </a>
            ))}
          </nav>
        </aside>
      )}
    </div>
  )
}

function parseBlocks(source: string): Block[] {
  const lines = source.split(/\r?\n/)
  const blocks: Block[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const callout = lines[index].match(/^> \[!(NOTE|IMPORTANT|WARNING|EXAMPLE)\]\s*(.*)$/i)
    if (callout) {
      const body = callout[2] ? [callout[2]] : []
      while (lines[index + 1]?.startsWith('>')) {
        index += 1
        body.push(lines[index].replace(/^>\s?/, ''))
      }
      blocks.push({ type: 'callout', tone: callout[1].toUpperCase(), body, index })
      continue
    }

    if (isTableRow(lines[index]) && isTableDivider(lines[index + 1])) {
      const headers = tableCells(lines[index])
      const start = index
      index += 2
      const rows: string[][] = []
      while (index < lines.length && isTableRow(lines[index])) {
        rows.push(tableCells(lines[index]))
        index += 1
      }
      index -= 1
      blocks.push({ type: 'table', headers, rows, index: start })
      continue
    }

    blocks.push({ type: 'line', value: lines[index], index })
  }

  return blocks
}

function renderBlock(block: Block): ReactNode {
  if (block.type === 'table') {
    return (
      <div key={block.index} className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-slate-900">
            <tr>{block.headers.map((cell, index) => <th key={index} className="whitespace-nowrap border-b px-4 py-3 font-semibold">{inline(cell)}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>{block.headers.map((_, cellIndex) => <td key={cellIndex} className="min-w-36 px-4 py-3 align-top">{inline(row[cellIndex] ?? '')}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (block.type === 'callout') {
    const labels: Record<string, string> = { NOTE: 'Nota', IMPORTANT: 'Importante', WARNING: 'Advertencia', EXAMPLE: 'Ejemplo' }
    const styles: Record<string, string> = {
      NOTE: 'border-blue-300 bg-blue-50 text-blue-950',
      IMPORTANT: 'border-amber-400 bg-amber-50 text-amber-950',
      WARNING: 'border-red-300 bg-red-50 text-red-950',
      EXAMPLE: 'border-emerald-300 bg-emerald-50 text-emerald-950',
    }
    return (
      <aside key={block.index} className={`rounded-r-xl border-l-4 px-4 py-3 ${styles[block.tone] ?? styles.NOTE}`}>
        <p className="text-xs font-bold uppercase tracking-wider">{labels[block.tone] ?? block.tone}</p>
        {block.body.map((line, index) => <p key={index} className="mt-1">{inline(line)}</p>)}
      </aside>
    )
  }

  return renderLine(block.value, block.index)
}

function renderLine(line: string, index: number) {
  if (line.startsWith('### ')) return <h3 id={headingId(line.slice(4))} key={index} className="scroll-mt-24 pt-4 text-xl font-bold text-slate-950">{inline(line.slice(4))}</h3>
  if (line.startsWith('## ')) return <h2 id={headingId(line.slice(3))} key={index} className="scroll-mt-24 border-b pt-6 pb-2 text-2xl font-bold text-slate-950">{inline(line.slice(3))}</h2>
  if (line.startsWith('# ')) return <h2 key={index} className="pt-4 text-3xl font-bold text-slate-950">{inline(line.slice(2))}</h2>
  if (line.startsWith('- ')) return <div key={index} className="flex gap-3"><span className="text-amber-600">•</span><p>{inline(line.slice(2))}</p></div>
  if (/^\d+\. /.test(line)) return <div key={index} className="flex gap-3"><span className="font-mono text-slate-400">{line.match(/^\d+\./)?.[0]}</span><p>{inline(line.replace(/^\d+\. /, ''))}</p></div>
  if (line.startsWith('```')) return <div key={index} />
  if (!line.trim()) return <div key={index} className="h-2" />
  return <p key={index}>{inline(line)}</p>
}

function inline(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\((?:https?:\/\/|\/)[^)]+\))/g)
  return parts.map((part, index) => {
    const code = part.match(/^`(.+)`$/)
    if (code) return <code key={index} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[.9em] text-slate-900">{code[1]}</code>
    const bold = part.match(/^\*\*(.+)\*\*$/)
    if (bold) return <strong key={index} className="font-semibold text-slate-950">{bold[1]}</strong>
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) return link[2].startsWith('/') ? <Link key={index} href={link[2]} className="font-medium text-blue-700 underline">{link[1]}</Link> : <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 underline">{link[1]}</a>
    return part
  })
}

function isTableRow(line = '') { return /^\s*\|.*\|\s*$/.test(line) }
function isTableDivider(line = '') { return isTableRow(line) && tableCells(line).every((cell) => /^:?-{3,}:?$/.test(cell)) }
function tableCells(line: string) { return line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()) }
function headingId(value: string) { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }
