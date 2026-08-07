import puppeteer from 'puppeteer-core'

const CHROMIUM_PATH = '/usr/bin/chromium'

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--window-size=1920,1080',
]

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// Search the web using Puppeteer + Google
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
    // Use Google search — more reliable than DDG HTML
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}&num=10`, {
      waitUntil: 'networkidle2',
      timeout: 15000,
    })

    // Extract results from Google
    const results = await page.evaluate(() => {
      const items: { title: string; url: string; snippet: string }[] = []
      // Google results are in div.g with a > h3 and a span
      const resultDivs = document.querySelectorAll('div.g')
      resultDivs.forEach((div, i) => {
        if (i >= 10) return
        const link = div.querySelector('a') as HTMLAnchorElement
        const title = div.querySelector('h3')?.textContent?.trim() || ''
        // Snippet is usually in a span or div after the link
        const snippetEl = div.querySelector('.VwiC3b') || div.querySelector('[data-snc] span') || div.querySelector('span:last-child')
        const snippet = snippetEl?.textContent?.trim() || ''
        if (link?.href && title) {
          items.push({ title, url: link.href, snippet })
        }
      })
      // Fallback: try another selector pattern
      if (items.length === 0) {
        const allLinks = document.querySelectorAll('a:has(h3)')
        allLinks.forEach((a, i) => {
          if (i >= 10) return
          const link = a as HTMLAnchorElement
          const title = link.querySelector('h3')?.textContent?.trim() || ''
          if (link.href && title && !link.href.includes('google.com')) {
            items.push({ title, url: link.href, snippet: '' })
          }
        })
      }
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
      args: LAUNCH_ARGS,
    })

    const page = await browser.newPage()
    await page.setUserAgent(UA)
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 })

    // Extract main text content from the page
    const content = await page.evaluate(() => {
      // Remove unwanted elements
      document.querySelectorAll('script, style, nav, footer, header, noscript, iframe, [role="navigation"], [role="banner"], .ad, .ads, .advertisement').forEach(el => el.remove())
      // Get text from body or main/article if available
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