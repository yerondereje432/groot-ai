# Dockerfile for the ingestion worker.
FROM node:20-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY apps/ingestion-worker/package*.json apps/ingestion-worker/
COPY packages/shared-types/package*.json packages/shared-types/
RUN npm ci --ignore-scripts

FROM node:20-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace packages/shared-types
RUN npm run build --workspace apps/ingestion-worker

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/ingestion-worker/dist apps/ingestion-worker/dist
COPY --from=build /app/packages/shared-types/dist packages/shared-types/dist
COPY --from=build /app/packages/shared-types/package.json packages/shared-types/package.json
CMD ["node", "apps/ingestion-worker/dist/main.js"]
