import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Film Aussucher",
    short_name: "Film Aussucher",
    description: "Gemeinsam schnell einen Film finden",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0b10",
    theme_color: "#0d0b10",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
