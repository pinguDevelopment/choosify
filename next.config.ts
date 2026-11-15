import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Content-Security-Policy: nur eigene Skripte, Bilder nur von uns und TMDB,
// Netzwerk nur zur eigenen API, kein Einbetten in fremde Seiten.
// 'unsafe-inline' bei Skripten ist nötig, weil Next.js mit Cache Components
// Inline-Skripte im statischen Shell ausliefert (Nonces würden das Prerendering abschalten).
// React escaped alle Ausgaben und wir nutzen kein dangerouslySetInnerHTML, daher ist das Restrisiko gering.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://image.tmdb.org",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Nur für "npm run dev": erlaubt Zugriff über VS-Code-Port-Forwarding (Dev Tunnels) und das eigene WLAN.
  allowedDevOrigins: ["**.devtunnels.ms", "10.*.*.*", "192.168.*.*"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" }],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Kurze Adresse für die Android-TV-App, damit man am Fernseher nicht den langen GitHub-Link tippen muss
  async redirects() {
    return [
      {
        source: "/tv-app",
        destination: "https://github.com/pinguDevelopment/cinemood/releases/download/tv-app/cinemood-tv.apk",
        permanent: false,
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
