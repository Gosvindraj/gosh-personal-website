# PLAN: design-tokens

Rank: 5 of 5 (prevents the recurring class of bug where a palette change has to be chased through hardcoded values; this already happened once when the accent changed to purple and the ChatBot kept stale colors)

## Goal

Three consolidations, from a design review of this codebase:
1. The site has TWO different green/red pairs meaning "good/bad": `#6fcf97` / `#eb5757` (anomaly detector status, contact error) vs `#4ade80` / `#f87171` (crypto 24h high/low, change badge, sparkline). Introduce semantic tokens and use one pair.
2. `src/components/ChatBot.tsx` re-declares the whole palette as a hardcoded `T` object that drifts from `global.css`. Point its inline styles at the CSS custom properties instead.
3. The "invert to accent" hover pattern hardcodes `#0c0c0a` for on-accent text in several files instead of `var(--bg)`.

Scope guard: do NOT attempt a site-wide breakpoint consolidation in this pass. It changes rendered layouts and needs visual judgment. Only the three items above.

## Exact files to touch

1. `src/styles/global.css` (new tokens)
2. `src/pages/anomaly-detector.astro` (status colors -> tokens, in CSS and in the script's `scoreColor()`)
3. `src/pages/crypto-api.astro` (high/low/badge/sparkline colors -> tokens)
4. `src/pages/contact.astro` (error red -> token)
5. `src/components/ChatBot.tsx` (T object -> var() strings)
6. Every file matched by `grep -rln "#0c0c0a" src/pages src/components` (invert-hover text color -> var(--bg))

## Steps, in order

1. In `src/styles/global.css`, add to the `:root` block, right after `--acid-dim`:

   ```css
   --ok:       #6fcf97;
   --warn:     #f2994a;
   --bad:      #eb5757;
   /* rgb triplets for JS that needs to build rgba() strings */
   --ok-rgb:   111, 207, 151;
   --warn-rgb: 242, 153, 74;
   --bad-rgb:  235, 87, 87;
   ```

   The anomaly palette wins because it is already used in two features and is less saturated (fits the muted system better than the Tailwind-default `#4ade80`).

2. `src/pages/anomaly-detector.astro` CSS: replace every literal `#6fcf97` with `var(--ok)`, `#f2994a` with `var(--warn)`, `#eb5757` with `var(--bad)` (dots, badges, stat-val classes). The `rgba(111,207,151,0.1)`-style badge backgrounds become `rgba(var(--ok-rgb), 0.1)` etc.
3. `src/pages/anomaly-detector.astro` SCRIPT: `scoreColor()` returns hex strings that get written into inline `style="...background:${color}"` attributes and SVG-free contexts, so `var()` works there too. Change it to return `"var(--bad)"`, `"var(--warn)"`, `"var(--ok)"`. Verify the three places the return value is used are all CSS contexts (style attributes): they are (`stat-val` classes are CSS-driven; `score-bar-fill`, `feature-fill`, and the modal meta value use inline `style` background/color).
4. `src/pages/crypto-api.astro` CSS: `.val-high` -> `color: var(--ok)`, `.val-low` -> `color: var(--bad)`; `.change-badge.pos` / `.neg` colors and borders -> `var(--ok)` / `var(--bad)` with `rgba(var(--ok-rgb), 0.1)` backgrounds.
5. `src/pages/crypto-api.astro` SCRIPT, `drawSparkline()`: this one is the trap. It builds SVG attribute strings: `stroke` gets `rgba(${color},0.85)` where `color` is a raw `"74,222,128"` triplet, and gradient stops get hex. SVG presentation attributes here are fine with CSS functions ONLY via the `style` attribute, and this code uses `setAttribute("stroke", ...)` which also accepts `var()` in SVG2-supporting browsers, but gradient `stop-color` via `setAttribute` with `var()` is unreliable. Deterministic fix: read the resolved values once at the top of `drawSparkline`:

   ```ts
   const css = getComputedStyle(document.documentElement);
   const okRgb  = css.getPropertyValue("--ok-rgb").trim();
   const badRgb = css.getPropertyValue("--bad-rgb").trim();
   const okHex  = css.getPropertyValue("--ok").trim();
   const badHex = css.getPropertyValue("--bad").trim();
   ```

   Then `const color = isUp ? okRgb : badRgb;` and `const hexColor = isUp ? okHex : badHex;`. Delete the literal `"74,222,128"`, `"248,113,113"`, `"#4ade80"`, `"#f87171"` strings.
6. `src/pages/contact.astro`: the `#response-message.response-error` block uses `#eb5757` and `rgba(235, 87, 87, ...)`; replace with `var(--bad)` / `rgba(var(--bad-rgb), ...)`.
7. `src/components/ChatBot.tsx`: rewrite the `T` object values as CSS variable references; inline React styles accept them fine and they resolve at paint time, so SSR is a non-issue:

   ```ts
   const T = {
     bg:          "var(--bg)",
     surface:     "var(--surface)",
     border:      "var(--line)",
     borderHover: "color-mix(in srgb, var(--acid) 50%, transparent)",
     text:        "var(--ink)",
     muted:       "var(--dim)",
     accent:      "var(--acid)",
     accentDim:   "var(--acid-dim)",
   } as const;
   ```

   The remaining literal `rgba(155, 109, 206, ...)` strings elsewhere in the file (avatar border, scrollbarColor, the `<style>` block's selection/scrollbar/pulse rules) become `color-mix(in srgb, var(--acid) N%, transparent)` where N is the old alpha as a percentage. The one literal that must stay a real color: `scrollbarColor` (the CSS property accepts var()/color-mix fine, keep as string). The keyframes' box-shadow rgba values may also use color-mix.
8. Invert-hover hardcodes: run `grep -rn "#0c0c0a" src/pages src/components`. For every hit that is an on-accent text color in a `:hover` rule (projects `.proj-row:hover ...`, blog index `.post-row:hover ...`, blog [slug] `.pn-row:hover ...`, contact `.aside-links a:hover ...`), replace `#0c0c0a` with `var(--bg)`. EXCEPTIONS that must stay literal: `src/pages/snake-game.astro` canvas rgba strings (canvas cannot read CSS vars), ChatBot color values already handled in step 7, and the og-template if it exists.
9. `npm run build`.

## Edge cases a weaker model would miss

- **Canvas is exempt.** `snake-game.astro` draws with `ctx.fillStyle = "rgba(...)"`; the 2D canvas API takes resolved color strings only. Leave those literals; converting them to `var()` silently paints black.
- **SVG gradients built via `createElementNS`.** That is exactly why step 5 reads computed values instead of writing `var()` into `stop-color` attributes. Do not shortcut it.
- **`color-mix` support.** All evergreen browsers since early 2023 support it; this site already uses `overflow-x: clip` (similar support window), so it is consistent with the project's baseline. Do not add fallbacks.
- **`getPropertyValue` returns padded strings.** The `.trim()` calls in step 5 are required; `rgba( 111, 207, 151,0.85)` with a leading space happens to parse, but a leading space inside `rgba(${x},...)` after hex lookup does not always, and trimming costs nothing.
- **React inline styles + var().** `style={{ background: "var(--acid)" }}` is just a string passthrough; it works and keeps SSR deterministic. Do NOT reach for `getComputedStyle` inside the component body: it crashes during server render (`window` is undefined at module/render scope).
- **The purple swap precedent.** When the accent changed from lime to purple, this exact ChatBot `T` object was missed at first and needed a manual second pass. After this change, verify the panel by temporarily setting `--acid: red` in DevTools on `:root` and confirming the FAB, borders, and user label all follow instantly.

## Acceptance criteria

- `grep -rn "#4ade80\|#f87171" src/` returns nothing.
- `grep -rn "#6fcf97\|#f2994a\|#eb5757" src/` matches only the token definitions in `global.css`.
- `grep -rn "#0c0c0a" src/pages src/components` matches only `snake-game.astro` canvas strings (and `global.css` token definitions).
- `grep -n "9b6dce\|155, 109, 206" src/components/ChatBot.tsx` returns nothing.
- `npm run build` passes.
- Functional checks: anomaly detector table shows green/orange/red badges and bars; crypto fetch shows green high / red low and a colored sparkline; contact form error state (kill network, submit) shows red box; in DevTools, setting `--acid: red` on `:root` recolors the ChatBot FAB/panel live.
