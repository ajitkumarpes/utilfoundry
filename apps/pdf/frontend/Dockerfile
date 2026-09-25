FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Baked in at build time: Next.js inlines NEXT_PUBLIC_* during `next build`, and the API
# origin also goes into the Content-Security-Policy. deploy/docker-compose.yml sets all four.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8091
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ARG NEXT_PUBLIC_PARENT_URL=http://localhost:3001
ENV NEXT_PUBLIC_PARENT_URL=${NEXT_PUBLIC_PARENT_URL}
ARG NEXT_PUBLIC_ADMIN_URL=https://admin.utilfoundry.com
ENV NEXT_PUBLIC_ADMIN_URL=${NEXT_PUBLIC_ADMIN_URL}
# The build cache only helps the next build, not the running server.
RUN npm run build && rm -rf .next/cache

FROM deps AS prod-deps
RUN npm prune --omit=dev

# Only what `next start` needs: no source, no dev dependencies, no test tooling.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
# Read again by `next start`: settings such as poweredByHeader apply at run time, not build time.
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=prod-deps /app/node_modules ./node_modules
EXPOSE 3000
USER node
# exec form: Next runs as PID 1, so `docker stop` reaches it and in-flight requests finish.
CMD ["node_modules/.bin/next", "start"]
