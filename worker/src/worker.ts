import puppeteer from '@cloudflare/puppeteer'

interface Env {
  BROWSER: puppeteer.BrowserWorker
}

type PdfRequestPayload = {
  html?: string
  filename?: string
}

const MAX_HTML_BYTES = 2 * 1024 * 1024 // 2MB safety limit

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...(init?.headers ?? {}),
    },
    status: init?.status ?? 200,
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Only allow / and /render-pdf as per the spec.
    const isSupportedPath =
      url.pathname === '/' || url.pathname === '/render-pdf'

    if (!isSupportedPath) {
      return jsonResponse(
        { error: 'Not Found', details: 'Unsupported path' },
        { status: 404 },
      )
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...CORS_HEADERS,
        },
      })
    }

    if (request.method !== 'POST') {
      return jsonResponse(
        { error: 'Method Not Allowed', details: 'Use POST for this endpoint' },
        {
          status: 405,
          headers: { Allow: 'POST' },
        },
      )
    }

    // Basic input size limit to prevent abuse.
    const contentLengthHeader = request.headers.get('content-length')
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader)
      if (!Number.isNaN(contentLength) && contentLength > MAX_HTML_BYTES) {
        return jsonResponse(
          {
            error: 'Payload too large',
            details: `Request body must be <= ${MAX_HTML_BYTES} bytes`,
          },
          { status: 413 },
        )
      }
    }

    let payload: PdfRequestPayload
    try {
      payload = (await request.json()) as PdfRequestPayload
    } catch {
      return jsonResponse(
        { error: 'Invalid JSON body' },
        { status: 400 },
      )
    }

    const html = payload.html
    if (!html || typeof html !== 'string') {
      return jsonResponse(
        {
          error: '`html` field is required and must be a non-empty string',
        },
        { status: 400 },
      )
    }

    if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES) {
      return jsonResponse(
        {
          error: 'HTML too large',
          details: `Rendered HTML must be <= ${MAX_HTML_BYTES} bytes`,
        },
        { status: 413 },
      )
    }

    const filename =
      typeof payload.filename === 'string' && payload.filename.trim()
        ? payload.filename.trim()
        : 'document.pdf'

    try {
      const browser = await puppeteer.launch(env.BROWSER)
      const page = await browser.newPage()

      // Load content; networkidle0 ensures external CSS/fonts load if referenced.
      await page.setContent(html, { waitUntil: 'networkidle0' })

      const pdfBuffer = await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
        // You can specify paper size explicitly if desired, e.g.:
        // format: 'A4',
        // margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      })

      await page.close()
      await browser.close()

      return new Response(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          ...CORS_HEADERS,
        },
      })
    } catch (error) {
      console.error('Render error:', error)
      return jsonResponse(
        { error: 'Failed to render PDF' },
        { status: 500 },
      )
    }
  },
}


