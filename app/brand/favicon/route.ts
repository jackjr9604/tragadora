import { brandingAssetResponse } from '@/lib/branding-asset-response'

export async function GET() {
  return brandingAssetResponse('favicon', '/brand/tradagora-app-icon.png')
}
