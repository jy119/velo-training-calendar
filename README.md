# VELO — Cycling Training Studio

Live application: https://velo-training.vercel.app

A flexible cycling training calendar for the 2026–27 season. Changes committed to `main` deploy automatically through GitHub → Vercel.

## V2 features

- 28 dated events from the [2027 NCNCA calendar](https://ncnca.org/events/) (reviewed November 17, 2026). All races start as **Considering**, so no race is assumed to be on the user's schedule.
- Each race can be marked **Considering**, **B**, **A**, or **Skipping**. A and B priorities affect the suggested training plan, not the underlying workout data.
- Optional **travel blocks**, with **No bike**, **Limited**, **Bike available**, or **Unknown**. Travel dates are imported privately into the user's browser, never committed to this public repo.
- **Strava CSV imports** for actual cycling activities and transparent duration-coverage comparisons. This is NOT a direct Strava API integration or automatic sync.
- Training calendar extended through September 2027.

## Private data and storage

User activity and travel data are stored in browser `localStorage` only. They are not available across browsers or devices, and clearing browser storage erases them. The app has no authentication or cloud database. Avoid committing personal calendar exports or activity files to this public repository.

## Implementation

The V1 source was preserved as 17 ordered UTF-8 fragments in `source-parts/`.
`build.mjs` concatenates these and adds `enhancements.css` / `enhancements.js`, then emits `dist/index.html` and `races-2027.json`. Run:

```bash
npm run build
```

Vercel builds with `npm run build` and publishes `dist`.

The calendar/race list is a snapshot, not an automatically refreshed NCNCA feed. Dates may change. A future live Strava integration would require a server-side OAuth implementation, credentials, token storage, and user authorization. Do not expose a Strava client secret in browser code.
