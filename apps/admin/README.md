# UtilFoundry Admin

The feedback + visitor analytics backend shared by all four UtilFoundry apps
(`web`, `developer`, `images`, `pdf`). A `FeedbackWidget` in each of those apps posts
to this service's public API; this app's own `/admin` pages, behind a shared
password, are where that data gets reviewed.

- `POST /api/feedback`, `POST /api/visit` — public, CORS-restricted to the four
  UtilFoundry origins, rate-limited. See `lib/cors.ts` and `lib/rate-limit.ts`.
- `/admin/*`, `/api/admin/*` — behind a password login (`middleware.ts`), session
  cookie signed with `ADMIN_SESSION_SECRET`.
- Postgres via the lightweight `postgres` driver (no ORM) — schema in
  `db/migrations/`, applied by `scripts/migrate.mjs` on every `npm run dev`
  (as `predev`) and as the first step of the Docker image's `CMD`.
- Visitor location comes from `geoip-lite`'s bundled offline database — no visitor
  IP is ever sent to a third party, and none is stored; only the country/region/city
  it resolves to.

## Local development

```bash
npm install
cp .env.example .env.local   # then edit ADMIN_PASSWORD / ADMIN_SESSION_SECRET
docker compose up -d         # starts a local Postgres on 127.0.0.1:5434
npm run dev                  # runs pending migrations, then starts on :3000
```

Then point a consuming app's `NEXT_PUBLIC_ADMIN_URL` at `http://localhost:3000`
(or whichever port you run this on — the other apps also default to 3000, so run
this one on a different port locally, e.g. `npm run dev -- -p 3099`).

## Tests

```bash
npm run lint
npm run typecheck
npm test
```
