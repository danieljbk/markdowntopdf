## Browser Rendering Worker (HTML → PDF)

This directory contains a Cloudflare Worker that uses **Browser Rendering (Puppeteer)** to turn rendered Markdown HTML into a **PDF** with working links, as described in `docs/BROWSER-RENDERING-WORKER.md`.

### Files

- `wrangler.toml`: Worker configuration (binding to the Browser Rendering service via `BROWSER`).
- `src/worker.ts`: Worker implementation accepting `{ html, filename }` as JSON and returning `application/pdf`.
- `tsconfig.json`: TypeScript settings for this Worker only.

### Local Development

Install the required dependencies in this subproject (from the repo root or inside `worker/`):

```bash
cd worker
pnpm add -D wrangler
pnpm add @cloudflare/puppeteer @cloudflare/workers-types
```

Then run the Worker locally:

```bash
npx wrangler dev
```

The Worker exposes a single endpoint:

- **Method:** `POST`
- **Path:** `/render-pdf` (or `/`)
- **Body (JSON):**

```json
{
  "html": "<!doctype html>...complete html string...",
  "filename": "markdown-YYYY-MM-DD.pdf"
}
```

On success it returns:

- `status: 200`
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="<filename>"`

### Deployment

1. Ensure Browser Rendering is enabled on your Cloudflare account.
2. Update the `name` in `wrangler.toml` if desired.
3. Deploy:

```bash
cd worker
npx wrangler deploy
```

Once deployed, point the Astro frontend’s “Download PDF” action to:

```ts
await fetch('https://your-worker-domain/render-pdf', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ html, filename }),
})
```
