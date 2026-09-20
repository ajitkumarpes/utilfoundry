# UtilFoundry

One repository for every UtilFoundry app and the stack that serves them.

| App | Folder | Stack | Public URL |
| --- | --- | --- | --- |
| Landing page | `apps/web` | Next.js | `utilfoundry.com` |
| PDF platform | `apps/pdf` | Next.js frontend, Spring Boot backend, Python processor, PostgreSQL, Redis, MinIO | `pdf.utilfoundry.com` |
| Developer tools | `apps/developer` | Next.js | `dev.utilfoundry.com` |
| Image tools | `apps/images` | Next.js and a Python OCR/ML worker | `images.utilfoundry.com` |
| Admin | `apps/admin` | Next.js, PostgreSQL | `admin.utilfoundry.com` |

## Working on one app

Each app is self-contained, with its own `package.json`, lockfile, Dockerfile and README:

```bash
cd apps/images
npm install
npm run dev
```

The Next.js dev servers all default to port 3000, so run one at a time or pick a port, for example
`npm run dev -- -p 3021`. Apps with backing services keep their own Compose file for local development:

- `apps/pdf`: `docker compose up` (or `make up`) starts PostgreSQL, Redis, MinIO, the backend, the processor and the
  frontend. Its frontend is published on 127.0.0.1:3000.
- `apps/images`: `docker compose up` starts the app on 127.0.0.1:3021 with its worker.
- `apps/admin`: `docker compose up` starts only its PostgreSQL database (on 127.0.0.1:5434); run the app itself with
  `npm run dev`, same as any other app here.

## Running everything

`deploy/` holds the production stack: Caddy in front of every app, built from this repository. See
[deploy/README.md](deploy/README.md).

```bash
cd deploy
cp .env.example .env   # then replace every replace-with-* value
docker compose up -d --build
```

## CI

`.github/workflows` has one workflow per app. Each runs only when its own folder changes, and `deploy.yml` checks the
Compose and Caddy configuration.

## History

The apps began as separate repositories (`utilnexa-web`, `pdf-platform`, `developer-tools` and `image-tools`). Each
was merged in under `apps/` with its full commit history.
