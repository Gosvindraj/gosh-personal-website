# PLAN: fix-prod-api-endpoints

Rank: 1 of 5 (highest leverage - two user-facing features are silently broken in production, fix is ~30 minutes)

## Goal

The contact form and the anomaly detector fetch relative URLs (`/api/contact`, `/api/anomaly`). The site deploys to GitHub Pages, which is a static host with no server routes, so both requests return a 404 HTML page and the features fail every time in production. The chatbot proves the correct pattern: it calls the absolute URL `https://gosvindraj-github-io.pages.dev/api/chat` and works. Centralize the API origin in one constant and point all three calls at it.

## Exact files to touch

1. `src/lib/api.ts` (new file)
2. `src/pages/contact.astro` (the `fetch("/api/contact"...)` call inside the `<script>` block)
3. `src/pages/anomaly-detector.astro` (the `fetch("/api/anomaly"...)` call inside the `<script>` block)
4. `src/components/ChatBot.tsx` (the hardcoded `https://gosvindraj-github-io.pages.dev/api/chat` URL)

Do NOT touch: the CoinGecko / exchangerate-api URLs in `crypto-api.astro`, or the `marketing-automation-api.gosvind.workers.dev` URL in `projects.astro`. Those are different services and already work.

## Steps, in order

1. Create `src/lib/api.ts` with exactly:

   ```ts
   /* single origin for the serverless endpoints (Cloudflare Pages
      functions). the site itself is static GitHub Pages, so relative
      /api/* paths 404 in production. */
   export const API_BASE = "https://gosvindraj-github-io.pages.dev";
   ```

2. In `src/pages/contact.astro`, inside the `<script>` block, add at the top with the other imports:
   `import { API_BASE } from "../lib/api";`
   Then change `fetch("/api/contact", {` to ``fetch(`${API_BASE}/api/contact`, {``

3. In `src/pages/anomaly-detector.astro`, same pattern:
   `import { API_BASE } from "../lib/api";`
   Change `fetch("/api/anomaly", {` to ``fetch(`${API_BASE}/api/anomaly`, {``

4. In `src/components/ChatBot.tsx`, add `import { API_BASE } from "../lib/api";` at the top and change
   `fetch("https://gosvindraj-github-io.pages.dev/api/chat", {` to ``fetch(`${API_BASE}/api/chat`, {``

5. Run `npm run build`. It must complete with zero errors.

## Edge cases a weaker model would miss

- **Astro inline `<script>` blocks are bundled modules.** Imports like `../lib/api` work inside them exactly like in any TS file. Do not try to inline the constant as a global or a `define:vars` script; a plain import is correct.
- **CORS preflight.** These POSTs send `Content-Type: application/json`, which triggers an OPTIONS preflight. The chat endpoint already answers CORS correctly for `https://gosvindraj.com` (it is called cross-origin from there today). Contact and anomaly endpoints live on the same Cloudflare Pages deployment but may not have CORS headers configured, since until now they were only ever called same-origin (which never worked anyway). Verify with:
  `curl -s -i -X OPTIONS https://gosvindraj-github-io.pages.dev/api/contact -H "Origin: https://gosvindraj.com" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type" | head -20`
  You need `Access-Control-Allow-Origin` in the response. If it is missing, the fix belongs in the Cloudflare Pages functions repo (NOT this repo): the function must answer OPTIONS with `Access-Control-Allow-Origin: https://gosvindraj.com`, `Access-Control-Allow-Methods: POST`, `Access-Control-Allow-Headers: Content-Type`, and include `Access-Control-Allow-Origin` on the POST response too. Flag this to the owner instead of hacking around it client-side.
- **Local dev now calls production endpoints.** From `localhost:4321` the requests go cross-origin to the pages.dev domain. If the server's CORS only allows `gosvindraj.com`, local testing of these forms fails while production works. That is acceptable; note it, do not "fix" it by reverting to relative paths.
- **Do not change any surrounding logic.** The contact form's success/error UX and the anomaly detector's address validation, rendering, and modal code stay byte-identical apart from the one fetch line and the one import line per file.

## Acceptance criteria

- `grep -rn "fetch(\"/api/" src/` returns nothing.
- `grep -rn "pages.dev" src/` returns exactly one match: `src/lib/api.ts`.
- `npm run build` passes.
- In a browser on the deployed site (or `npm run dev` if CORS allows): submitting the contact form shows the success message and DevTools Network shows a POST to `https://gosvindraj-github-io.pages.dev/api/contact` with a non-404 status; the anomaly detector, given a valid `0x` address, renders a results table or a server-provided message, not "Network error".
- The chatbot still answers (regression check, since its URL moved into the shared constant).
