// Reine Logik für den Origin-Check, separat damit sie testbar ist.

/**
 * Prüft, ob eine Origin erlaubt ist:
 *  - gleicher Host wie die Anfrage (normaler Fall), oder
 *  - in ALLOWED_ORIGINS eingetragen, z.B. "https://*.devtunnels.ms" für VS-Code-Port-Forwarding.
 *    Ein "*." am Anfang erlaubt genau eine oder mehrere Subdomains, nie die bloße Domain eines Fremden.
 */
export function isAllowedOrigin(origin: string, requestHosts: string[], allowList: string[]): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (requestHosts.some((h) => h && h === url.host)) return true;
  return allowList.some((entry) => {
    const e = entry.trim().replace(/\/+$/, "");
    if (!e) return false;
    const m = e.match(/^(https?):\/\/\*\.(.+)$/);
    if (m) {
      const [, proto, suffix] = m;
      return url.protocol === `${proto}:` && url.host.endsWith(`.${suffix}`) && url.host.length > suffix.length + 1;
    }
    return url.origin === e;
  });
}

export function parseAllowList(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}
