/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produces a self-contained `.next/standalone` build (server + only the
  // node_modules it actually needs) — required for the Docker image in
  // infra/docker/web.Dockerfile, which previously assumed a Vite-style
  // static `dist/` output and would not have worked for this Next.js app.
  output: 'standalone',
};

module.exports = nextConfig;
