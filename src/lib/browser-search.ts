import puppeteer from 'puppeteer-core'

const CHROMIUM_PATH = '/usr/bin/chromium'

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--window-size=1920,1080',
  '--lang=en-US',
]

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// SearXNG runs locally on the VPS (Docker, port 8888)
const SEARXNG_URL = process.env.SEARXNG_URL || 'http://localhost:8888'

// Search using local SearXNG instance (aggregates Google, Bing, DDG, etc.)
export async function webSearch(query: string): Promise<{ results: { title: string; url: string; snippet: string }[]; error?: string }> {
  try {
    const res = await fetch(`${SEARXNG_URL}/search?q=${encodeURIComponent(query)}&format=json&categories=general&language=en-US`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      return { results: [], error: `SearXNG returned HTTP ${res.status}` }
    }
    const data = await res.json() as { results?: { title?: string; url?: string; content?: string }[] }
    const results = (data.results || []).slice(0, 10).map(r => ({
      title: r.title || '',
      url: r.url || '',
      snippet: (r.content || '').slice(0, 200),
    }))
    return { results }
  } catch (e) {
    return { results: [], error: e instanceof Error ? e.message : String(e) }
  }
}

// Fetch and extract text content from a web page using a real browser
export async function webFetch(url: string): Promise<string> {
  let browser
  try {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: LAUNCH_ARGS,
    })

    const page = await browser.newPage()
    await page.setUserAgent(UA)
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 })

    const content = await page.evaluate(() => {
      document.querySelectorAll('script, style, nav, footer, header, noscript, iframe, [role="navigation"], [role="banner"], .ad, .ads, .advertisement, .cookie-banner, .privacy-banner').forEach(el => el.remove())
      const main = document.querySelector('main') || document.querySelector('article') || document.body
      return main?.innerText || ''
    })

    await browser.close()
    const cleaned = content.replace(/\s+/g, ' ').trim().slice(0, 20000)
    return cleaned || 'Empty page'
  } catch (e) {
    if (browser) await browser.close().catch(() => {})
    return JSON.stringify({ error: `Failed to fetch ${url}: ${e instanceof Error ? e.message : String(e)}` })
  }
}