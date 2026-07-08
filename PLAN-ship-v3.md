# PLAN: ship-v3

Rank: 2 of 5 (the entire redesign is invisible until this happens; execute immediately after PLAN-fix-prod-api-endpoints so production does not launch with broken forms)

## Goal

The complete "ledger" redesign lives on the `version2.0` branch. The GitHub Actions deploy workflow (`.github/workflows/deploy.yml`) only triggers on pushes to `main`, so production (`https://gosvindraj.com`) is still serving the old purple site. `main` is a verified ancestor of `version2.0` (checked with `git merge-base --is-ancestor main version2.0`), so this is a clean fast-forward. Merge, push, watch the deploy, smoke-test.

## Exact files to touch

None. This is a git/ops task. The only repository change is branch pointers.

## Steps, in order

1. Update the remote URL (the repo was renamed on GitHub; pushes currently rely on a redirect):
   `git remote set-url origin https://github.com/Gosvindraj/gosh-personal-website.git`
   Verify: `git remote -v` shows the new URL for fetch and push.
2. Make sure the working tree is clean: `git status` shows nothing to commit. If PLAN files or pending work exist, commit or stash them first; never merge with a dirty tree.
3. Confirm fast-forward is still possible: `git merge-base --is-ancestor main version2.0 && echo ok`. Must print `ok`. If it does not, someone pushed to `main` since; stop and reconcile manually instead of forcing.
4. `git checkout main`
5. `git merge --ff-only version2.0` (fails loudly rather than creating a merge commit if anything is off; that is intended)
6. `git push origin main`
7. Watch the workflow: open the repo's Actions tab, confirm the "Deploy Astro to GitHub Pages" run for this push goes green (both `build` and `deploy` jobs).
8. `git checkout version2.0` so day-to-day work continues on the feature branch.
9. Smoke-test production (see acceptance criteria).

## Edge cases a weaker model would miss

- **The renamed repo redirect.** Pushes to the old `gosvindraj.github.io.git` URL still work via GitHub's redirect, but the redirect is not guaranteed forever and breaks the moment anyone creates a new repo with the old name. Updating the remote first (step 1) removes that time bomb.
- **`--ff-only`, not a merge commit and never a rebase.** `version2.0` is public/pushed; rebasing it would rewrite shared history. A fast-forward keeps `main`'s history linear and identical to what was already reviewed on `version2.0`.
- **Custom domain is configured in repo Settings, not in a CNAME file.** `public/` deliberately has no CNAME (Actions-based Pages deploys keep the domain in Settings > Pages). After the first deploy, verify Settings > Pages still shows `gosvindraj.com` with HTTPS enforced. If the domain ever drops, re-add it there; do not add a CNAME file to `public/`.
- **Search Console verification must survive.** `public/google802401f02db00914.html` ships in the build. After deploy, `https://gosvindraj.com/google802401f02db00914.html` must return 200, or Search Console ownership lapses.
- **Pushing `version2.0` never deploys anything.** The workflow's `on.push.branches` is `[main]` only. Do not "fix" a missing deploy by adding version2.0 to the workflow triggers.
- **First-visit preloader.** Production testers will see the counter preloader once per browser session (sessionStorage `intro-seen`). Seeing it once and not again is correct behavior, not a bug.

## Acceptance criteria

- Actions run for the `main` push is green.
- `https://gosvindraj.com` serves the new design: page `<title>` is "Gosvindraj | Home", the navbar shows the `gosh.` wordmark, the hero shows the rotating "i build ..." headline.
- All routes return 200 and render the new design: `/`, `/about`, `/projects`, `/blog`, `/blog/first-post`, `/contact`, `/snake-game`, `/crypto-api`, `/anomaly-detector`, plus a made-up URL renders the new 404 page.
- `https://gosvindraj.com/google802401f02db00914.html` returns 200.
- `https://gosvindraj.com/sitemap-index.xml` returns 200 and references `gosvindraj.com` URLs.
- Contact form and anomaly detector work in production (depends on PLAN-fix-prod-api-endpoints being merged first).
- `git log main -1` and `git log version2.0 -1` point at the same commit hash.
