export function safeContentCenterReturn(value: string | undefined, fallback = '/admin/content-center/translations') {
  if (!value) return fallback
  try {
    const decoded = decodeURIComponent(value)
    return decoded.startsWith('/admin/content-center') && !decoded.startsWith('//') ? decoded : fallback
  } catch { return fallback }
}
