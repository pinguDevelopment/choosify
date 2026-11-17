"use client";
import { useSyncExternalStore } from "react";

/**
 * Läuft Cinemood gerade als installierte Web-App (vom Home-Bildschirm gestartet)?
 * iPhone: navigator.standalone, alle anderen: CSS display-mode. Die Android-App (WebView) zählt nicht,
 * sie hat ihre eigene Navigationsleiste.
 */
const QUERY = "(display-mode: standalone)";

function readStandalone(): boolean {
  if (/\bCinemoodApp\//.test(navigator.userAgent)) return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia(QUERY).matches;
}

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function useStandalone(): boolean {
  return useSyncExternalStore(subscribe, readStandalone, () => false);
}

/** iPhone oder iPad (iPads melden sich als Mac, haben aber Touch). */
export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** Teilen-Symbol von iOS (Quadrat mit Pfeil nach oben), für Anleitungen. */
export function ShareIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`inline-block h-[1.15em] w-[1.15em] align-[-0.2em] ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" />
      <path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 17.5 10H16" />
    </svg>
  );
}
