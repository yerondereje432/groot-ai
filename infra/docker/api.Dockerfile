# Multi-stage Dockerfile for the NestJS API.
# Per spec §29: containerization.
FROM node:20-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY packages/shared-types/package*.json packages/shared-types/
RUN npm ci --ignore-scripts

FROM node:20-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build shared-types first (API depends on it)
RUN npm run build --workspace packages/shared-types
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build --workspace apps/api

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/packages/shared-types/dist packages/shared-types/dist
COPY --from=build /app/packages/shared-types/package.json packages/shared-types/package.json
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
