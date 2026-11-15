import { TvLaunch } from "@/components/TvLaunch";

export const metadata = { title: "Fernseher – Filmabend", robots: { index: false } };

/** Fernseher-Link der Crew (/tv#<link>): öffnet eine Runde und zeigt den QR-Code. */
export default function TvPage() {
  return <TvLaunch />;
}
