"use client";
import { useEffect } from "react";

/**
 * Rückfall: Steht die Adresse nicht in den Redirect-URLs von Supabase, zeigt der Link aus der
 * Mail auf die Startseite statt auf /konto/bestaetigen. Dann hier weiterleiten.
 */
export function LoginLinkFallback() {
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token_hash");
    if (token && /^[A-Za-z0-9._-]{8,200}$/.test(token)) {
      window.location.replace(`/konto/bestaetigen?token_hash=${encodeURIComponent(token)}`);
    }
  }, []);
  return null;
}
