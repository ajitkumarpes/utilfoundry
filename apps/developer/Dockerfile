FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js permits an application without static assets, but a multi-stage
# image still needs the directory to exist for the runtime copy below.
RUN mkdir -p public
# Links to the sibling apps and the contact channel are baked in at build time.
ARG NEXT_PUBLIC_PARENT_URL
ARG NEXT_PUBLIC_PDF_URL
ARG NEXT_PUBLIC_IMAGES_URL
ARG NEXT_PUBLIC_CONTACT_URL
ARG NEXT_PUBLIC_ADMIN_URL
ENV NEXT_PUBLIC_PARENT_URL=$NEXT_PUBLIC_PARENT_URL \
    NEXT_PUBLIC_PDF_URL=$NEXT_PUBLIC_PDF_URL \
    NEXT_PUBLIC_IMAGES_URL=$NEXT_PUBLIC_IMAGES_URL \
    NEXT_PUBLIC_CONTACT_URL=$NEXT_PUBLIC_CONTACT_URL \
    NEXT_PUBLIC_ADMIN_URL=$NEXT_PUBLIC_ADMIN_URL
# The build cache only helps the next build, not the running server.
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
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=prod-deps /app/node_modules ./node_modules
EXPOSE 3000
USER node
# exec form: Next runs as PID 1, so `docker stop` reaches it and in-flight requests finish.
CMD ["node_modules/.bin/next", "start"]
