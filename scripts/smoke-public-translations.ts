const routes = ['/', '/?lang=en', '/?lang=pt', '/prop-firms', '/prop-firms?lang=en', '/prop-firms?lang=pt', '/comparador?lang=en', '/comparador?lang=pt', '/blog?lang=en', '/blog?lang=pt']

void main().catch((error) => { console.error(error); process.exitCode = 1 })

async function main() {
  for (const route of routes) {
    const response = await fetch(`https://www.tradagora.com${route}`, { redirect: 'manual' })
    const html = await response.text()
    const lang = html.match(/<html[^>]*\blang=["']([^"']+)/i)?.[1] ?? null
    const canonical = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1] ?? html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i)?.[1] ?? null
    const alternates = [...html.matchAll(/<link[^>]*hreflang=["']([^"']+)["'][^>]*href=["']([^"']+)/gi)].map((match) => match[1])
    console.log(JSON.stringify({ route, status: response.status, location: response.headers.get('location'), lang, canonical, alternates, bytes: html.length, hasNextError: /Internal Server Error|Application error|NEXT_NOT_FOUND/i.test(html) }))
  }
}
