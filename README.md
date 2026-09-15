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

The tracker uses Supabase Auth and a versioned JSON record in a Supabase `user_data` table when the Supabase environment variables are present. Each account owns its own row through Row Level Security, so the same account can be used on a computer and phone. IndexedDB/localStorage remain an offline fallback. The seeded readings are real starter data supplied for this tracker; no fictional rounds or club distances are added.

Use **Progress > Export JSON** for a complete backup. Restore asks for explicit replacement and validates the schema before importing. This backup is the portable database representation; future migrations can use the `schemaVersion` field without discarding data.

GitHub Pages is static hosting. It serves the frontend only; Supabase provides authentication and synced writes. Cross-device sync requires signing into the same Supabase account on each device.

A private GitHub source repository and a public GitHub Pages website are different things. A private repository does not make its deployed static website private. Do not enable the Pages workflow until you have decided whether this client-side tracker should be publicly reachable. Even when the site is public, the browser data is not included in the repository and remains local to each browser. Genuine authenticated private hosting would require an access-controlled host and backend.

## Architecture

- React + TypeScript + Vite
- Versioned browser schema shaped around `clubs`, `range_sessions`, `range_readings`, `rounds`, `round_holes` and `weekly_plans`
- Supabase Auth + RLS-protected `user_data` sync
- IndexedDB persistence with localStorage fallback when Supabase is unavailable
- Deterministic median, mishit exclusion and category recommendation rules
- JSON export and validated restore
- Installable manifest and lightweight service worker for static offline assets
- GitHub Pages workflow in `.github/workflows/deploy.yml`

All distances are entered, stored and displayed in metres. Typical carry is the median of usable readings, never the longest shot. Fewer than five usable readings are labelled `early estimate`.

## Supabase setup

1. Create a Supabase project.
2. In **Project Settings > API Keys**, copy the Project URL and the Publishable key (older dashboards call it `anon public`). Never use the `service_role` key in this app.
3. In **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql). This creates the table and RLS policies.
4. In **Authentication > Providers**, enable Email.
5. For local development, create `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

6. In GitHub, open **Settings > Secrets and variables > Actions** and add repository secrets with the same two names. The Pages build and the weekly keepalive workflow use them.

The keepalive workflow in `.github/workflows/supabase-keepalive.yml` sends an external request every three days and can also be run manually from GitHub Actions. It is intended to prevent inactivity pausing on the free tier; it is not a substitute for authentication or RLS.
