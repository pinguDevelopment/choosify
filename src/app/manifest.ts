import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cinemood",
    short_name: "Cinemood",
    description: "Find a movie everyone wants to watch, fast · Gemeinsam schnell einen Film finden",
    start_url: "/",
    display: "standalone",
    background_color: "#2a0a14",
    theme_color: "#2a0a14",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
