import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { translateContent } from '@/lib/content-translation'

type TranslationBody = { sourceText?: unknown; sourceLang?: unknown; targetLang?: unknown }

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json() as TranslationBody
    if (typeof body.sourceText !== 'string' || typeof body.sourceLang !== 'string' || typeof body.targetLang !== 'string') {
      return NextResponse.json({ success: false, error: 'Solicitud de traducción inválida' }, { status: 400 })
    }
    const translation = await translateContent(body.sourceText, body.sourceLang, body.targetLang)
    return NextResponse.json({ success: true, translation })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Error de traducción' }, { status: 503 })
  }
}
