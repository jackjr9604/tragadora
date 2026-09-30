import { brandingAssetResponse } from '@/lib/branding-asset-response'

export async function GET() {
  return brandingAssetResponse('apple_touch_icon', '/brand/tradagora-app-icon.png')
}
