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

// Submit a form on a web page — fill fields, click a button, return the result page
export async function webFormSubmit(params: {
  url: string
  fields: { selector: string; value: string; type?: 'input' | 'select' | 'textarea' | 'checkbox' }[]
  submitSelector?: string
  waitAfter?: number
}): Promise<string> {
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
    await page.goto(params.url, { waitUntil: 'networkidle2', timeout: 20000 })

    // Fill in each field
    for (const field of params.fields) {
      const el = await page.$(field.selector)
      if (!el) {
        await browser.close()
        return JSON.stringify({ error: `Element not found: ${field.selector}` })
      }

      if (field.type === 'checkbox') {
        const isChecked = await page.$eval(field.selector, (el: Element) => (el as HTMLInputElement).checked)
        if (!isChecked) await page.click(field.selector)
      } else if (field.type === 'select') {
        await page.select(field.selector, field.value)
      } else {
        // Clear and type into input/textarea
        await page.click(field.selector)
        await page.evaluate((sel: string) => { const el = document.querySelector(sel) as HTMLInputElement; if (el) el.value = '' }, field.selector)
        await page.type(field.selector, field.value, { delay: 50 })
      }
    }

    // Submit the form
    if (params.submitSelector) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {}),
        page.click(params.submitSelector),
      ])
    } else {
      // Try submitting by pressing Enter on the last field
      await page.keyboard.press('Enter')
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {})
    }

    // Wait a bit for any post-submit JS
    if (params.waitAfter) await new Promise(r => setTimeout(r, params.waitAfter))

    // Extract the result page content
    const result = await page.evaluate(() => {
      // Look for confirmation/success messages first
      const success = document.querySelector('.confirmation, .success, .alert-success, [role="alert"], .booking-confirmation, .confirmation-message')
      if (success) return `CONFIRMATION: ${success.textContent?.trim()}`

      // Otherwise get the page text
      document.querySelectorAll('script, style, nav, footer, header, noscript, iframe, .ad, .ads').forEach(el => el.remove())
      const main = document.querySelector('main') || document.querySelector('article') || document.body
      return main?.innerText?.slice(0, 5000) || 'Empty result page'
    })

    await browser.close()
    return result || 'No content after form submission'
  } catch (e) {
    if (browser) await browser.close().catch(() => {})
    return JSON.stringify({ error: `Form submission failed: ${e instanceof Error ? e.message : String(e)}` })
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