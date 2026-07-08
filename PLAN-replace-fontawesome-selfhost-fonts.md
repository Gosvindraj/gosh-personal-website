# PLAN: replace-fontawesome-selfhost-fonts

Rank: 4 of 5 (kills the two third-party render dependencies: ~100 KB of Font Awesome CSS loaded on all 10 pages for 12 icons on 3 pages, and a render-blocking Google Fonts @import at the very top of the only stylesheet)

## Goal

Remove the Font Awesome CDN `<link>` entirely by replacing its 12 usages with inline SVGs, and self-host the three typefaces via Fontsource packages so no request leaves the origin for fonts or icon CSS.

## Exact files to touch

1. `src/layouts/BaseLayout.astro` (remove FA `<link>`; add Fontsource imports)
2. `src/styles/global.css` (remove the Google Fonts `@import`; update font-family token names)
3. `src/pages/snake-game.astro` (4 d-pad chevron icons + 2 canvas `ctx.font` strings)
4. `src/pages/crypto-api.astro` (1 arrow icon in the fetch button)
5. `src/pages/anomaly-detector.astro` (arrow, xmark, copy, external-link icons in markup; check + copy swap and chevron row-arrow inside the SCRIPT)
6. `src/components/ChatBot.tsx` (FONT_SANS / FONT_MONO family name strings)
7. `package.json` (new dependencies)

## Steps, in order

### Part A: fonts

1. `npm i @fontsource-variable/archivo @fontsource-variable/jetbrains-mono @fontsource/instrument-serif`
2. In `src/layouts/BaseLayout.astro` frontmatter, above the `import "../styles/global.css";` line, add:

   ```ts
   import "@fontsource-variable/archivo/wdth.css";
   import "@fontsource-variable/jetbrains-mono";
   import "@fontsource-variable/jetbrains-mono/wght-italic.css";
   import "@fontsource/instrument-serif";
   import "@fontsource/instrument-serif/400-italic.css";
   ```

3. In `src/styles/global.css`: delete the entire `@import url('https://fonts.googleapis.com/...')` line, and update the tokens:
   - `--font-sans:  "Archivo Variable", system-ui, sans-serif;`
   - `--font-mono:  "JetBrains Mono Variable", ui-monospace, monospace;`
   - `--font-serif` stays `"Instrument Serif", Georgia, serif;` (static package keeps the plain name)
4. In `src/components/ChatBot.tsx`, update the two constants to the new names: `FONT_SANS = "'Archivo Variable', system-ui, sans-serif"` and `FONT_MONO = "'JetBrains Mono Variable', ui-monospace, monospace"`.
5. In `src/pages/snake-game.astro`, the canvas code sets fonts as strings twice (`ctx.font = "... 'JetBrains Mono', monospace"`); update both to `'JetBrains Mono Variable'`.
6. `npm run dev`, open the home page, and confirm in DevTools > Network (filter: font) that woff2 files load from `/_astro/` or `/node_modules`-bundled URLs, with ZERO requests to `fonts.googleapis.com` or `fonts.gstatic.com`.

### Part B: icons

7. Define the replacement SVGs (all `stroke="currentColor"` so they inherit text color, `aria-hidden="true"`, sized via width/height attributes):
   - chevron up/left/right/down (snake d-pad, 14px): `<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>` is UP; rotate the points for the others (left: `15 18 9 12 15 6`, right: `9 18 15 12 9 6`, down: `6 9 12 15 18 9`).
   - arrow-right (crypto fetch button + anomaly analyze button, 12px): `<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`
   - xmark (anomaly modal close, 12px): two crossed lines like the ChatBot already uses.
   - copy (anomaly modal, 12px): `<svg ... viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="1"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/></svg>`
   - check (swapped in by JS, 12px): `<svg ...><polyline points="20 6 9 17 4 12"/></svg>`
   - external-link / arrow-up-right (anomaly snowtrace link, 12px): `<svg ...><line x1="7" y1="17" x2="17" y2="7"/><polyline points="8 7 17 7 17 16"/></svg>`
   - chevron-right (anomaly table row arrow, 10px): right-rotated chevron from above.
8. Replace every `<i class="fa-...">...</i>` in the three pages' MARKUP with the matching SVG.
9. In `src/pages/anomaly-detector.astro`'s `<script>`, two non-markup usages MUST also change:
   - The copy-confirmation swap currently does `icon.className = "fa-solid fa-check"` then restores `"fa-regular fa-copy"`. Replace with swapping `copyBtn.innerHTML` between the copy SVG string and the check SVG string (define both as consts near the top of the script).
   - `renderResults()` builds table rows in a template literal containing `<i class="fa-solid fa-chevron-right row-arrow"></i>`. Replace inside that template string with the chevron SVG carrying `class="row-arrow"`.
10. Remove the entire Font Awesome `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/...font-awesome...">` block (including its integrity/crossorigin attributes) from `src/layouts/BaseLayout.astro`.
11. `npm run build`.

## Edge cases a weaker model would miss

- **The `wdth` axis is load-bearing.** `.display` uses `font-stretch: 112%`. The default `@fontsource-variable/archivo` CSS ships a wght-only variable font; you MUST import the `/wdth.css` variant or every heading silently renders at 100% width and the whole visual identity changes while "working". After the swap, verify a headline's rendered width matches the before state.
- **Fontsource variable families have different names.** They register as "Archivo Variable" / "JetBrains Mono Variable", not "Archivo" / "JetBrains Mono". Three places hold family names as strings outside global.css: ChatBot.tsx constants and two `ctx.font` strings in snake-game.astro. Miss those and the chatbot/canvas silently fall back to system fonts.
- **JetBrains Mono italic.** The `.m-note` code-comment utility uses `font-style: italic` in mono. Without importing the italic variable file the browser fakes an oblique, which looks noticeably worse at 10px. That is why step 2 imports `wght-italic.css`.
- **Two FA usages live inside JavaScript, not markup.** The grep for `<i class=` will not find the `icon.className = "fa-solid fa-check"` swap or the template-literal row arrow in `renderResults()`. Both are in `anomaly-detector.astro`'s script and both must be converted (step 9), or the copy button breaks (className on an SVG element behaves differently) and table rows lose their arrows.
- **Weights in use are non-standard.** The site uses `font-weight: 740` and `font-stretch: 112%` on purpose; variable fonts handle both. Do not "normalize" them to 700/expanded.
- **Do not preload manually.** Fontsource CSS goes through Vite, which hashes and inlines `@font-face` correctly. Hand-adding `<link rel="preload">` with guessed URLs will 404 after the next build's hash change.

## Acceptance criteria

- `grep -rn "cdnjs.cloudflare.com" src/` and `grep -rn "fonts.googleapis.com" src/` both return nothing.
- `grep -rn "fa-solid\|fa-regular\|fa-brands" src/` returns nothing.
- `npm run build` passes.
- With DevTools open on `npm run dev`: zero network requests to any third-party origin for CSS or fonts on `/`, `/about`, `/anomaly-detector`.
- Visual checks: snake d-pad shows 4 chevrons (mobile emulation); crypto "fetch live price" button shows an arrow; anomaly modal shows close/copy/external icons; clicking copy swaps to a check for 1.5s then back; anomaly table rows show a right arrow on hover; `i build` hero headline is visibly wide/heavy (wdth axis alive); `.m-note` comments are true italics.
