import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// Self-Hosting ohne HTTPS (z. B. im Heimnetz unter http://192.168.x.x:3000): Browser sollen dann
// nicht auf https umleiten. Wirkt beim Bauen (das Docker-Image setzt es standardmäßig).
const allowHttp = process.env.ALLOW_HTTP === "1";

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
  ...(isDev || allowHttp ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(allowHttp ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Datenbank-Treiber nicht bündeln (better-sqlite3 lädt db.ts selbst zur Laufzeit)
  serverExternalPackages: ["mysql2", "pg"],
  // Für das Docker-Image: eigenständiger Server ohne komplette node_modules
  ...(process.env.STANDALONE === "1" ? { output: "standalone" as const } : {}),
  // Nur für "npm run dev": erlaubt Zugriff über VS-Code-Port-Forwarding (Dev Tunnels) und das eigene WLAN.
  allowedDevOrigins: ["**.devtunnels.ms", "10.*.*.*", "192.168.*.*"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" }],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Kurze Adressen für die Android-Apps (Fernseher und Handy), damit man nicht den langen GitHub-Link tippen muss
  async redirects() {
    return [
      {
        source: "/tv-app",
        destination: "https://github.com/pinguDevelopment/cinemood/releases/download/tv-app/cinemood-tv.apk",
        permanent: false,
      },
      {
        source: "/handy-app",
        destination: "https://github.com/pinguDevelopment/cinemood/releases/download/handy-app/cinemood-handy.apk",
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
