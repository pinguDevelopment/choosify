"use client";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type Provider } from "@/lib/api";
import { Chip } from "@/components/Chip";

// Favoriten bleiben auf diesem Gerät gespeichert (wie das Crew-Cookie auch).
const FAV_KEY = "choosify:lieblingsquellen";
type Favorites = { ids: number[]; other: boolean };
function loadFavorites(): Favorites {
  try {
    const v = JSON.parse(localStorage.getItem(FAV_KEY) ?? "null");
    if (v && Array.isArray(v.ids)) return { ids: v.ids.filter((x: unknown) => Number.isInteger(x)), other: v.other === true };
  } catch {
    // Speicher gesperrt oder kaputt: ohne Favoriten weiter
  }
  return { ids: [], other: false };
}
function saveFavorites(f: Favorites) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(f));
  } catch {
    // nicht schlimm, dann eben nur für diese Sitzung
  }
}
const norm = (s: string) => s.toLowerCase().replace(/\+/g, " plus").replace(/[^a-z0-9äöüß ]/g, "");

export function CreateRoom() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [anySource, setAnySource] = useState(false);
  const [favs, setFavs] = useState<Favorites>({ ids: [], other: false });
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ providers: Provider[] }>("/api/tmdb/providers?region=DE")
      .then((d) => {
        setProviders(d.providers);
        // Favoriten sind beim Start schon ausgewählt
        const f = loadFavorites();
        const known = new Set(d.providers.map((p) => p.id));
        setFavs(f);
        setPicked(f.ids.filter((id) => known.has(id)));
        setAnySource(f.other);
      })
      .catch(() => setProviders([]));
  }, []);

  // Reihenfolge: Favoriten, bekannte Dienste, Rest (Channels, Werbe-Varianten, Nischen) unter "Mehr".
  // Mit Suchbegriff wird über alle Dienste gesucht.
  const all = providers ?? [];
  const isFav = (id: number) => favs.ids.includes(id);
  const favList = favs.ids.map((id) => all.find((p) => p.id === id)).filter((p) => p !== undefined);
  const featured = all.filter((p) => p.featured && !isFav(p.id));
  const others = all.filter((p) => !p.featured && !isFav(p.id));
  const q = norm(query.trim());
  const visible = q
    ? all.filter((p) => norm(p.name).includes(q)).sort((a, b) => Number(isFav(b.id)) - Number(isFav(a.id)))
    : showAll || featured.length + favList.length === 0
      ? [...favList, ...featured, ...others]
      : [...favList, ...featured, ...others.filter((p) => picked.includes(p.id))];
  const showOther = !q || norm("Sonstige eigene Quelle").includes(q);

  function toggleFav(id: number | "other") {
    setFavs((f) => {
      const next =
        id === "other"
          ? { ...f, other: !f.other }
          : { ...f, ids: f.ids.includes(id) ? f.ids.filter((x) => x !== id) : [...f.ids, id] };
      saveFavorites(next);
      return next;
    });
    // Als Favorit markieren heißt auch: jetzt auswählen
    if (id === "other") {
      if (!favs.other) setAnySource(true);
    } else if (!favs.ids.includes(id)) {
      setPicked((p) => (p.includes(id) ? p : [...p, id]));
    }
  }
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
          <>
            {all.length > 0 && (
              <input
                type="search"
                className="input py-2.5"
                placeholder="Dienst suchen, z. B. Crunchyroll"
                aria-label="Dienst suchen"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            )}
            <div className="flex flex-wrap gap-2">
              {visible.map((p) => (
                <span key={p.id} className="inline-flex items-center">
                  <Chip pressed={picked.includes(p.id)} onToggle={() => toggle(p.id)}>
                    {p.logoPath && (
                      // eslint-disable-next-line @next/next/no-img-element -- kleines TMDB-Logo
                      <img src={`https://image.tmdb.org/t/p/w45${p.logoPath}`} alt="" className="h-5 w-5 rounded" />
                    )}
                    {p.name}
                  </Chip>
                  <FavStar name={p.name} on={isFav(p.id)} onToggle={() => toggleFav(p.id)} />
                </span>
              ))}
              {!q && featured.length + favList.length > 0 && others.length > 0 && (
                <button type="button" className="chip text-muted" onClick={() => setShowAll((s) => !s)}>
                  {showAll ? "Weniger anzeigen" : `Mehr anzeigen (+${others.filter((p) => !picked.includes(p.id)).length})`}
                </button>
              )}
              {showOther && (
                <span className="inline-flex items-center">
                  <Chip pressed={anySource} onToggle={() => setAnySource((v) => !v)}>
                    Sonstige / eigene Quelle
                  </Chip>
                  <FavStar name="Sonstige / eigene Quelle" on={favs.other} onToggle={() => toggleFav("other")} />
                </span>
              )}
              {q && visible.length === 0 && !showOther && <p className="text-sm text-muted">Kein Dienst gefunden.</p>}
            </div>
            <p className="text-sm text-muted">Mit ☆ merkst du dir einen Dienst als Favorit. Favoriten stehen oben und sind beim nächsten Mal schon ausgewählt.</p>
          </>
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

function FavStar({ name, on, onToggle }: { name: string; on: boolean; onToggle: () => void }) {
  return (
    <motion.button
      type="button"
      aria-pressed={on}
      aria-label={`${name} als Favorit`}
      title={on ? "Favorit entfernen" : "Als Favorit merken"}
      onClick={onToggle}
      whileTap={{ scale: 0.8, rotate: -15 }}
      animate={{ scale: on ? [1, 1.3, 1] : 1 }}
      transition={{ duration: 0.3 }}
      className={`grid h-9 w-8 place-items-center text-xl leading-none ${on ? "text-accent" : "text-line hover:text-muted"}`}
    >
      {on ? "★" : "☆"}
    </motion.button>
  );
}
