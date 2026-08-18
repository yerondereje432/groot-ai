# Dockerfile for the AI/RAG service.
FROM node:20-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY apps/ai-service/package*.json apps/ai-service/
COPY packages/shared-types/package*.json packages/shared-types/
RUN npm ci --ignore-scripts

FROM node:20-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace apps/ai-service

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/ai-service/dist apps/ai-service/dist
COPY --from=build /app/packages/shared-types/dist packages/shared-types/dist
EXPOSE 4001
CMD ["node", "apps/ai-service/dist/main.js"]
