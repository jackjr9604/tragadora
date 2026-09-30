import { NextResponse } from 'next/server'
import { getBranding } from '@/lib/branding'

export async function GET() {
  return NextResponse.json(await getBranding(), { headers: { 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' } })
}
