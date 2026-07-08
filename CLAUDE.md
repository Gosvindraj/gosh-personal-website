# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git

- Only commit and push when explicitly asked to.
- Do not include a `Co-Authored-By` trailer in commit messages.

## Writing style

- **No em dashes (`—`)** anywhere in user-facing text. Use a comma, colon, or period instead.
- User-facing copy is lowercase, conversational, a little irreverent. Match that voice.

## Commands

```bash
npm run dev       # start dev server (localhost:4321)
npm run build     # production build → dist/
npm run preview   # preview production build
```

No test suite or linter is configured. `npm run build` is the correctness check.

## Stack

- **Astro 6** with `@astrojs/react` integration and `@astrojs/sitemap`
- **React 19** — used only for the ChatBot component (interactive island)
- **GSAP 3** — all animations (scroll, cursor, page transitions)
- **Astro View Transitions** (`ClientRouter`) for SPA-style navigation
- Deployed to **Cloudflare Pages** (auto-deploys `main` on push via Cloudflare's GitHub integration), site URL `https://gosvindraj.com`. The `functions/api/*` Pages Functions ship from this same repo and deploy alongside the static site on the same Cloudflare project.

## Design system ("the ledger", 2026 redesign)

Brutalist editorial: warm near-black, bone ink, one acid-lime accent, hairline rules everywhere. Defined in `src/styles/global.css`:

| Token | Value | Purpose |
|---|---|---|
| `--bg` | `#0c0c0a` | Page background (warm black) |
| `--surface` | `#141412` | Card/panel background |
| `--ink` | `#eae7de` | Body text (bone white) |
| `--dim` / `--faint` | `#8f8c80` / `#55534a` | Subdued text tiers |
| `--acid` | `#c9f542` | The single accent colour |
| `--line` / `--line-strong` | white @ 11% / 26% | Hairline rules |
| `--nav-height` | `64px` | Navbar height |
| `--gutter` | `clamp(1.25rem, 5vw, 4.5rem)` | Horizontal page padding |

Legacy aliases (`--text`, `--muted`, `--accent`, `--border`, ...) map onto these for older class names; prefer the new names.

Typography: **Archivo** (variable, `font-stretch: 112%`, weight ~740, lowercase) for display via the `.display` class; **Instrument Serif** italic for editorial asides (`.serif`); **JetBrains Mono** for micro-labels (`.m-label`, format `[ 01 / section name ]`). Signature interaction: list rows invert to acid background with black text on hover.

## Architecture

### Layout and shared chrome
`src/layouts/BaseLayout.astro` is the single layout wrapping every page. It owns:
- Global `<head>` with SEO meta, Open Graph, JSON-LD structured data
- Preloader (giant acid counter, curtain wipe; runs once per session via `sessionStorage`, skipped for reduced motion)
- Custom cursor (dot + lerped ring + click ripple), film-grain overlay
- Big footer CTA block ("got an idea? say hi") suppressed with the `hideFooter` prop (contact and 404 use it)
- `<Navbar>` and `<ChatBot>` — both persist across page navigations
- GSAP `ScrollTrigger` cleanup/refresh hooks on `astro:before-swap` / `astro:page-load`
- A shared reveal helper: any element with `data-reveal` rises in on scroll (optional `data-reveal-delay`); elements stay visible without JS

### Motion rules
- Every page script checks `prefers-reduced-motion` and skips or finalizes animations when set; global CSS also kills animations/marquee under it.
- Initial hidden states for hero timelines are set from JS (`gsap.set`), not CSS, so content is visible without JS.
- Clean up intervals/listeners on `astro:before-swap`.

### Navbar (`src/components/Navbar.astro`)
The header uses `transition:persist`, so its script binds listeners **once at module init** and only refreshes per-page state (active link, closing the menu) on `astro:page-load`. The full-screen mobile menu `#nav-overlay` is a **sibling** of the header, not a child: the header's `backdrop-filter` would otherwise become the containing block for its `position: fixed`. It persists separately via `transition:persist="nav-overlay"`. The navbar also runs a live MYT clock.

### Styles
`src/styles/global.css` is the single stylesheet, imported in `BaseLayout`. It holds tokens plus shared chrome (nav, overlay menu, footer, preloader, cursor, marquee, `.btn-solid`/`.btn-line`, `.sec`/`.sec-head` section scaffolding). All page-specific styles live in `<style>` blocks within each `.astro` file.

### ChatBot (`src/components/ChatBot.tsx`)
The only React component. It posts to a Cloudflare Pages `/api/chat` endpoint (external; the endpoint must exist for chat to work). Rate-limited client-side: 20 messages per session, 2 s cooldown, 500 char max. Session history persists to `localStorage`. Styled inline from a `T` token object that mirrors the CSS tokens; keep them in sync.

### Pages
- `/` — hero with rotating display word, marquee fact ticker, featured-work index rows, latest blog posts (from the content collection)
- `/about` — linear editorial sections: timeline, tech stack grid, personality ("how i'm wired"), offline facts
- `/projects` — full-width index rows (acid invert on hover) + the AI news bot's live Instagram feed (fetched client-side from a Cloudflare Worker)
- `/blog` — content collection (`src/content/blog/*.md`, schema in `src/content.config.ts`); `[slug].astro` uses `render()` from `astro:content` and emits BlogPosting JSON-LD. Filter empty strings out of `tags` before rendering.
- `/snake-game`, `/crypto-api`, `/anomaly-detector` — project pages with all logic inline in their `<script>` blocks. Snake is pure canvas; crypto calls CoinGecko + exchangerate-api client-side; the anomaly detector posts to `/api/anomaly` (server route not in this repo).

### Cursor
`cursor: none` is set globally; `#cursor-dot` and `#cursor-ring` are positioned with GSAP in `BaseLayout`. The `cursor-hover` body class drives the ring's hover state. Everything cursor-related is disabled on touch devices via `@media (hover: none), (pointer: coarse)`.
