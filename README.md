# VELO — Cycling Training Studio

Cycling training calendar covering November 2026 through June 2027.

## Development

Run `npm run build`, then open `dist/index.html` in a browser. The site is a self-contained static page (no dependencies or backend).

The original deployed HTML was faithfully imported in 17 sequential UTF-8 source fragments in `source-parts/`; `build.mjs` concatenates them without modification. This preserves the existing production experience. A future cleanup can consolidate those parts into a normal `index.html`.

## Deployment

Connected to Vercel via GitHub. Pushing to `main` triggers a production build.

## Data

Changes are saved to the browser's localStorage. There is no account login or cross-device sync. Use the in-app Export option for backups.
