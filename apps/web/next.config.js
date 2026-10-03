/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produces a self-contained `.next/standalone` build (server + only the
  // node_modules it actually needs) — required for the Docker image in
  // infra/docker/web.Dockerfile, which previously assumed a Vite-style
  // static `dist/` output and would not have worked for this Next.js app.
  output: 'standalone',

  // Optional local-dev convenience: if API_PROXY_TARGET is set, proxy
  // `/api/v1/*` requests server-side to it. This lets NEXT_PUBLIC_BACKEND_URL
  // be a relative path ("/api/v1") so the BROWSER never has to reach
  // `localhost`/an internal hostname directly — only the Next.js dev
  // server does, server-to-server. Unset (the default) this is a no-op;
  // production deployments should instead point NEXT_PUBLIC_BACKEND_URL at
  // the real, public apps/api URL.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET;
    if (!target) return [];
    return [{ source: '/api/v1/:path*', destination: `${target}/:path*` }];
  },
};

module.exports = nextConfig;
