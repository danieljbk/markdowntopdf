# Cloudflare Browser Rendering Worker for Markdown → PDF

## 1. Purpose

This document specifies a **Cloudflare Worker that uses Browser Rendering (Puppeteer)** to turn our GitHub‑style Markdown HTML into a **high‑quality, text‑based PDF** with working hyperlinks.

The worker is intentionally narrow:

- It does **not** host the website.
- It does **not** parse Markdown (in the first iteration).
- It has **one job**: given HTML for a rendered Markdown document, return a PDF that looks the same, with clickable links.

The existing Astro/Bun site running on Cloudflare Pages remains responsible for:

- Editing Markdown.
- Rendering Markdown → HTML + KaTeX → GitHub‑style preview.
- Calling the worker when the user requests a real PDF download.

Later, we can migrate Markdown → HTML rendering into the worker, but that is strictly optional.

---

## 2. High‑Level Architecture

### 2.1 Components

- **Frontend (Cloudflare Pages, Astro app)**

  - Current implementation (Markdown editor + GitHub‑style preview + KaTeX).
  - New: `Download PDF` button that POSTs to the worker.

- **Browser Rendering Worker (Cloudflare Workers + @cloudflare/puppeteer)**
  - Bound to the `BROWSER` service.
  - Accepts HTML (or Markdown, in a future version) and returns `application/pdf`.
  - Uses a headless Chromium instance to run `page.setContent(html)` and `page.pdf(...)`.

### 2.2 Data Flow (Phase 1: HTML Input)

1. User enters Markdown and hits `Preview` (unchanged).
2. User hits `Download PDF`.
3. Frontend:
   - Extracts the rendered HTML from the preview container (e.g. `article.markdown-body`).
   - Wraps it in a minimal HTML shell (doctype, head, GitHub CSS, KaTeX CSS).
   - POSTs `{ html, filename }` to the worker.
4. Worker:
   - Launches a headless Chromium instance via Browser Rendering.
   - Calls `page.setContent(html, { waitUntil: 'networkidle0' })`.
   - Calls `page.pdf({ ...options })`.
   - Returns the PDF bytes.
5. Frontend:
   - Receives the PDF as a blob.
   - Triggers a download (`<a download>` with an object URL).

This approach leverages all the **existing client‑side rendering logic** and keeps the worker focused purely on HTML → PDF.

---

## 3. HTTP API Contract

### 3.1 Endpoint

We define a single endpoint on the Worker:

- **Method:** `POST`
- **Path:** `/render-pdf` (or `/` if we keep it simple)

### 3.2 Request

Content‑Type: `application/json`

Shape:

```json
{
  "html": "<!doctype html>...complete html string...",
  "filename": "markdown-2025-11-15.pdf"
}
```

Notes:

- `html` should be a complete, self‑contained document:
  - `<!doctype html>`
  - `<html><head>…styles…</head><body>…markdown-body…</body></html>`
  - Inline GitHub CSS + KaTeX CSS is acceptable; linking to CDNs is also fine if you’re OK with the worker making outbound requests.
- `filename` is optional on the wire; the Worker can derive a default (e.g. `document.pdf`) if missing.

### 3.3 Response

On success:

- `status: 200`
- Headers:
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="<filename>"`
- Body: PDF binary.

On error:

- `status: 4xx`/`5xx`
- JSON error payload:

```json
{
  "error": "string",
  "details": "optional debug info"
}
```

---

## 4. Worker Implementation (Phase 1: HTML → PDF)

### 4.1 Wrangler Configuration

Example `wrangler.toml`:

```toml
name = "md2pdf-renderer"
main = "src/worker.ts"
compatibility_date = "2025-01-01"

[[browser]]
binding = "BROWSER"
```

Notes:

- The `[[browser]]` block is what binds Cloudflare’s Browser Rendering service to `env.BROWSER` in the Worker.
- Make sure the account has Browser Rendering enabled; this is a paid feature.

### 4.2 Worker Code (TypeScript)

```ts
// src/worker.ts
import puppeteer from '@cloudflare/puppeteer'

