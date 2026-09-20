FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Links to the sibling apps and the contact channel are baked in at build time.
ARG NEXT_PUBLIC_PDF_URL
ARG NEXT_PUBLIC_DEVELOPER_URL
ARG NEXT_PUBLIC_IMAGES_URL
ARG NEXT_PUBLIC_CONTACT_URL
ARG NEXT_PUBLIC_ADMIN_URL
ENV NEXT_PUBLIC_PDF_URL=$NEXT_PUBLIC_PDF_URL \
    NEXT_PUBLIC_DEVELOPER_URL=$NEXT_PUBLIC_DEVELOPER_URL \
    NEXT_PUBLIC_IMAGES_URL=$NEXT_PUBLIC_IMAGES_URL \
    NEXT_PUBLIC_CONTACT_URL=$NEXT_PUBLIC_CONTACT_URL \
    NEXT_PUBLIC_ADMIN_URL=$NEXT_PUBLIC_ADMIN_URL
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
