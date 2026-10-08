export function sanitizeMediaIds(values: string[]) {
  return [...new Set(values.filter(isUuid))]
}

export function mediaStoragePath(url: string) {
  const marker = '/storage/v1/object/public/media/'
  const index = url.indexOf(marker)
  return index < 0 ? null : decodeURIComponent(url.slice(index + marker.length))
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
