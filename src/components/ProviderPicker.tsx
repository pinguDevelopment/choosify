"use client";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { api, type AccountInfo, type Provider } from "@/lib/api";
import { loadLocalFavorites, saveLocalFavorites, type Favorites } from "@/lib/favorites";
import { Chip } from "@/components/Chip";

// Auswahl der Streaming-Dienste mit Suche und Favoriten (☆).
// Favoriten bleiben auf diesem Gerät gespeichert, mit Konto zusätzlich auf allen Geräten.
const norm = (s: string) => s.toLowerCase().replace(/\+/g, " plus").replace(/[^a-z0-9äöüß ]/g, "");

type Props = {
  picked: number[];
  setPicked: React.Dispatch<React.SetStateAction<number[]>>;
  anySource: boolean;
  setAnySource: React.Dispatch<React.SetStateAction<boolean>>;
  /** Gespeicherte Auswahl (z. B. vom Fernseher). Ohne: Favoriten sind vorausgewählt. */
  preset?: Favorites;
  onAccount?: (email: string | null) => void;
  onError?: (message: string) => void;
  title?: string;
  hint?: string;
};

export function ProviderPicker({ picked, setPicked, anySource, setAnySource, preset, onAccount, onError, title, hint }: Props) {
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [favs, setFavs] = useState<Favorites>({ ids: [], other: false });
  const [query, setQuery] = useState("");
  const [loggedIn, setLoggedIn] = useState<string | null>(null);

  useEffect(() => {
    // Angemeldet zählen die Favoriten aus dem Konto, sonst die vom Gerät.
    const account = api<{ account: AccountInfo | null }>("/api/konto")
      .then((d) => d.account)
      .catch(() => null);
    Promise.all([api<{ providers: Provider[] }>("/api/tmdb/providers?region=DE"), account])
      .then(([d, acc]) => {
        setProviders(d.providers);
        setLoggedIn(acc?.email ?? null);
        onAccount?.(acc?.email ?? null);
        const f = acc ? acc.favorites : loadLocalFavorites();
        if (acc) saveLocalFavorites(f);
        setFavs(f);
        // Gespeicherte Auswahl oder Favoriten sind beim Start schon ausgewählt
        const start = preset ?? f;
        const known = new Set(d.providers.map((p) => p.id));
        setPicked(start.ids.filter((id) => known.has(id)));
        setAnySource(start.other);
      })
      .catch(() => setProviders([]));
    // Nur beim ersten Anzeigen laden
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const f = favs;
    const next =
      id === "other"
        ? { ...f, other: !f.other }
        : { ...f, ids: f.ids.includes(id) ? f.ids.filter((x) => x !== id) : [...f.ids, id] };
    setFavs(next);
    saveLocalFavorites(next);
    if (loggedIn) {
      api("/api/konto", { method: "PATCH", body: { favorites: next } }).catch(() =>
        onError?.("Favorit ist nur auf diesem Gerät gespeichert, das Konto war gerade nicht erreichbar."),
      );
    }
    // Als Favorit markieren heißt auch: jetzt auswählen
    if (id === "other") {
      if (!favs.other) setAnySource(true);
    } else if (!favs.ids.includes(id)) {
      setPicked((p) => (p.includes(id) ? p : [...p, id]));
    }
  }
  const toggle = (id: number) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-muted">
        <span className="block text-lg text-text">{title ?? "Welche Dienste habt ihr?"}</span>
        <span className="text-sm">{hint ?? "Wir schlagen nur Filme vor, die dort gerade im Abo laufen. Nichts gewählt = alle bekannten."}</span>
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
          <p className="text-sm text-muted">Mit ☆ merkst du dir einen Dienst als Favorit. Favoriten stehen oben und sind beim nächsten Mal schon ausgewählt{loggedIn ? ", auf allen deinen Geräten" : ""}.</p>
        </>
      )}
      {anySource && (
        <p className="text-sm text-muted">Es kommen auch Filme, die bei keinem gewählten Dienst im Abo laufen, z. B. für eure eigene Sammlung oder zum Leihen.</p>
      )}
    </fieldset>
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
      className={`grid h-9 w-8 place-items-center text-xl leading-none ${on ? "text-accent" : "text-muted/70 hover:text-accent"}`}
    >
      {on ? "★" : "☆"}
    </motion.button>
  );
}
