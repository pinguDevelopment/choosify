// Link teilen: auf dem Handy über das Teilen-Menü, sonst in die Zwischenablage.
// Gibt "copied" zurück, wenn kopiert wurde (für einen kurzen Hinweis im Knopf).
export async function shareLink(url: string, title: string): Promise<"shared" | "copied" | "failed"> {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch {
      return "failed";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
