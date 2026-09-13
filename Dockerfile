FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
WORKDIR /app
COPY . .
# Next.js permits an application without static assets, but a multi-stage
# image still needs the directory to exist for the runtime copy below.
RUN mkdir -p public
RUN npm run build

FROM deps AS prod-deps
RUN npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=prod-deps /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "start"]
