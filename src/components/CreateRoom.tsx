"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type Provider } from "@/lib/api";
import { Chip } from "@/components/Chip";

export function CreateRoom() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [anySource, setAnySource] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ providers: Provider[] }>("/api/tmdb/providers?region=DE")
      .then((d) => setProviders(d.providers))
      .catch(() => setProviders([]));
  }, []);

  // Erst nur die bekannten Dienste, der Rest (Channels, Werbe-Varianten, Nischen) unter "Mehr"
  const featured = providers?.filter((p) => p.featured) ?? [];
  const others = providers?.filter((p) => !p.featured) ?? [];
  const visible = showAll || featured.length === 0 ? (providers ?? []) : [...featured, ...others.filter((p) => picked.includes(p.id))];
  const toggle = (id: number) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

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
      <h2 className="text-4xl">Filmabend starten</h2>
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
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-muted">
          Welche Dienste habt ihr? Wir schlagen nur Filme vor, die dort gerade im Abo laufen. Ohne Auswahl nehmen wir alle bekannten Dienste.
        </legend>
        {providers === null ? (
          <p className="text-sm text-muted">Lade Anbieter …</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {visible.map((p) => (
              <Chip key={p.id} pressed={picked.includes(p.id)} onToggle={() => toggle(p.id)}>
                {p.logoPath && (
                  // eslint-disable-next-line @next/next/no-img-element -- kleines TMDB-Logo
                  <img src={`https://image.tmdb.org/t/p/w45${p.logoPath}`} alt="" className="h-5 w-5 rounded" />
                )}
                {p.name}
              </Chip>
            ))}
            {featured.length > 0 && others.length > 0 && (
              <button type="button" className="chip text-muted" onClick={() => setShowAll((s) => !s)}>
                {showAll ? "Weniger anzeigen" : `Mehr anzeigen (+${others.length})`}
              </button>
            )}
            <Chip pressed={anySource} onToggle={() => setAnySource((v) => !v)}>
              Sonstige / eigene Quelle
            </Chip>
          </div>
        )}
        {anySource && (
          <p className="text-sm text-muted">Es kommen auch Filme, die bei keinem gewählten Dienst im Abo laufen, z. B. für eure eigene Sammlung oder zum Leihen.</p>
        )}
      </fieldset>
      {error && <p className="text-sm text-no">{error}</p>}
      <button className="btn-primary" disabled={busy || !name.trim()}>
        {busy ? "Runde wird erstellt …" : "Runde erstellen"}
      </button>
    </form>
  );
}
