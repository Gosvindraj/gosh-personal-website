# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git

- Only commit and push when explicitly asked to.

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
- Deployed to **Cloudflare Pages** (auto-deploys `main` on push via Cloudflare's GitHub integration), site URL `https://gosvindraj.com`. The `functions/api/*` Pages Functions ship from this same repo and deploy alongside the static site on the same Cloudflare project, so the frontend calls them as **same-origin relative paths** (`/api/chat`, `/api/contact`, `/api/anomaly`).
- **No third-party asset CDNs.** Fonts are self-hosted via `@fontsource*` packages (imported in `BaseLayout`); icons are inline SVG. Font Awesome and the Google Fonts CDN were removed deliberately — do not reintroduce them.

## Design system ("the ledger", 2026 redesign)

Brutalist editorial: warm near-black, bone ink, one purple accent (`--acid`, named after an earlier lime iteration but repurposed), hairline rules everywhere. Defined in `src/styles/global.css`:

| Token | Value | Purpose |
|---|---|---|
| `--bg` | `#0c0c0a` | Page background (warm black) |
| `--surface` | `#141412` | Card/panel background |
| `--ink` | `#eae7de` | Body text (bone white) |
| `--dim` / `--faint` | `#8f8c80` / `#55534a` | Subdued text tiers |
| `--acid` | `#9b6dce` | The single accent colour |
| `--ok` / `--warn` / `--bad` | `#6fcf97` / `#f2994a` / `#eb5757` | Semantic status colours (plus `-rgb` triplet variants for building `rgba()` in JS) |
| `--line` / `--line-strong` | white @ 11% / 26% | Hairline rules |
| `--nav-height` | `64px` | Navbar height |
| `--gutter` | `clamp(1.25rem, 5vw, 4.5rem)` | Horizontal page padding |

Legacy aliases (`--text`, `--muted`, `--accent`, `--border`, ...) map onto these for older class names; prefer the new names. **Never hardcode a hex/rgba that a token already covers** — use the token so a palette change is one edit.

Typography: **Archivo** (variable, `font-stretch: 112%`, weight ~740, lowercase) for display via the `.display` class; **Instrument Serif** italic for editorial asides (`.serif`); **JetBrains Mono** for micro-labels (`.m-label`, format `[ 01 / section name ]`) and for `.m-note` (the `//`-prefixed mono-italic aside). Signature interaction: list rows invert to acid background with black text on hover.

Buttons (in `global.css`): `.btn-solid` (filled acid, inverts to outline on hover), `.btn-solid-invert` (acid outline, fills on hover — the pair used together in a group should match, not mix), `.btn-line` (neutral hairline). All arrows are the same inline SVG icon, which nudges right on hover via `.btn-solid svg`.

## Architecture

### Layout and shared chrome
`src/layouts/BaseLayout.astro` is the single layout wrapping every page. It owns:
- Global `<head>` with SEO meta, Open Graph, JSON-LD structured data
- Preloader (giant acid counter, curtain wipe; runs once per session via `sessionStorage`, skipped for reduced motion)
- Custom cursor (dot + lerped ring + click ripple), film-grain overlay
- Footer bar (copyright + social links), suppressed with the `hideFooter` prop (contact and 404 use it)
- `<Navbar>` and `<ChatBot>` — both persist across page navigations. `<ChatBot>` is suppressed with the `hideChat` prop on pages that already offer their own "get in touch" surface (contact uses it; its FAB also collided with the submit button)
- GSAP `ScrollTrigger` cleanup/refresh hooks on `astro:before-swap` / `astro:page-load`
- Scroll reset: `history.scrollRestoration = "manual"` plus a forced scroll-to-top on forward navigations (skipped for back/forward and hash links), because the router's own reset can lose a race with `ScrollTrigger` recalculating and leave a page opened mid-scroll
- A shared reveal helper: any element with `data-reveal` rises in on scroll (optional `data-reveal-delay`); elements stay visible without JS

### Motion rules
- Every page script checks `prefers-reduced-motion` and skips or finalizes animations when set; global CSS also kills animations/marquee under it.
- Initial hidden states for hero timelines are set from JS (`gsap.set`), not CSS, so content is visible without JS.
- Clean up intervals/listeners on `astro:before-swap`.

### Navbar (`src/components/Navbar.astro`)
The header uses `transition:persist`, so its script binds listeners **once at module init** and only refreshes per-page state (active link, closing the menu) on `astro:page-load`. The full-screen mobile menu `#nav-overlay` is a **sibling** of the header, not a child: the header's `backdrop-filter` would otherwise become the containing block for its `position: fixed`. It persists separately via `transition:persist="nav-overlay"`.

Three things the menu does that are easy to break:
- **Listeners are delegated to `document`**, and `#nav-toggle`/`#nav-overlay` are re-queried on every use rather than captured once. `transition:persist` *should* make direct binding safe, but if persistence ever silently fails the captured node goes stale and the menu button dies with no recovery. Delegation removes that failure mode.
- **Opening pushes a throwaway history entry** (`history.pushState`), so the Android back button / back-swipe pops *that* and closes the menu instead of navigating away or leaving the site. A `popstate` listener closes the menu; closing via toggle/Escape unwinds the entry with `history.back()`. Do **not** call `history.back()` when the close came from tapping a nav link — it cancels Astro's async navigation.
- **Opening adds `.nav-open` to `<body>`**, which hides the ChatBot FAB (it has a higher z-index than the overlay). That rule needs `!important` because the FAB's `display` comes from React inline styles.

### Styles
`src/styles/global.css` is the single stylesheet, imported in `BaseLayout`. It holds tokens plus shared chrome (nav, overlay menu, footer, preloader, cursor, marquee, `.btn-solid`/`.btn-line`, `.sec`/`.sec-head` section scaffolding). All page-specific styles live in `<style>` blocks within each `.astro` file.

### ChatBot (`src/components/ChatBot.tsx`)
The only React component. It posts to `/api/chat` (same-origin; the Pages Function lives in `functions/api/chat.ts` in this repo). Rate-limited client-side: 20 messages per session, 2 s cooldown, 500 char max. Session history persists to `localStorage`. Styled with inline React styles from a `T` object, whose values are **`var(--token)` / `color-mix()` references, not copied hex** — so a palette change needs no second edit here. Keep it that way. Auto-focus of the input is skipped on touch devices so opening the panel doesn't immediately raise the keyboard.

### Pages
- `/` — hero with rotating display word, marquee fact ticker, featured-work index rows, latest blog posts (from the content collection)
- `/about` — linear editorial sections: timeline, tech stack grid, personality ("how i'm wired"), offline facts
- `/projects` — full-width index rows (acid invert on hover) + the AI news bot's live Instagram feed (fetched client-side from a Cloudflare Worker)
- `/blog` — content collection (`src/content/blog/*.md`, schema in `src/content.config.ts`); `[slug].astro` uses `render()` from `astro:content` and emits BlogPosting JSON-LD. Filter empty strings out of `tags` before rendering.
- Project pages, all sharing a hero pattern (sticky left `.project-header` with `[ project NN ]` label, two-line `.display` title with acid period, description, `← all projects` back link; interactive panel or screenshot filmstrip on the right):
  - `/snake-game`, `/crypto-api`, `/anomaly-detector` — **interactive** demos, logic inline in their `<script>` blocks. Snake is pure canvas; crypto calls CoinGecko + exchangerate-api client-side; the anomaly detector posts to `/api/anomaly` (Pages Function in `functions/api/anomaly.ts`).
  - `/bill-splitter`, `/habbo-tracker` — **non-interactive** (a mobile app and a Telegram bot), so they can't demo in-browser. They compensate with a horizontally-scrolling screenshot filmstrip plus a "how it works" section. That asymmetry is deliberate: don't add "how it works" to the interactive pages (it reads as padding when the demo already explains itself), and don't strip it from these.

### Cursor
`cursor: none` is set globally; `#cursor-dot` and `#cursor-ring` are positioned with GSAP in `BaseLayout`. The `cursor-hover` body class drives the ring's hover state. Everything cursor-related is disabled on touch devices via `@media (hover: none), (pointer: coarse)`.

## Gotchas (each of these has bitten before)

- **Use `100dvh`, not `100vh`,** for anything that should fit one screen. `vh` assumes the mobile address bar is collapsed, so content gets pushed below the fold until the user scrolls once.
- **Astro scopes `<style>` to elements present at build time.** Markup injected at runtime via `innerHTML` (e.g. the home page's rotating word) never receives the scoping attribute, so rules targeting it silently stop matching. Wrap those selectors in `:global(...)`.
- **Inline styles beat external CSS.** To override anything React sets inline (the ChatBot), a stylesheet rule needs `!important`.
- **`justify-content: center` on a scrollable flex row** anchors the *scroll origin* at the centre of the overflowing content, so it opens scrolled halfway in with the first item cut off. Center only at widths where it fits; use `flex-start` where it overflows.
- **`position: sticky` only holds while its container is taller than it.** If the sticky element is the tallest thing in its row, it has no room to stick and just scrolls normally — so a long page still needs a second exit link at the bottom.
- **Avoid overshoot easings (`back.out`) next to a fixed hairline** — the element visibly renders larger than its settled size mid-animation and reads as a layout glitch.

## Deploying

`main` auto-deploys to production (`gosvindraj.com`) via Cloudflare Pages. Day-to-day work happens on `version2.0`; shipping is a fast-forward of `main` to it, then a push of both. Tag `pre-v3-main` marks the pre-redesign commit, so a rollback is `git push origin pre-v3-main:main --force`.

Note: `.github/workflows/` was deleted on purpose. GitHub Actions is disabled for this repo and Pages is not the host — Cloudflare deploys straight from the `main` branch. Don't re-add a deploy workflow.
