import type { MetadataRoute } from "next";

/**
 * Web-App-Manifest: Damit lässt sich Cinemood auf iPhone und Android „Zum Home-Bildschirm“ hinzufügen
 * und startet dann wie eine App (Vollbild, eigenes Symbol, untere Navigationsleiste, siehe AppNav).
 * Symbole und Startbilder liegen in public/app/.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Cinemood",
    short_name: "Cinemood",
    description: "Find a movie everyone wants to watch, fast · Gemeinsam schnell einen Film finden",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#2a0a14",
    theme_color: "#2a0a14",
    categories: ["entertainment"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/app/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Watchlist", url: "/watchlist", icons: [{ src: "/app/icon-192.png", sizes: "192x192" }] },
      { name: "Train my Algorithm", url: "/trainieren", icons: [{ src: "/app/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
