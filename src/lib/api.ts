/* single origin for the serverless endpoints (Cloudflare Pages
   functions). the site itself is static GitHub Pages, so relative
   /api/* paths 404 in production. */
export const API_BASE = "https://gosvindraj-github-io.pages.dev";
