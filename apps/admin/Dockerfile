FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No secrets or database needed here: every page is rendered on request, and the database
# pool and configuration checks only run when the server starts. The build cache is only
# useful to the next build, not to the running server.
RUN npm run build && rm -rf .next/cache

FROM deps AS prod-deps
RUN npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
COPY --from=builder /app/.next ./.next
# Read again by `next start`: settings such as poweredByHeader apply at run time, not build time.
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/db ./db
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=prod-deps /app/node_modules ./node_modules
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1
# Migrate first so the service never serves against a schema it hasn't applied yet —
# same on-boot ordering apps/pdf/backend gets for free from Flyway. `exec` hands PID 1 to
# Next, so `docker stop` reaches it and in-flight requests finish instead of being killed.
CMD ["sh", "-c", "node scripts/migrate.mjs && exec node_modules/.bin/next start"]
