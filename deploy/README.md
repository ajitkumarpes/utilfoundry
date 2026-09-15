# UtilFoundry deployment

This Compose project runs every UtilFoundry surface behind Caddy, all built from this repository:

- `utilfoundry.com` → the landing page (`apps/web`)
- `pdf.utilfoundry.com` → the PDF frontend, with `/api/*` and `/actuator/*` forwarded to Spring (`apps/pdf`)
- `dev.utilfoundry.com` → the developer tools (`apps/developer`)
- `images.utilfoundry.com` → the image tools and their OCR and ML worker (`apps/images`)
- `storage.utilfoundry.com` → the private MinIO endpoint used by PDF signed URLs

The PDF backend and processor, PostgreSQL, Redis, MinIO and the image worker have no public host ports; Caddy is
the only public ingress.

## First deployment

1. Clone this repository on the server.
2. In `deploy/`, copy `.env.example` to `.env` and replace every `replace-with-*` value with a unique secret.
3. Point the apex and the `pdf`, `dev`, `images` and `storage` subdomains at the server with DNS A/AAAA records.
4. From `deploy/`, run `docker compose build` followed by `docker compose up -d`.
5. Verify `https://utilfoundry.com` and each subdomain before opening traffic.

Caddy obtains and renews certificates automatically. Keep ports 80/443 open, restrict SSH to trusted addresses,
and back up `caddy_data`, `postgres_data`, and `minio_data`. Redis is a cache and does not need backups.

## Updating one app

`docker compose up -d --build images` rebuilds and restarts only that service. The other service names are
`landing`, `developer`, `pdf-frontend`, `pdf-backend` and `pdf-processor`.

For immutable releases, replace the `build` entries with pinned registry images after publishing and sign those
images.

## Sizing

The image app and its worker are each capped at 768 MB. Together with the Spring Boot backend, PostgreSQL, MinIO
and four Next.js apps, plan on at least 4 GB of RAM; 8 GB is comfortable. Only the image services set memory limits
today; add limits for the others once you have measured them under load.

## Secrets

Do not commit `.env`; it contains database, object-storage, and processor credentials. Rotate all values if they are
ever exposed. MinIO should remain private at the network layer even though signed object URLs use its public hostname.