interface Env {
  BROWSER: puppeteer.BrowserWorker
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    let payload: { html?: string; filename?: string }
    try {
      payload = await request.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const html = payload.html
    if (!html || typeof html !== 'string') {
      return new Response(
        JSON.stringify({
          error: '`html` field is required and must be a string',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
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
        // You can specify paper size explicitly if desired:
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
        },
      })
    } catch (error) {
      console.error('Render error:', error)
      return new Response(JSON.stringify({ error: 'Failed to render PDF' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  },
}
```

Key points:

- We launch a browser instance per request (`puppeteer.launch(env.BROWSER)`), render once, and close it.
- We explicitly set `printBackground: true` to preserve background colors (important for GitHub dark theme).
- `preferCSSPageSize: true` lets CSS `@page` rules (if we add them) control page size.

---

## 5. Frontend Integration (Astro / Cloudflare Pages)

### 5.1 Constructing the HTML Payload

We already have:

- A rendered `article.markdown-body` inside `.preview-scroll`.
- GitHub Markdown CSS and KaTeX CSS available.

For the worker, we should send a **minimal, self-contained HTML document**:

```ts
function buildHtmlForWorker(markdownHtml: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Markdown PDF</title>
    <style>
      /* Minimal page reset for PDF */
      @page {
        margin: 20mm 15mm;
      }
      body {
        margin: 0;
        padding: 0;
      }
    </style>
    <link rel="stylesheet" href="https://unpkg.com/github-markdown-css@5.8.1/github-markdown.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" />
  </head>
  <body>
    <article class="markdown-body">
      ${markdownHtml}
    </article>
  </body>
</html>`
}
```

Notes:

- We reuse the **same HTML fragment** the preview uses, so visual parity is high.
- Using CDN CSS keeps the worker bundle small; if you want full determinism and no outbound network, you can inline the CSS instead.

### 5.2 Calling the Worker and Triggering Download

On the frontend (inside the Astro component’s script):

```ts
async function downloadPdf() {
  try {
    const markdownHtml =
      document.getElementById('preview-output')?.innerHTML ?? ''
    if (!markdownHtml.trim()) {
      showStatus('Nothing to export. Generate a preview first.', 'error')
      return
    }

    showStatus('Generating PDF…', 'info')

    const html = buildHtmlForWorker(markdownHtml)
    const payload = {
      html,
      filename: `markdown-${new Date().toISOString().slice(0, 10)}.pdf`,
    }

    const response = await fetch('https://your-worker-domain/render-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Worker error:', error)
      showStatus('PDF generation failed', 'error')
      return
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = payload.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)

    showStatus(`PDF downloaded: ${payload.filename}`, 'success')
  } catch (error) {
    console.error('Download error:', error)
    showStatus('Unexpected error during PDF download', 'error')
  }
}
```

Hook this up to the existing **Download (PDF)** button so it uses the worker instead of any browser print logic.

---

## 6. Costs & Optimization

### 6.1 Cost Model

Cloudflare Browser Rendering is billed per **browser‑hour**:

- Each `page.pdf()` call takes on the order of **1–3 seconds** for typical Markdown documents.
- At $0.09 per browser‑hour:
  - 2 seconds per PDF ≈ 0.0005 hours → **$0.000045 per PDF**.
  - 100k PDFs/month ≈ **$4.50/month** (rough order of magnitude).

This is more expensive than pure Workers CPU time, but still relatively low in absolute terms.

### 6.2 Minimizing Usage

To keep cost low:

- **Only call the worker on explicit user action** (`Download PDF`).
- **Avoid auto‑export on autosave**, etc.
- Consider **caching by content hash** (Phase 2):
  - Compute a hash of the Markdown or HTML client‑side.
  - Send `{ html, hash }` to the worker.
  - Worker checks KV/storage for an existing PDF with that hash and returns it if present.
  - Only render new PDFs when the content hash changes.

KV integration is optional and can be added later.

---

## 7. Security & Hardening

- **Input size limits:**

  - Reject payloads over a reasonable size (e.g. 1–2 MB of HTML).
  - This prevents abuse and keeps render times predictable.

- **Content sanitization:**

  - Because the HTML is produced by our own frontend, XSS risk is low, but it’s still good practice to:
    - Strip `<script>` tags.
    - Restrict inline event handlers.
  - Alternatively, accept Markdown only and do Markdown → HTML inside the worker (Phase 2).

- **Timeouts:**
  - Use the Worker’s built‑in execution timeout; don’t keep Chromium alive longer than necessary.
  - In case of persistent timeouts or errors, respond with a clean JSON error.

---

## 8. Phase 2: Rendering Markdown Inside the Worker (Optional)

Once Phase 1 is stable, we can consider moving Markdown → HTML into the worker to:

- Reduce payload size (send Markdown instead of full HTML).
- Ensure both preview and PDF use the **same rendering logic** in a single place (e.g. shared `marked` + KaTeX configuration).

Approach:

- Bundle `marked` and `katex` into the worker using Wrangler’s bundler:
  - `bun add marked katex`
  - Worker:
    ```ts
    import { marked } from 'marked'
    import katex from 'katex'
    import githubMarkdownCss from 'github-markdown-css/github-markdown.css'
    ```
- Convert Markdown → HTML using `marked` and render LaTeX to HTML via `katex.renderToString`.
- Embed the HTML in a template as in `buildHtmlForWorker`, but now generated entirely server‑side.

This raises complexity somewhat but centralizes rendering and removes trust in the client HTML. It’s optional and can be done when you want stronger guarantees or more control.

---

## 9. Summary

- **Current site:** stays as-is for editing and preview.
- **New worker:** a dedicated Markdown‑HTML → PDF renderer using Cloudflare Browser Rendering.
- **Integration:** the **Download (PDF)** button uses a POST → PDF download flow instead of `window.print()`.
- **Benefits:** high‑fidelity, text‑based PDFs with clickable links, minimal changes to existing UI, and bounded Browser Rendering usage strictly on explicit download actions.

This document should be sufficient for another engineer to:

1. Stand up the Browser Rendering worker.
2. Wire the existing frontend to use it.
3. Reason about costs, security, and future enhancements.
