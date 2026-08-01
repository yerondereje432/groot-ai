# Dockerfile for the ingestion worker.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/ingestion-worker/package*.json apps/ingestion-worker/
COPY packages/shared-types/package*.json packages/shared-types/
RUN npm ci --ignore-scripts

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace apps/ingestion-worker

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/ingestion-worker/dist apps/ingestion-worker/dist
COPY --from=build /app/packages/shared-types/dist packages/shared-types/dist
CMD ["node", "apps/ingestion-worker/dist/main.js"]
