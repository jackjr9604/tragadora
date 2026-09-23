import { ToolForm } from '@/components/admin/ToolForm'

export default function NewToolPage() {
  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-4xl"><header className="mb-8"><h1 className="text-3xl font-bold">Nueva herramienta</h1><p className="mt-1 text-slate-500">Administra el catálogo; la lógica de herramientas internas permanece en código.</p></header><ToolForm /></div></main>
}
