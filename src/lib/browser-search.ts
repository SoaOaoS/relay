import puppeteer from 'puppeteer-core'

const CHROMIUM_PATH = '/usr/bin/chromium'

// Search the web using Puppeteer + DuckDuckGo HTML (via real browser, not API)
export async function webSearch(query: string): Promise<{ results: { title: string; url: string; snippet: string }[]; error?: string }> {
  let browser
  try {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1920,1080'],
    })

    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    await page.goto(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded', timeout: 15000 })

    // Extract results from the page
    const results = await page.evaluate(() => {
      const items: { title: string; url: string; snippet: string }[] = []
      const resultElements = document.querySelectorAll('.result')
      resultElements.forEach((el, i) => {
        if (i >= 10) return
        const link = el.querySelector('.result__a') as HTMLAnchorElement
        const snippet = el.querySelector('.result__snippet')
        if (link) {
          let url = link.href
          // DDG wraps URLs — extract actual URL from redirect
          const uddgMatch = url.match(/uddg=([^&]+)/)
          if (uddgMatch) url = decodeURIComponent(uddgMatch[1])
          items.push({
            title: link.textContent?.trim() || '',
            url,
            snippet: snippet?.textContent?.trim() || '',
          })
        }
      })
      return items
    })

    await browser.close()
    return { results }
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
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1920,1080'],
    })

    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 })

    // Extract main text content from the page
    const content = await page.evaluate(() => {
      // Remove unwanted elements
      document.querySelectorAll('script, style, nav, footer, header, noscript, iframe, nav, [role="navigation"], [role="banner"]').forEach(el => el.remove())
      // Get text from body or main/article if available
      const main = document.querySelector('main') || document.querySelector('article') || document.body
      return main?.innerText || ''
    })

    await browser.close()
    // Clean up and truncate
    const cleaned = content.replace(/\s+/g, ' ').trim().slice(0, 20000)
    return cleaned || 'Empty page'
  } catch (e) {
    if (browser) await browser.close().catch(() => {})
    return JSON.stringify({ error: `Failed to fetch ${url}: ${e instanceof Error ? e.message : String(e)}` })
  }
}