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

// Submit a form on a web page — supports both CSS selectors and natural language field matching
export async function webFormSubmit(params: {
  url: string
  fields: { selector?: string; label?: string; value: string; type?: 'input' | 'select' | 'textarea' | 'checkbox' }[]
  submitSelector?: string
  submitText?: string
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
    // Extra wait for dynamic widgets to render
    await new Promise(r => setTimeout(r, 3000))

    for (const field of params.fields) {
      let selector = field.selector

      // If no selector, try to find the field by label/placeholder/aria-label
      if (!selector && field.label) {
        selector = await page.evaluate((label: string) => {
          // Try multiple strategies to find the input
          // 1. label[for] → input[id]
          const labels = document.querySelectorAll('label')
          for (const l of labels) {
            if (l.textContent?.toLowerCase().includes(label.toLowerCase())) {
              const forAttr = l.getAttribute('for')
              if (forAttr) {
                const input = document.getElementById(forAttr)
                if (input) return '#' + forAttr
              }
              // Maybe the input is inside the label
              const input = l.querySelector('input, textarea, select')
              if (input) {
                if (input.id) return '#' + input.id
                if (input.name) return `[name="${input.name}"]`
              }
            }
          }
          // 2. placeholder match
          const inputs = document.querySelectorAll('input, textarea, select')
          for (const inp of inputs) {
            const el = inp as HTMLInputElement
            const placeholder = el.placeholder?.toLowerCase() || ''
            const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || ''
            const name = el.name?.toLowerCase() || ''
            const title = el.title?.toLowerCase() || ''
            const target = label.toLowerCase()
            if (placeholder.includes(target) || ariaLabel.includes(target) || name.includes(target) || title.includes(target)) {
              if (el.id) return '#' + el.id
              if (el.name) return `[name="${el.name}"]`
              return el.tagName.toLowerCase()
            }
          }
          // 3. Try data-testid or data-field
          const testid = document.querySelector(`[data-testid*="${label.toLowerCase()}"], [data-field*="${label.toLowerCase()}"]`)
          if (testid) {
            if (testid.id) return '#' + testid.id
            return `[data-testid="${testid.getAttribute('data-testid')}"]`
          }
          return null
        }, field.label)
      }

      if (!selector) {
        // Log available inputs for debugging
        const inputsInfo = await page.evaluate(() => {
          const inputs = document.querySelectorAll('input, textarea, select, [role="combobox"], [role="listbox"], [role="spinbutton"]')
          return Array.from(inputs).map(el => {
            const e = el as HTMLElement
            return {
              tag: e.tagName,
              type: (e as HTMLInputElement).type || '',
              id: e.id,
              name: (e as HTMLInputElement).name || '',
              placeholder: (e as HTMLInputElement).placeholder || '',
              ariaLabel: e.getAttribute('aria-label') || '',
              className: e.className?.slice(0, 80) || '',
              visible: e.offsetParent !== null,
            }
          }).filter(i => i.visible)
        })
        return JSON.stringify({ error: `Could not find field for label: "${field.label}". Available visible inputs:`, inputs: inputsInfo })
      }

      const el = await page.$(selector)
      if (!el) {
        return JSON.stringify({ error: `Element not found with selector: ${selector}` })
      }

      if (field.type === 'checkbox') {
        const isChecked = await page.$eval(selector, (el: Element) => (el as HTMLInputElement).checked)
        if (!isChecked) await page.click(selector)
      } else if (field.type === 'select') {
        await page.select(selector, field.value)
      } else {
        // Clear and type
        await page.focus(selector)
        await page.evaluate((sel: string) => { const el = document.querySelector(sel) as HTMLInputElement; if (el) { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); } }, selector)
        await page.type(selector, field.value, { delay: 50 })
      }
    }

    // Find and click submit button
    let submitSel = params.submitSelector
    if (!submitSel && params.submitText) {
      submitSel = await page.evaluate((text: string) => {
        const target = text.toLowerCase()
        const buttons = document.querySelectorAll('button, input[type="submit"], a[role="button"], [role="button"]')
        for (const btn of buttons) {
          const btnText = btn.textContent?.toLowerCase().trim() || ''
          if (btnText.includes(target)) {
            if (btn.id) return '#' + btn.id
            if (btn.className) return `.${btn.className.split(' ')[0]}`
            return btn.tagName.toLowerCase()
          }
        }
        return null
      }, params.submitText)
    }

    if (submitSel) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {}),
        page.click(submitSel),
      ])
    } else {
      // Fallback: try submit button by type
      const submitBtn = await page.$('button[type="submit"], input[type="submit"]')
      if (submitBtn) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {}),
          submitBtn.click(),
        ])
      } else {
        await page.keyboard.press('Enter')
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {})
      }
    }

    // Wait for any post-submit JS
    await new Promise(r => setTimeout(r, params.waitAfter || 3000))

    // Extract result — look for confirmation messages
    const result = await page.evaluate(() => {
      const success = document.querySelector('.confirmation, .success, .alert-success, [role="alert"], .booking-confirmation, .confirmation-message, .thank-you, .booking-success, .res-confirmation')
      if (success) return `CONFIRMATION: ${success.textContent?.trim().slice(0, 2000)}`

      document.querySelectorAll('script, style, nav, footer, header, noscript, iframe, .ad, .ads').forEach(el => el.remove())
      const main = document.querySelector('main') || document.querySelector('article') || document.body
      return main?.innerText?.slice(0, 5000) || 'Empty result page'
    })

    const finalUrl = page.url()
    await browser.close()
    return JSON.stringify({ result, finalUrl })
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