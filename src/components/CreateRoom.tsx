"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { api } from "@/lib/api";
import { ProviderPicker } from "@/components/ProviderPicker";

export function CreateRoom() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [anySource, setAnySource] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState<string | null>(null);

  // Next.js (Cache Components) versteckt Seiten beim Navigieren nur (React Activity) und
  // behält ihren State. Ohne Reset stünde der Knopf nach "Zurück zur Startseite" noch auf
  // "wird erstellt …" und ließe sich nicht mehr drücken.
  useLayoutEffect(() => () => setBusy(false), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { code } = await api<{ code: string }>("/api/rooms", {
        body: { hostName: name, region: "DE", providerIds: picked, anySource },
      });
      router.push(`/r/${code}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={submit}>
      <div>
        <h2 className="text-4xl">Filmabend starten</h2>
        {loggedIn && (
          <p className="mt-1 flex gap-1.5 text-sm text-muted">
            <span className="truncate">Angemeldet als {loggedIn}</span>
            <span aria-hidden>·</span>
            <Link href="/konto" className="shrink-0 underline underline-offset-4">
              Konto
            </Link>
          </p>
        )}
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-muted">Dein Name</span>
        <input
          className="input"
          value={name}
          maxLength={30}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Lena"
          required
        />
      </label>
      <ProviderPicker
        picked={picked}
        setPicked={setPicked}
        anySource={anySource}
        setAnySource={setAnySource}
        onAccount={setLoggedIn}
        onError={setError}
      />
      {error && <p className="text-sm text-no">{error}</p>}
      <button className="btn-primary" disabled={busy || !name.trim()}>
        {busy ? "Runde wird erstellt …" : "Runde erstellen"}
      </button>
    </form>
  );
}
