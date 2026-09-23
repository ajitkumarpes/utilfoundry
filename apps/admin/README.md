# UtilFoundry Admin

Feedback and visitor analytics for the four UtilFoundry sites (`web`, `developer`, `images`, `pdf`).
A feedback widget and a page-view beacon on each site post to this service's public API; the `/admin`
dashboard, behind one shared password, is where the team reads it.

| Path | Who calls it | Protection |
| --- | --- | --- |
| `POST /api/feedback` | the feedback widget on every site | allowed origins only, JSON only, 8 KB body cap, 10/min per address |
| `POST /api/visit` | the page-view beacon on every site | allowed origins only, JSON only, 4 KB body cap, 60/min per address, bots ignored |
| `GET /api/health` | Docker, uptime monitors | public; `200 {"status":"ok","database":"ok"}` or `503` |
| `/admin`, `/api/admin/*` | people on the team | signed session cookie; admin API calls must come from the dashboard itself |

## What the dashboard shows

- **Overview**: visits, unique visitors, feedback received, average rating and the review backlog for the
  last 7, 30 or 90 days, each compared with the period before; visits per day (with a table view);
  top countries, feedback by type, the most-discussed tools and the latest feedback.
- **Feedback**: the inbox. Search across messages, tools and pages; filter by app, type, status and rating
  (filters live in the URL, so a view can be bookmarked or shared); mark items reviewed or new; delete with a
  second confirmation; export the filtered list as CSV.
- **Visitors**: visits by country, site, page, referrer, device and browser.

Days are UTC days. Times are shown in each viewer's own timezone.

## Security and privacy

- **Sign-in**: one shared password (`ADMIN_PASSWORD`). A successful sign-in sets a `__Host-` cookie that is
  HttpOnly, Secure, SameSite=Lax and signed with a key derived from `ADMIN_SESSION_SECRET` *and* the password,
  so changing either signs everyone out. Sessions last 12 hours. Attempts are limited per address (10/min)
  and across everyone (60/min), and every wrong password waits 400 ms.
- **Every page and admin API call** is checked by `proxy.ts`, and the dashboard layout checks the session again.
  Admin API calls from another site are refused (CSRF), whatever cookies they carry.
- **Pages** carry a per-request nonce Content-Security-Policy (no inline scripts except the nonce'd theme
  script), `frame-ancestors 'none'`, HSTS and `noindex`.
- **Stored content** is treated as untrusted: only http(s) page links are rendered as links, text is escaped by
  React, and CSV cells that a spreadsheet would run as formulas are defused.
- **Visitors**: the IP address is used only to look up a country, region and city in the offline `geoip-lite`
  database and is never stored or sent anywhere. Paths are stored without their query string and referrers
  as a host name only (`google.com`), so search terms and tokens in URLs never reach the database. A
  first-party `uf_vid` cookie (random ID, one year) counts unique visitors. Page views older than
  `VISIT_RETENTION_DAYS` (default 395) are deleted daily; feedback stays until someone deletes it.

## Configuration

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | `postgres://…` |
| `ADMIN_PASSWORD` | yes | production: 12+ characters, not a placeholder |
| `ADMIN_SESSION_SECRET` | yes | production: 32+ characters (`openssl rand -hex 32`), different from the password |
| `CORS_ALLOWED_ORIGINS` | production | comma-separated `https://` origins of the four sites |
| `VISIT_RETENTION_DAYS` | no | default 395 |
| `RATE_LIMIT_FEEDBACK_PER_MINUTE`, `RATE_LIMIT_VISIT_PER_MINUTE`, `RATE_LIMIT_LOGIN_PER_MINUTE`, `RATE_LIMIT_LOGIN_GLOBAL_PER_MINUTE` | no | defaults 10, 60, 10, 60 |

In production the server checks these at start-up (`lib/env.ts`, run from `instrumentation.ts`) and refuses to
start, naming the variable, if one is missing or weak. Nothing is needed at build time.

Rate limits are kept in memory, which suits the single container this runs as. They key on the first
`X-Forwarded-For` address, which Caddy sets in `deploy/`; do not expose the container without a proxy that
does the same.

## Operations

- **Deploy**: part of the `deploy/` Compose project as the `admin` service, with its own `admin-postgres`
  database. `docker compose up -d --build admin` rebuilds and restarts only this service.
- **Migrations** run automatically before the server starts (`scripts/migrate.mjs`, SQL in `db/migrations/`).
  They are forward-only and idempotent, and a Postgres advisory lock makes it safe for two containers to start
  at once. Add a new numbered file for any change; never edit one that has shipped.
- **Health**: `GET /api/health`. The container is healthy only while the database answers within 3 seconds.
- **Logs** (`docker compose logs admin`): errors and the daily clean-up are one JSON object per line; a
  configuration problem stops the container with a `Refusing to start: …` line naming the variable.
- **Backups**: back up the `admin_postgres_data` volume, e.g. a nightly
  `docker compose exec admin-postgres pg_dump -U "$ADMIN_POSTGRES_USER" admin_platform`.
- **Rotating the password or secret**: change the value in `deploy/.env` and run
  `docker compose up -d admin`. Everyone signed in is signed out.

## Local development

```bash
npm install
cp .env.example .env.local   # then set ADMIN_PASSWORD and ADMIN_SESSION_SECRET
docker compose up -d         # Postgres on 127.0.0.1:5434
npm run dev -- -p 3099       # runs pending migrations first
npm run db:seed              # optional: 90 days of made-up visits and feedback (local databases only)
```

The other apps run on port 3000 by default, hence `-p 3099`. Point a site's `NEXT_PUBLIC_ADMIN_URL` at
`http://localhost:3099` to send its feedback and page views here.

## Tests

```bash
npm run lint
npm run typecheck
npm test                     # unit tests; the database suite runs too when TEST_DATABASE_URL is set
npm run build && npm run test:e2e
```

- `TEST_DATABASE_URL` and `E2E_DATABASE_URL` must point at databases the suites may **wipe**. With the local
  Compose Postgres: `createdb` `admin_test` and `admin_e2e` (for example
  `docker compose exec postgres createdb -U admin_user admin_e2e`); the e2e suite uses
  `postgres://admin_user:admin_password@127.0.0.1:5434/admin_e2e` by default.
- The browser suite (`e2e/`) runs the production build in Chromium, Firefox and WebKit, including
  accessibility scans in both themes. WebKit only keeps Secure cookies over https, so its run goes through a
  throwaway local TLS proxy (`e2e/https-proxy.mjs`, needs `openssl`). Install the browsers once with
  `npx playwright install`.
- CI (`.github/workflows/admin.yml`) runs all of it against a Postgres service.
