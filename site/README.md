# getcatalog.app

Astro landing page for tooldex. Deployed to GitHub Pages on push to `main`
(see `.github/workflows/deploy-site.yml`).

## Local

```bash
cd site
npm install
npm run dev      # local preview
npm run build    # static output in dist/
npm test         # star-count logic tests
```

## One-time setup

1. **Pages source:** repo Settings → Pages → Build and deployment → Source = **GitHub Actions**.
2. **Custom domain:** the `CNAME` file (`site/public/CNAME`) sets `getcatalog.app`.
   At Spaceship DNS add the apex A-records and the `www` CNAME:
   - `A  @  185.199.108.153`
   - `A  @  185.199.109.153`
   - `A  @  185.199.110.153`
   - `A  @  185.199.111.153`
   - `CNAME  www  <user-or-org>.github.io.`
   Then in repo Settings → Pages, set the custom domain to `getcatalog.app` and enable "Enforce HTTPS" once the cert issues.
3. **Analytics (optional but recommended):** create a Cloudflare Web Analytics site,
   copy its token, and add a repo **variable** `PUBLIC_CF_ANALYTICS_TOKEN` (Settings →
   Secrets and variables → Actions → Variables). The beacon is omitted when unset.
4. **Star count / releases:** `src/config.ts` holds `REPO_OWNER`/`REPO_NAME`. The build
   uses the Action's `GITHUB_TOKEN` to avoid API rate limits; the Download button points
   at `releases/latest` (resolves to the repo until a release is cut).

## Before launch (TODO)

- Add a designed **1200×630 `og.png`** to `site/public/` (the `og:image` tag already points at it).
- Cut a macOS release so the Download button resolves to a `.dmg`.
- Confirm `REPO_OWNER`/`REPO_NAME` in `src/config.ts` match the final repo.
