"use client";
import { AnimatePresence, MotionConfig, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Movie, RoomState } from "./types";
import { RankingList } from "./Results";

const THRESHOLD = 110; // px, ab hier zählt ein Wisch
const FLICK = 650; // px/s, ein schneller Schubs reicht auch ohne weiten Weg
const SPRING = { type: "spring", stiffness: 380, damping: 32, mass: 0.9 } as const;

export function Swiper({ state, onChange }: { state: RoomState; onChange: () => void }) {
  // null = lokal zurückgenommen, bis der Server es bestätigt
  const [local, setLocal] = useState<Record<number, boolean | null>>({});
  const [history, setHistory] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Richtung des letzten Wischs: steuert, wohin die Karte rausfliegt bzw. woher sie bei Rückgängig zurückkommt
  const [lastDir, setLastDir] = useState<1 | -1>(1);
  const [returning, setReturning] = useState<{ id: number; dir: 1 | -1 } | null>(null);
  const dirs = useRef(new Map<number, 1 | -1>());
  const voted = useMemo<Record<number, boolean | null>>(() => ({ ...state.myVotes, ...local }), [state.myVotes, local]);
  const queue = state.movies.filter((m) => voted[m.tmdbId] == null);
  const done = state.movies.length - queue.length;

  async function cast(m: Movie, liked: boolean) {
    const dir = liked ? 1 : -1;
    dirs.current.set(m.tmdbId, dir);
    setLastDir(dir);
    setReturning(null);
    setLocal((l) => ({ ...l, [m.tmdbId]: liked })); // sofort weiter, Server im Hintergrund
    setHistory((h) => [...h, m.tmdbId]);
    navigator.vibrate?.(liked ? [12, 40, 12] : 12);
    try {
      await api(`/api/rooms/${state.code}/vote`, { body: { tmdbId: m.tmdbId, liked } });
    } catch (e) {
      setError((e as Error).message);
      setLocal((l) => {
        const n = { ...l };
        delete n[m.tmdbId];
        return n;
      });
    }
  }

  async function undo() {
    const last = history.at(-1);
    if (last === undefined) return;
    setHistory((h) => h.slice(0, -1));
    setReturning({ id: last, dir: dirs.current.get(last) ?? 1 });
    setLocal((l) => ({ ...l, [last]: null }));
    try {
      await api(`/api/rooms/${state.code}/vote`, { body: { tmdbId: last, liked: null } });
      onChange();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Tastatur am Laptop: ← Nein, → Ja, Backspace = Rückgängig
  const top = queue[0];
  const castRef = useRef(cast);
  const undoRef = useRef(undo);
  useEffect(() => {
    castRef.current = cast;
    undoRef.current = undo;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight" && top) castRef.current(top, true);
      else if (e.key === "ArrowLeft" && top) castRef.current(top, false);
      else if (e.key === "Backspace") undoRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [top]);

  const progress = done / Math.max(1, state.movies.length);

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex items-center gap-3 text-muted">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
          <motion.div className="h-full rounded-full bg-accent" initial={false} animate={{ width: `${progress * 100}%` }} transition={SPRING} />
        </div>
        <span className="font-display text-lg font-extrabold tabular-nums">
          {done}/{state.movies.length}
        </span>
      </div>

      {queue.length > 0 ? (
        <>
          <div className="relative h-[min(68vh,560px)]">
            <AnimatePresence custom={lastDir}>
              {queue
                .slice(0, 3)
                .map((m, depth) => (
                  <SwipeCard
                    key={m.tmdbId}
                    movie={m}
                    depth={depth}
                    enterFrom={returning?.id === m.tmdbId ? returning.dir : 0}
                    onVote={(liked) => cast(m, liked)}
                  />
                ))
                .reverse()}
            </AnimatePresence>
          </div>
          <div className="flex items-center justify-center gap-6">
            <motion.button
              whileTap={{ scale: 0.88, rotate: -40 }}
              transition={SPRING}
              className="btn h-12 w-12 rounded-full border-2 border-line p-0 text-xl text-muted"
              aria-label="Rückgängig"
              title="Rückgängig"
              disabled={history.length === 0}
              onClick={undo}
            >
              ↺
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.86 }}
              transition={SPRING}
              className="btn h-[4.5rem] w-[4.5rem] rounded-full border-2 border-no p-0 text-3xl text-no hover:bg-no hover:text-accent-ink"
              aria-label="Nein"
              onClick={() => cast(queue[0], false)}
            >
              ✕
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.86 }}
              transition={SPRING}
              className="btn h-[4.5rem] w-[4.5rem] rounded-full border-2 border-yes p-0 text-3xl text-yes hover:bg-yes hover:text-accent-ink"
              aria-label="Ja"
              onClick={() => cast(queue[0], true)}
            >
              ♥
            </motion.button>
            <span className="w-12" aria-hidden />
          </div>
          <p className="hidden text-center text-sm text-muted sm:block">Am Laptop: Pfeiltasten zum Wischen, Rücktaste nimmt zurück.</p>
        </>
      ) : (
        <motion.section
          className="card text-center"
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={SPRING}
        >
          <h2 className="text-4xl">Du bist durch!</h2>
          <p className="mt-2 text-muted">Sobald die anderen fertig sind, steht der Gewinner fest. Der Zwischenstand läuft live mit.</p>
        </motion.section>
      )}
      {error && <p className="text-center text-sm text-no">{error}</p>}

      {(queue.length === 0 || state.me?.isHost) && (
        <section className="card flex flex-col gap-3">
          <h2 className="text-2xl">Wer ist wie weit?</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {state.participants.map((p) => (
              <li key={p.name} className="rounded-full border-2 border-line px-3 py-1">
                {p.name} <span className="text-muted">{p.voted}/{state.movies.length}</span>
              </li>
            ))}
          </ul>
          {queue.length === 0 && <RankingList ranking={state.ranking.slice(0, 5)} />}
          {state.me?.isHost && <FinishButton state={state} onChange={onChange} />}
        </section>
      )}
    </MotionConfig>
  );
}

