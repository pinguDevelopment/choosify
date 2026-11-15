import type { Metadata } from "next";
import { TvPair } from "@/components/TvPair";
import { pageTitle } from "@/lib/i18n/page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await pageTitle("tv"), robots: { index: false } };
}

/** Seite für den Browser des Fernsehers: zeigt einen Code zum Koppeln, danach die Runde. */
export default function TvPage() {
  return <TvPair />;
}
