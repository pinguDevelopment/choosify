import type { Metadata } from "next";
import { TvLaunch } from "@/components/TvLaunch";
import { pageTitle } from "@/lib/i18n/page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await pageTitle("tv"), robots: { index: false } };
}

/** Fernseher-Link der Crew (/tv#<link>): öffnet eine Runde und zeigt den QR-Code. */
export default function TvPage() {
  return <TvLaunch />;
}
