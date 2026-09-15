# Production deployment

Production runs from the sibling `utilnexa-web/deployment` Compose project. That stack builds this
repository's frontend, Spring backend, and isolated processor alongside PostgreSQL, Redis, and MinIO.

Set `SPRING_PROFILES_ACTIVE=docker,prod` for the backend. The production profile intentionally disables
Swagger and detailed actuator responses, requires credentials through environment variables, and only
allows the configured `CORS_ALLOWED_ORIGINS` value.

Before the first release:

1. Replace every `replace-with-*` value in `utilnexa-web/deployment/.env` with a generated secret.
2. Fill the legal contact and jurisdiction placeholders in the frontend legal pages.
3. Configure DNS for `utilfoundry.com`, `pdf.utilfoundry.com`, `dev.utilfoundry.com`, and `storage.utilfoundry.com`.
4. Back up the PostgreSQL and MinIO volumes and test restoring them.
5. Run the repository checks (`mvn verify`, frontend lint/typecheck/build/audit, and `make processor-test`).

Never expose PostgreSQL, Redis, or MinIO console ports directly to the Internet. Caddy is the only public
entry point, and MinIO object access should happen through short-lived signed URLs.
