# PLAN: og-image

Rank: 3 of 5 (every shared link on WhatsApp/LinkedIn/X/Discord currently renders with a broken or missing preview image)

## Goal

`src/layouts/BaseLayout.astro` references `https://gosvindraj.com/og-image.png` in four places (og:image, twitter:image, and twice inside the JSON-LD Person schema), and every page inherits it, but **no `og-image.png` exists in `public/`**. Create a 1200x630 branded image, ship it at exactly that path, and add the missing og:image metadata.

## Exact files to touch

1. `src/pages/og-template.astro` (new, TEMPORARY - deleted in the final step)
2. `public/og-image.png` (new, the deliverable)
3. `src/layouts/BaseLayout.astro` (add og:image dimension/alt meta tags)

## Steps, in order

1. Create `src/pages/og-template.astro` containing a self-contained 1200x630 card in the site's own design language. It must not use BaseLayout (no navbar/preloader/cursor). Exact content:

   ```astro
   ---
   import "../styles/global.css";
   ---
   <!doctype html>
   <html lang="en">
     <head><meta charset="UTF-8" /><title>og</title></head>
     <body style="margin:0; cursor:auto;">
       <div style="width:1200px; height:630px; background:#0c0c0a; border:2px solid rgba(234,231,222,0.26); box-sizing:border-box; display:flex; flex-direction:column; justify-content:space-between; padding:56px 64px; position:relative; overflow:hidden;">
         <span class="m-label"><span class="lb">[</span> portfolio <span class="hl">v3</span> <span class="lb">]</span></span>
         <div>
           <div class="display" style="font-size:150px; line-height:0.95;">gosh<span class="acid">.</span></div>
           <div class="display" style="font-size:54px; color:#8f8c80; margin-top:12px;">builds what's next.</div>
         </div>
         <div style="display:flex; justify-content:space-between;">
           <span class="m-label">ai &times; blockchain</span>
           <span class="m-label"><span class="hl">gosvindraj.com</span></span>
         </div>
       </div>
     </body>
   </html>
   ```

2. Start the dev server: `npm run dev`.
3. Capture the screenshot with Playwright (one-off, not a project dependency):
   - `npx playwright install chromium` (downloads the browser if not present)
   - `npx playwright screenshot --viewport-size=1200,630 --wait-for-timeout=3000 http://localhost:4321/og-template public/og-image.png`
   The 3 second wait is REQUIRED so the Google-hosted fonts finish loading before capture; without it the card renders in fallback fonts.
4. Open `public/og-image.png` and eyeball it: Archivo display type (heavy, wide), purple period on "gosh.", visible hairline border, nothing clipped.
5. In `src/layouts/BaseLayout.astro`, directly below the existing `og:image` meta tag, add:

   ```html
   <meta property="og:image:width" content="1200" />
   <meta property="og:image:height" content="630" />
   <meta property="og:image:alt" content="gosh. builds what's next. Gosvindraj's portfolio." />
   <meta name="twitter:image:alt" content="gosh. builds what's next. Gosvindraj's portfolio." />
   ```

6. Delete `src/pages/og-template.astro`. This is mandatory: it is a page route and would otherwise be published at `/og-template` in production.
7. `npm run build` and confirm `dist/og-image.png` exists.

## Edge cases a weaker model would miss

- **The filename is a contract.** Four existing references expect exactly `/og-image.png`. Do not name it `og.png`, do not put it in a subfolder, do not change the references to match a different name.
- **Font loading race in the screenshot.** Playwright fires as soon as load completes; web fonts often land later. The `--wait-for-timeout=3000` flag is what guarantees the brand fonts are painted. If the output shows a generic sans-serif, the wait was skipped or too short.
- **The template page must die.** Leaving `og-template.astro` in `src/pages/` publishes a weird orphan route and adds it to the sitemap. Deletion is part of the task, and the acceptance criteria check for it.
- **Dark-on-dark legibility.** The card is near-black; several chat apps render previews on dark UI. The 2px `rgba(234,231,222,0.26)` border in the template is deliberate so the card has an edge on any background. Keep it.
- **Social scraper caches.** Facebook/LinkedIn/X cache the (currently broken) scrape of these URLs. After deploying, refreshing the preview requires their debugger tools (developers.facebook.com/tools/debug, linkedin.com/post-inspector). Just deploying does not un-break previously shared links until re-scraped.
- **File size.** Keep the PNG under ~300 KB. A flat dark card with text compresses far below that naturally; if it comes out larger, something went wrong (e.g. captured at 2x device pixel ratio). If needed, add `--device-scale-factor=1` behavior is the default; do not pass a scale flag.

## Acceptance criteria

- `public/og-image.png` exists, is 1200x630 (`npx image-size public/og-image.png` or open it and check), under 300 KB.
- `src/pages/og-template.astro` does NOT exist.
- `npm run build` passes and `dist/og-image.png` exists.
- `grep -c "og-image.png" dist/index.html` is at least 2 (og + twitter) and `grep "og:image:width" dist/index.html` matches.
- After the next deploy: `curl -sI https://gosvindraj.com/og-image.png | head -1` returns 200, and pasting `https://gosvindraj.com` into opengraph.xyz shows the card.
