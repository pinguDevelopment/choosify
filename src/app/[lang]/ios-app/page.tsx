import type { Metadata } from "next";
import { Brand } from "@/components/Brand";
import { IosAppGuide } from "@/components/IosAppGuide";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { pageTitle } from "@/lib/i18n/page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await pageTitle("iosApp") };
}

/** Anleitung: Cinemood auf dem iPhone zum Home-Bildschirm hinzufügen. Kurzlink zum Weitergeben: /ios-app */
export default function IosAppPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-5">
      <header className="flex items-center justify-between gap-3">
        <Brand />
        <LanguageSwitch />
      </header>
      <IosAppGuide />
    </main>
  );
}
