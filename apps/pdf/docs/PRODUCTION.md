# Production deployment

Production runs from this repository's [`deploy/`](../../../deploy/README.md) Compose project. That stack
builds this app's frontend, Spring backend and isolated processor alongside PostgreSQL, Redis and
MinIO (the Chainguard build of it; MinIO itself no longer publishes images).

The backend runs with `SPRING_PROFILES_ACTIVE=docker,prod`. The production profile disables Swagger and
the ops dashboard, limits the actuator to `health` and `info` without details, requires credentials
through environment variables, and only allows the configured `CORS_ALLOWED_ORIGINS` value. It reports
healthy once the database, Redis, object storage and processor all answer (`/actuator/health/readiness`),
and Caddy starts only after that. The processor sits on an internal network: only the backend reaches
it, and it cannot reach the internet, since LibreOffice and Ghostscript open untrusted documents.

Before the first release:

1. Replace every `replace-with-*` value in `deploy/.env` with a generated secret.
2. Configure DNS for `utilfoundry.com` and the `pdf`, `dev`, `images`, `admin` and `storage` subdomains.
3. Back up the PostgreSQL and MinIO volumes and test restoring them.
4. Run the repository checks: `mvn verify`, `make processor-test`, the frontend's lint, typecheck,
   coverage, build and audit, and the end-to-end round trip of every tool (see the app README, "Tests").
   CI runs all of these on every change to `apps/pdf`.

Never expose PostgreSQL, Redis, or MinIO console ports directly to the Internet. Caddy is the only public
entry point, and MinIO object access should happen through short-lived signed URLs.
