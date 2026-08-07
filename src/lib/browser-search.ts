import puppeteer, { type Browser, type KeyInput } from 'puppeteer-core'

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

// Persistent browser instance — kept alive across multiple steps
let browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: LAUNCH_ARGS,
    })
  }
  return browser
}

// Execute a series of browser actions in sequence — like a human driving a browser
export async function browserAction(params: {
  action: 'navigate' | 'click' | 'type' | 'select' | 'wait' | 'read' | 'screenshot' | 'press_key' | 'scroll' | 'exists' | 'close'
  selector?: string // CSS selector
  text?: string // Text to type, or button text to find for click
  value?: string // Value for select dropdown
  url?: string // URL for navigate
  key?: string // Key to press (Enter, Tab, Escape, etc.)
  delay?: number // Wait time in ms
  steps?: number // Scroll steps
}): Promise<string> {
  try {
    const b = await getBrowser()
    const pages = await b.pages()
    let page = pages[pages.length - 1] || await b.newPage()

    switch (params.action) {
      case 'navigate': {
        if (!params.url) return JSON.stringify({ error: 'URL required for navigate' })
        await page.setUserAgent(UA)
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
        await page.goto(params.url, { waitUntil: 'networkidle2', timeout: 20000 })
        await new Promise(r => setTimeout(r, 2000))
        return JSON.stringify({ ok: true, url: page.url(), title: await page.title() })
      }

      case 'click': {
        if (!params.selector && !params.text) return JSON.stringify({ error: 'selector or text required for click' })
        let sel = params.selector
        if (!sel && params.text) {
          // Find element by text content
          sel = await page.evaluate((text: string) => {
            const target = text.toLowerCase()
            // Try buttons, links, and clickable elements
            const els = document.querySelectorAll('button, a, [role="button"], [role="tab"], [onclick], input[type="submit"], [class*="btn"], [class*="button"]')
            for (const el of els) {
              const content = (el.textContent || el.getAttribute('value') || '').toLowerCase().trim()
              if (content.includes(target)) {
                if (el.id) return '#' + CSS.escape(el.id)
                // Build a more specific selector
                const tag = el.tagName.toLowerCase()
                const cls = el.className?.split(' ')[0]
                if (cls) return `${tag}.${CSS.escape(cls)}`
                return tag
              }
            }
            return null
          }, params.text) || undefined
        }
        if (!sel) return JSON.stringify({ error: `Could not find clickable element with text: ${params.text}` })
        try {
          await page.click(sel)
          await new Promise(r => setTimeout(r, 1000))
          return JSON.stringify({ ok: true, clicked: sel })
        } catch {
          return JSON.stringify({ error: `Could not click: ${sel}` })
        }
      }

      case 'type': {
        if (!params.selector) return JSON.stringify({ error: 'selector required for type' })
        await page.focus(params.selector)
        // Clear existing content
        await page.evaluate((sel: string) => {
          const el = document.querySelector(sel) as HTMLInputElement
          if (el) {
            el.value = ''
            el.dispatchEvent(new Event('input', { bubbles: true }))
            el.dispatchEvent(new Event('change', { bubbles: true }))
          }
        }, params.selector)
        await page.type(params.selector, params.text || '', { delay: 50 })
        return JSON.stringify({ ok: true, typed: params.text, selector: params.selector })
      }

      case 'select': {
        if (!params.selector) return JSON.stringify({ error: 'selector required for select' })
        await page.select(params.selector, params.value || '')
        return JSON.stringify({ ok: true, selected: params.value, selector: params.selector })
      }

      case 'wait': {
        const ms = params.delay || 2000
        await new Promise(r => setTimeout(r, ms))
        return JSON.stringify({ ok: true, waited: ms })
      }

      case 'read': {
        const content = await page.evaluate(() => {
          document.querySelectorAll('script, style, nav, footer, header, noscript, iframe, .ad, .ads, .cookie-banner').forEach(el => el.remove())
          const main = document.querySelector('main') || document.querySelector('article') || document.body
          return main?.innerText?.slice(0, 8000) || ''
        })
        return JSON.stringify({ content, url: page.url(), title: await page.title() })
      }

      case 'screenshot': {
        // Return a description of what's visible — list all interactive elements
        const interactive = await page.evaluate(() => {
          const elements: { tag: string; text: string; id: string; name: string; type: string; placeholder: string; role: string; className: string; href: string; value: string; visible: boolean }[] = []
          const els = document.querySelectorAll('button, a, input, textarea, select, [role="button"], [role="tab"], [role="combobox"], [role="listbox"], [role="datepicker"], [onclick], label')
          els.forEach(el => {
            const e = el as HTMLElement
            if (e.offsetParent === null) return // skip hidden
            elements.push({
              tag: e.tagName.toLowerCase(),
              text: (e.textContent || '').trim().slice(0, 100),
              id: e.id || '',
              name: (e as HTMLInputElement).name || '',
              type: (e as HTMLInputElement).type || '',
              placeholder: (e as HTMLInputElement).placeholder || '',
              role: e.getAttribute('role') || '',
              className: e.className?.slice(0, 60) || '',
              href: (e as HTMLAnchorElement).href || '',
              value: (e as HTMLInputElement).value || '',
              visible: true,
            })
          })
          return elements.slice(0, 50)
        })
        return JSON.stringify({ interactive, url: page.url(), title: await page.title() })
      }

      case 'press_key': {
        const key = params.key || 'Enter'
        await page.keyboard.press(key as KeyInput)
        await new Promise(r => setTimeout(r, 1000))
        return JSON.stringify({ ok: true, key })
      }

      case 'scroll': {
        await page.evaluate((steps: number) => {
          window.scrollBy(0, steps || 500)
        }, params.steps || 500)
        await new Promise(r => setTimeout(r, 500))
        return JSON.stringify({ ok: true })
      }

      case 'exists': {
        if (!params.selector) return JSON.stringify({ error: 'selector required for exists', exists: false })
        const el = await page.$(params.selector)
        return JSON.stringify({ exists: !!el, selector: params.selector })
      }

      case 'close': {
        if (browser) {
          await browser.close().catch(() => {})
          browser = null
        }
        return JSON.stringify({ ok: true, closed: true })
      }

      default:
        return JSON.stringify({ error: `Unknown action: ${params.action}` })
    }
  } catch (e) {
    return JSON.stringify({ error: `Browser action failed: ${e instanceof Error ? e.message : String(e)}` })
  }
}

