# Holmes-Cleanup Web

Static web app for the Holmes-Cleanup privacy scanner. Built with Vite + vanilla JS.

## Why this exists

The CLI is great for developers, but most people aren't developers. This web app lets anyone check their privacy exposure in 10 seconds without installing anything — and **all computation runs in their browser**, never on a server.

## Run locally

```bash
cd web
npm install
npm run dev
# → open http://localhost:5173
```

## Build for production

```bash
npm run build
# → dist/ contains the static site
```

## Deploy

Deployed automatically to GitHub Pages via `.github/workflows/deploy-web.yml` on every push to `main` that touches this folder.

Production URL: `https://ramboxie.github.io/holmes-cleanup/`

## How to audit that it's safe

1. Open DevTools → Network tab
2. Enter your name and scan
3. Confirm **zero** network requests fire during/after the scan
4. The `broker-catalog.json` and `.mjs` scanner modules are all bundled statically

The scanner modules under `../src/scanner/` are the **same code** the CLI uses. No separate web logic; the only web-specific code is the UI (HTML/CSS + orchestration in `src/main.js`).

## Architecture

```
web/
├── index.html            — Single-page app shell
├── src/
│   ├── main.js           — Entry: bind form, orchestrate render
│   ├── styles.css        — Dark theme, system fonts only
│   └── lib/
│       ├── scan-runner.js    — Adapter around shared scanner modules
│       └── svg-to-png.js     — Canvas-based SVG→PNG for share card download
└── public/
    ├── favicon.svg
    └── CNAME              — (empty; add custom domain here if buying one)
```

Imports from monorepo root (via Vite aliases):
- `@scanner/scan-engine.mjs` — shared scan logic (isomorphic)
- `@scanner/share-card.mjs` — shared SVG share card renderer
- `@catalog` — `src/adapters/brokers/config/broker-catalog.json`

## What this web app does NOT do

- **No opt-out automation** — users must click each broker's opt-out URL themselves (with the CLI's browser-assisted flow, or manually). Opt-out requires captcha and email verification, which the web can't streamline further than a direct link.
- **No persistence** — refresh the page and your scan is gone. Intentional: no localStorage, no cookies, nothing to leak.
- **No accounts** — no sign-up, no login, no tracking.
- **No analytics** — not even Plausible/Umami. Zero telemetry.
