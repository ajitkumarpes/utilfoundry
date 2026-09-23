# UtilFoundry deployment

This Compose project runs every UtilFoundry surface behind Caddy, all built from this repository:

- `utilfoundry.com` → the landing page (`apps/web`)
- `pdf.utilfoundry.com` → the PDF frontend, with `/api/*` and `/actuator/*` forwarded to Spring (`apps/pdf`)
- `dev.utilfoundry.com` → the developer tools (`apps/developer`)
- `images.utilfoundry.com` → the image tools and their OCR and ML worker (`apps/images`)
- `storage.utilfoundry.com` → the private MinIO endpoint used by PDF signed URLs
- `admin.utilfoundry.com` → the feedback + visitor-analytics dashboard (`apps/admin`), fed by a widget on
  every other app and its own PostgreSQL database

The PDF backend and processor, PostgreSQL (both instances), Redis, MinIO and the image worker have no public
host ports; Caddy is the only public ingress.

## First deployment

1. Clone this repository on the server.
2. In `deploy/`, copy `.env.example` to `.env` and replace every `replace-with-*` value with a unique secret.
3. Point the apex and the `pdf`, `dev`, `images`, `storage` and `admin` subdomains at the server with DNS A/AAAA
   records.
4. From `deploy/`, run `docker compose build` followed by `docker compose up -d`.
5. Verify `https://utilfoundry.com` and each subdomain before opening traffic. `https://admin.utilfoundry.com/api/health`
   should answer `{"status":"ok","database":"ok"}`.

The admin service checks its configuration when it starts and exits with a clear log line if `ADMIN_PASSWORD` is
shorter than 12 characters, `ADMIN_SESSION_SECRET` is shorter than 32, either is still a placeholder, or they are
equal. `docker compose logs admin` shows which one.

Caddy obtains and renews certificates automatically. Keep ports 80/443 open, restrict SSH to trusted addresses,
and back up `caddy_data`, `postgres_data`, `admin_postgres_data`, and `minio_data`. Redis is a cache and does not
need backups.

## Testing on your own machine

Before DNS points at a server, you can run the whole stack locally under the real hostnames.

1. In `.env`, set `CADDY_LOCAL_CERTS=local_certs`. Caddy then issues certificates from its own local
   authority instead of Let's Encrypt, which cannot reach your machine.
2. Point the hostnames at your machine (asks for your admin password):

   ```bash
   sudo sh -c 'printf "\n# UtilFoundry local testing: remove before going live\n127.0.0.1 utilfoundry.com pdf.utilfoundry.com dev.utilfoundry.com images.utilfoundry.com storage.utilfoundry.com admin.utilfoundry.com\n" >> /etc/hosts'
   ```

3. Start the stack with `docker compose up -d`, then trust Caddy's local root certificate once:

   ```bash
   docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-local-root.crt
   sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain caddy-local-root.crt
   ```

4. Open `https://utilfoundry.com` and each subdomain.

Remove the `/etc/hosts` line when you are done, or the public site will be unreachable from this machine. Never set
`CADDY_LOCAL_CERTS` on the server.

## Updating one app

`docker compose up -d --build images` rebuilds and restarts only that service. The other service names are
`landing`, `developer`, `pdf-frontend`, `pdf-backend`, `pdf-processor` and `admin`.

For immutable releases, replace the `build` entries with pinned registry images after publishing and sign those
images.

## Sizing

The image app and its worker are each capped at 768 MB and the admin service at 512 MB. Together with the Spring Boot
backend, PostgreSQL, MinIO and the other Next.js apps, plan on at least 4 GB of RAM; 8 GB is comfortable. Add limits
for the remaining services once you have measured them under load.

## Secrets

Do not commit `.env`; it contains database, object-storage, and processor credentials. Rotate all values if they are
ever exposed. Changing `ADMIN_PASSWORD` or `ADMIN_SESSION_SECRET` and running `docker compose up -d admin` signs
every admin out. MinIO should remain private at the network layer even though signed object URLs use its public hostname.