function FinishButton({ state, onChange }: { state: RoomState; onChange: () => void }) {
  const [addToAbspann, setAdd] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const top = state.ranking[0];
  return (
    <div className="flex flex-col gap-3 border-t-2 border-dashed border-line pt-4">
      {top && (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={addToAbspann} onChange={(e) => setAdd(e.target.checked)} className="h-4 w-4 accent-[var(--butter)]" />
          Gewinner danach in den Abspann (schon gesehen)
        </label>
      )}
      {error && <p className="text-sm text-no">{error}</p>}
      <button
        className="btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api(`/api/rooms/${state.code}/finish`, {
              body: { winnerTmdbId: top?.tmdbId ?? null, addToAbspann: addToAbspann && !!top },
            });
            onChange();
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        Abstimmung beenden{top ? `: ${top.title}` : ""}
      </button>
    </div>
  );
}

const cardVariants = {
  // Neue Karten tauchen hinten im Stapel auf. Bei Rückgängig fliegt die Karte von der Seite zurück, zu der sie raus ist.
  initial: (enterFrom: number) =>
    enterFrom ? { x: enterFrom * 520, rotate: enterFrom * 22, opacity: 1 } : { scale: 0.86, y: 46, opacity: 0 },
  // Stapel: hintere Karten etwas kleiner und tiefer, rücken mit Federung nach vorne
  stack: (depth: number) => ({
    x: 0,
    rotate: 0,
    scale: 1 - depth * 0.05,
    y: depth * 16,
    opacity: depth > 1 ? 0.55 : 1,
    transition: SPRING,
  }),
  // Rausfliegen in Wischrichtung (custom kommt von AnimatePresence, damit auch Knopf und Tastatur passen)
  exit: (dir: number) => ({
    x: dir * 640,
    y: 40,
    rotate: dir * 26,
    opacity: 0,
    zIndex: 30,
    transition: { duration: 0.42, ease: [0.22, 0.8, 0.32, 1] as [number, number, number, number] },
  }),
};

