# Multi-stage Dockerfile for the React PWA.
# Per spec §34: static assets served from CDN/edge.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json apps/web/
COPY packages/shared-types/package*.json packages/shared-types/
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build --workspace apps/web

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/public/manifest.webmanifest /usr/share/nginx/html/manifest.webmanifest
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
