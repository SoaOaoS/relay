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

// Decode a Bing tracking URL to get the real URL
function decodeBingUrl(bingUrl: string): string {
  try {
    const url = new URL(bingUrl)
    const u = url.searchParams.get('u')
    if (u) {
      // Bing encodes the URL as base64-ish in the 'u' param, prefixed with 'a1'
      const decoded = Buffer.from(u.startsWith('a1') ? u.slice(2) : u, 'base64').toString('utf-8')
      if (decoded.startsWith('http')) return decoded
    }
    return bingUrl
  } catch {
    return bingUrl
  }
}

// Search the web using Puppeteer + Bing (forced English)
export async function webSearch(query: string): Promise<{ results: { title: string; url: string; snippet: string }[]; error?: string }> {
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
    // Force English results with setlang and cc params
    await page.goto(`https://www.bing.com/search?q=${encodeURIComponent(query)}&count=10&setlang=en-US&cc=US`, {
      waitUntil: 'networkidle2',
      timeout: 15000,
    })

    const results = await page.evaluate(() => {
      const items: { title: string; url: string; snippet: string }[] = []
      const resultItems = document.querySelectorAll('li.b_algo')
      resultItems.forEach((li, i) => {
        if (i >= 10) return
        const link = li.querySelector('h2 a') as HTMLAnchorElement
        const title = link?.textContent?.trim() || li.querySelector('h2')?.textContent?.trim() || ''
        const snippet = li.querySelector('.b_caption p')?.textContent?.trim() || ''
        if (link?.href && title) {
          items.push({ title, url: link.href, snippet })
        }
      })
      return items
    })

    // Decode Bing tracking URLs to get real URLs
    const decoded = results.map(r => ({ ...r, url: decodeBingUrl(r.url) }))

    await browser.close()
    return { results: decoded }
  } catch (e) {
    if (browser) await browser.close().catch(() => {})
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