function SwipeCard({
  movie,
  depth,
  enterFrom,
  onVote,
}: {
  movie: Movie;
  depth: number;
  enterFrom: number;
  onVote: (liked: boolean) => void;
}) {
  const top = depth === 0;
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-320, 0, 320], [-16, 0, 16]);
  const yesOpacity = useTransform(x, [24, THRESHOLD], [0, 1]);
  const noOpacity = useTransform(x, [-THRESHOLD, -24], [1, 0]);
  const yesScale = useTransform(x, [24, THRESHOLD], [0.7, 1]);
  const noScale = useTransform(x, [-THRESHOLD, -24], [1, 0.7]);
  const glow = useTransform(
    x,
    [-THRESHOLD, 0, THRESHOLD],
    ["inset 0 0 0 4px rgb(255 138 122 / 0.9)", "inset 0 0 0 0px rgb(0 0 0 / 0)", "inset 0 0 0 4px rgb(143 224 176 / 0.9)"],
  );

  function onDragEnd(_: unknown, info: PanInfo) {
    const { offset, velocity } = info;
    if (offset.x > THRESHOLD || velocity.x > FLICK) onVote(true);
    else if (offset.x < -THRESHOLD || velocity.x < -FLICK) onVote(false);
    // sonst federt die Karte über dragConstraints von selbst zurück
  }

  return (
    <motion.article
      custom={depth}
      variants={cardVariants}
      initial={cardVariants.initial(enterFrom)}
      animate="stack"
      exit="exit"
      style={{ x, rotate, zIndex: 10 - depth }}
      drag={top}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={{ left: 0.95, right: 0.95, top: 0.2, bottom: 0.2 }}
      dragTransition={{ bounceStiffness: 420, bounceDamping: 26 }}
      whileDrag={{ scale: 1.03, cursor: "grabbing" }}
      onDragEnd={onDragEnd}
      className={`absolute inset-0 touch-none select-none overflow-hidden rounded-[1.6rem] bg-surface shadow-[0_18px_40px_rgb(0_0_0/0.45)] ${
        top ? "cursor-grab" : "pointer-events-none"
      }`}
    >
      {movie.poster ? (
        // eslint-disable-next-line @next/next/no-img-element -- TMDB liefert fertige Größen
        <img src={movie.poster} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-surface-2 p-8 text-center font-display text-5xl font-extrabold text-line">{movie.title}</div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#1a0509] via-[#1a0509]/45 to-transparent" />
      <motion.div className="pointer-events-none absolute inset-0 rounded-[1.6rem]" style={{ boxShadow: glow }} />
      {top && (
        <>
          <motion.span
            className="absolute top-6 left-6 -rotate-12 rounded-lg border-4 border-yes px-3 py-0.5 font-display text-4xl font-extrabold uppercase text-yes"
            style={{ opacity: yesOpacity, scale: yesScale }}
          >
            Bock
          </motion.span>
          <motion.span
            className="absolute top-6 right-6 rotate-12 rounded-lg border-4 border-no px-3 py-0.5 font-display text-4xl font-extrabold uppercase text-no"
            style={{ opacity: noOpacity, scale: noScale }}
          >
            Nö
          </motion.span>
        </>
      )}
      <div className="absolute inset-x-0 bottom-0 p-5">
        <h3 className="text-4xl">{movie.title}</h3>
        <p className="mt-1.5 flex gap-3 text-muted">
          {movie.year && <span>{movie.year}</span>}
          {movie.rating != null && <span className="text-accent">★ {movie.rating.toFixed(1)}</span>}
        </p>
        {movie.overview && <p className="mt-2 line-clamp-4 text-[0.95rem] text-text/90">{movie.overview}</p>}
      </div>
    </motion.article>
  );
}
