# UtilNexa deployment

This Compose project routes the three independent applications through Caddy:

- `utilnexa.com` → the landing page
- `pdf.utilnexa.com` → the PDF frontend image
- `dev.utilnexa.com` → the developer-tools image

## First deployment

1. Copy `.env.example` to `.env` and set `ACME_EMAIL`.
2. Set `PDF_IMAGE` to the published PDF frontend image. The existing PDF project is intentionally not modified by this deployment scaffold.
3. Publish the developer-tools image or set `DEV_IMAGE` to the image registry location.
4. Point the apex and both subdomains to the server IP with DNS A/AAAA records.
5. Run `docker compose up -d`.

Caddy obtains and renews certificates automatically. Keep ports 80/443 open, restrict SSH to trusted addresses, and back up the Caddy volumes.

The PDF and developer images must listen on port 3000 inside their containers. If either image uses another internal port, change the corresponding `reverse_proxy` target and health check before deployment.

Before production, route the PDF frontend's API base URL to the public PDF backend (for example, `https://pdf.utilnexa.com` with Caddy forwarding `/api/*` to the Spring backend). The existing PDF repository currently owns the backend, database, Redis, MinIO, and processor services; this landing stack deliberately does not duplicate those stateful services.
