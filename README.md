# Golf Notebook

A mobile-first, local golf improvement tracker for practice and nine-hole rounds at Hermanus Golf Club. It opens on Today and is designed for quick use on an iPhone.

## Run locally

```bash
npm install
npm run dev
```

Run the checks and production build with:

```bash
npm test
npm run build
```

## Storage and privacy

The tracker is local-first. It stores a versioned, SQLite-compatible record model in the browser using IndexedDB, with localStorage as a fallback when IndexedDB is unavailable. The browser database contains range readings, rounds, holes, handicap history and weekly plans. The seeded readings are real starter data supplied for this tracker; no fictional rounds or club distances are added.

Use **Progress > Export JSON** for a complete backup. Restore asks for explicit replacement and validates the schema before importing. This backup is the portable database representation; future migrations can use the `schemaVersion` field without discarding data.

GitHub Pages is static hosting. It cannot run a server-side SQLite file or provide authenticated writes. This app does not claim to sync between devices. Cross-device sync would require a backend later.

A private GitHub source repository and a public GitHub Pages website are different things. A private repository does not make its deployed static website private. Do not enable the Pages workflow until you have decided whether this client-side tracker should be publicly reachable. Even when the site is public, the browser data is not included in the repository and remains local to each browser. Genuine authenticated private hosting would require an access-controlled host and backend.

## Architecture

- React + TypeScript + Vite
- Versioned browser schema shaped around `clubs`, `range_sessions`, `range_readings`, `rounds`, `round_holes` and `weekly_plans`
- IndexedDB persistence with localStorage fallback
- Deterministic median, mishit exclusion and category recommendation rules
- JSON export and validated restore
- Installable manifest and lightweight service worker for static offline assets
- GitHub Pages workflow in `.github/workflows/deploy.yml`

All distances are entered, stored and displayed in metres. Typical carry is the median of usable readings, never the longest shot. Fewer than five usable readings are labelled `early estimate`.