// Search using local SearXNG instance
export async function webSearch(query: string): Promise<{ results: { title: string; url: string; snippet: string }[]; error?: string }> {
  try {
    const SEARXNG_URL = process.env.SEARXNG_URL || 'http://localhost:8888'
    const res = await fetch(`${SEARXNG_URL}/search?q=${encodeURIComponent(query)}&format=json&categories=general&language=en-US`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return { results: [], error: `SearXNG returned HTTP ${res.status}` }
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

// Fetch and extract text content from a web page
export async function webFetch(url: string): Promise<string> {
  let b
  try {
    b = await getBrowser()
    const page = await b.newPage()
    await page.setUserAgent(UA)
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 })
    const content = await page.evaluate(() => {
      document.querySelectorAll('script, style, nav, footer, header, noscript, iframe, .ad, .ads, .advertisement, .cookie-banner, .privacy-banner').forEach(el => el.remove())
      const main = document.querySelector('main') || document.querySelector('article') || document.body
      return main?.innerText || ''
    })
    await page.close()
    const cleaned = content.replace(/\s+/g, ' ').trim().slice(0, 20000)
    return cleaned || 'Empty page'
  } catch (e) {
    return JSON.stringify({ error: `Failed to fetch ${url}: ${e instanceof Error ? e.message : String(e)}` })
  }
}