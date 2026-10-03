# Multi-stage Dockerfile for the Next.js 14 (App Router) web app.
#
# NOTE: this was previously written for a Vite-style static SPA (serving
# `apps/web/dist` via nginx), which is NOT what `apps/web` actually is — it's
# a Next.js app with dynamic routes (`/chat/[sessionId]`, SSR-capable pages),
# so `next build` never produces a `dist/` directory and this image would
# have failed to build/run. Next.js's own "standalone" output mode
# (`output: 'standalone'` in next.config.js) is the correct equivalent: a
# self-contained Node server with only the dependencies it actually uses.
#
# Per spec §29: containerization.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json apps/web/
COPY packages/shared-types/package*.json packages/shared-types/
RUN npm ci --ignore-scripts

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace packages/shared-types
RUN npm run build --workspace apps/web

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# The standalone output already bundles its own minimal node_modules —
# nothing from the `deps`/`build` stage's full node_modules is needed here.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
