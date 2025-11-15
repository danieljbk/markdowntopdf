# Client-side Scripts and TypeScript

This project uses **TypeScript everywhere**, including for browser code.  
However, **the browser must never see a `.ts` URL**. All TS must be compiled to JS by Astro/Vite before it is loaded in production.

If you accidentally expose `.ts` to the browser, you will see errors like:

> Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "video/mp2t".

On platforms like Cloudflare Pages, `.ts` is treated as a video extension (`video/mp2t`), not JavaScript, which causes these failures.

---

## Golden rules

1. **Never reference `.ts` in `<script src="…">`**

   ❌ Bad:

   ```astro
   <!-- DO NOT DO THIS -->
   <script type="module" src="/src/scripts/markdown-converter.ts"></script>
   ```

   ```astro
   ---
   // DO NOT DO THIS
   import scriptSrc from '../scripts/markdown-converter.ts?url';
   ```

---

<script type="module" src={scriptSrc}></script>

````

These patterns send a `.ts` URL directly to the browser. In production the host serves it with a non‑JS MIME type and the module fails to load.

2. **Always let Astro/Vite bundle TypeScript**

✅ Good pattern for client-only TS:

```astro
---
// Client-only component
---
<!-- markup ... -->

<script>
import '../scripts/markdown-converter.ts';
</script>
````

Notes:

- No `type="module"` on the `<script>` tag.
- No `is:inline` attribute.
- Astro treats this as a **bundled client script**:
  - `../scripts/markdown-converter.ts` is compiled to JS.
  - The final HTML references a hashed JS asset under `/_astro/*.js`.
- The browser only ever sees JS, not `.ts`.

3. **Do not use `?url` for executable code**

   `?url` is for **static assets**, not for code you intend to execute.

   ❌ Bad:

   ```astro
   import scriptSrc from '../scripts/thing.ts?url';

   <script type="module" src={scriptSrc}></script>
   ```

   ✅ Use `?url` only when you truly want a URL string (e.g., image, download link), **never** for JS/TS code.

4. **TS source lives under `src/`, browser code is always built output**

   - Write all browser logic as `.ts` under `src/` (e.g. `src/scripts/markdown-converter.ts`).
   - Wire it from `.astro` via Astro’s processed `<script>` tags as shown above.
   - In `dist/`, only JS (`.js/.mjs`) should be referenced from `<script>` tags.

---

## Debugging checklist for MIME/type errors

If you see something like:

> Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html" / "video/mp2t"

1. Check the **Network** tab in devtools:
   - Look at the failing request’s URL. Does it end in `.ts`?
2. Search the repo for that path:
   - Look for any `<script src="...">`, `import '...ts'` in client contexts, or `?url` imports.
3. Fix by:
   - Removing `.ts` from any browser-exposed URL.
   - Importing the TS file through a bundled `<script>` block in a `.astro` file instead.

---

## Summary

- **Do**: write browser code in `.ts`, imported via Astro’s bundled `<script>` blocks.
- **Don’t**: expose `.ts` URLs to the browser (no `<script src="*.ts">`, no `?url` on TS you execute).
- This keeps our TypeScript DX while ensuring production bundles are valid JS and play nicely with Cloudflare Pages and other static hosts.
