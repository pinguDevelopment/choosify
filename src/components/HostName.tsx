"use client";
import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Adresse dieser Seite ohne https://, z. B. "cinemood.app" (auf dem Server leer). */
export function HostName({ suffix = "" }: { suffix?: string }) {
  const host = useSyncExternalStore(noop, () => window.location.host, () => "");
  return <>{host}{suffix}</>;
}
