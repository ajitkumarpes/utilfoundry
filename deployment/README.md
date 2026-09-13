# UtilNexa deployment

This Compose project runs the three UtilNexa surfaces and the complete PDF runtime behind Caddy:

- `utilnexa.com` → the landing page
- `pdf.utilnexa.com` → the PDF frontend, with `/api/*` and `/actuator/*` forwarded to Spring
- `dev.utilnexa.com` → the developer-tools application
- `storage.utilnexa.com` → the private MinIO endpoint used by PDF signed URLs

The PDF backend, processor, PostgreSQL, Redis, and MinIO services are included in this stack. No
public host ports are exposed for those services; Caddy is the only public ingress.

## First deployment

1. Check out `utilnexa-web`, `pdf-platform`, and `developer-tools` as sibling directories.
2. Copy `.env.example` to `.env` and replace every `replace-with-*` value with a unique secret.
3. Point the apex and `pdf`, `dev`, and `storage` subdomains to the server IP with DNS A/AAAA records.
4. Build and start the stack with `docker compose build` followed by `docker compose up -d`.
5. Verify `https://utilnexa.com`, `https://pdf.utilnexa.com`, and `https://dev.utilnexa.com` before opening traffic.

Caddy obtains and renews certificates automatically. Keep ports 80/443 open, restrict SSH to trusted addresses,
and back up `caddy_data`, `postgres_data`, and `minio_data`. Redis is a cache and does not need backups.

The compose file builds both sibling application repositories so a single server checkout is enough. For immutable
releases, replace the `build` entries with pinned registry images after publishing and sign those images.

Do not commit `.env`; it contains database, object-storage, and processor credentials. Rotate all values if they are
ever exposed. MinIO should remain private at the network layer even though signed object URLs use its public hostname.
