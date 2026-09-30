import { brandingAssetResponse } from '@/lib/branding-asset-response'

export async function GET() {
  return brandingAssetResponse('organization_logo', '/brand/tradagora-logo-dark.png')
}
