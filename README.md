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


## Optional Supabase account backend (in progress)

Cloud support is implemented but **not activated** until a Supabase project is created and configured. Without it, VELO continues to operate exactly as before in local browser storage.

1. Create a Supabase project (the Free plan is suitable for initial use).
2. Apply `supabase/migrations/20261118000000_initial_backend.sql` in the SQL Editor. It creates per-user athlete state, profiles, ride activity records, and a server-only future integration table with Row Level Security.
3. In Supabase Authentication settings, enable email sign-in; add `https://velo-training.vercel.app` to allowed redirect URLs and set the site URL accordingly.
4. Add these **Production** environment variables in the Vercel project `velo-training`:
   - `SUPABASE_URL` = your Supabase project URL
   - `SUPABASE_PUBLISHABLE_KEY` = your **publishable (anon)** key; never a service_role or secret key
5. Redeploy GitHub `main` to include the account UI.
6. Sign in with an email link. The first sign-in can explicitly save the existing browser's calendar, workouts, FTP, race choices, travel blocks, and imported ride summaries. Other signed-in browsers then load the cloud plan.

### How syncing works

- User information is saved in `athlete_state` and only readable/writeable to its owning authenticated user under database RLS.
- Writes use optimistic revision checks. If another browser has saved a different version, a conflicting save stops rather than silently overwriting.
- Data is not automatically uploaded before explicit account initialization.
- Per-user OAuth provider credentials will be added later using server-side handling and encrypted storage, not public browser code.
- Supabase credentials are **not required** for anonymous read-only browsing of the current app. Existing browser-local functionality remains available without cloud configuration.
- The currently implemented cloud state uses one per-user JSON document to safely migrate the existing code. We can normalize workouts, races, and trips into separate tables as features mature.

### Developer checks

```bash
npm install
npm run build
```
