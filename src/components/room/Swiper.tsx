"use client";
import { AnimatePresence, MotionConfig, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Choice, Movie, RoomState } from "./types";
import { RankingList } from "./Results";
import { tiedLeaders } from "@/lib/ranking";
import { SwipeIntro, introSeen } from "./SwipeIntro";
import { useT } from "@/components/I18nProvider";

const THRESHOLD = 110; // px, ab hier zählt ein Wisch
const FLICK = 650; // px/s, ein schneller Schubs reicht auch ohne weiten Weg
const SPRING = { type: "spring", stiffness: 380, damping: 32, mass: 0.9 } as const;
// Wohin eine Karte je Stimme rausfliegt: Ja nach rechts, Nein nach links, Wäre ok nach oben
const FLY: Record<Choice, { x: number; y: number }> = { yes: { x: 1, y: 0 }, no: { x: -1, y: 0 }, maybe: { x: 0, y: -1 } };

export function Swiper({ state, onChange }: { state: RoomState; onChange: () => void }) {
  // null = lokal zurückgenommen, bis der Server es bestätigt
  const [local, setLocal] = useState<Record<number, Choice | null>>({});
  const [history, setHistory] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Letzte Stimme: steuert, wohin die Karte rausfliegt bzw. woher sie bei Rückgängig zurückkommt
  const [lastChoice, setLastChoice] = useState<Choice>("yes");
  const [returning, setReturning] = useState<{ id: number; choice: Choice } | null>(null);
  // Einführung beim ersten Mal. Der Swiper rendert nie auf dem Server (erst nach dem Laden der Runde),
  // deshalb darf localStorage direkt im Initialwert gelesen werden.
  const [intro, setIntro] = useState(() => !introSeen());
  const choices = useRef(new Map<number, Choice>());
  const t = useT();
  const voted = useMemo<Record<number, Choice | null>>(() => ({ ...state.myVotes, ...local }), [state.myVotes, local]);
  const queue = state.movies.filter((m) => voted[m.tmdbId] == null);
  const done = state.movies.length - queue.length;

  async function cast(m: Movie, choice: Choice) {
    choices.current.set(m.tmdbId, choice);
    setLastChoice(choice);
    setReturning(null);
    setLocal((l) => ({ ...l, [m.tmdbId]: choice })); // sofort weiter, Server im Hintergrund
    setHistory((h) => [...h, m.tmdbId]);
    navigator.vibrate?.(choice === "yes" ? [12, 40, 12] : choice === "maybe" ? 8 : 12);
    try {
      await api(`/api/rooms/${state.code}/vote`, { body: { tmdbId: m.tmdbId, choice } });
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
    setReturning({ id: last, choice: choices.current.get(last) ?? "yes" });
    setLocal((l) => ({ ...l, [last]: null }));
    try {
      await api(`/api/rooms/${state.code}/vote`, { body: { tmdbId: last, choice: null } });
      onChange();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Tastatur am Laptop: ← Nein, ↑ Wäre ok, → Ja, Backspace = Rückgängig
  const top = queue[0];
  const castRef = useRef(cast);
  const undoRef = useRef(undo);
  useEffect(() => {
    castRef.current = cast;
    undoRef.current = undo;
  });
  useEffect(() => {
    if (intro) return; // Pfeiltasten blättern dann in der Einführung
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight" && top) castRef.current(top, "yes");
      else if (e.key === "ArrowLeft" && top) castRef.current(top, "no");
      else if (e.key === "ArrowUp" && top) {
        e.preventDefault(); // sonst scrollt die Seite mit
        castRef.current(top, "maybe");
      }
      else if (e.key === "Backspace") undoRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [top, intro]);

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
        <motion.button
          type="button"
          onClick={() => setIntro(true)}
          whileTap={{ scale: 0.88 }}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-line font-display text-lg font-extrabold text-muted hover:border-accent hover:text-accent"
          aria-label={t.swipe.showIntro}
          title={t.swipe.howItWorks}
        >
          ?
        </motion.button>
      </div>
      <AnimatePresence>{intro && queue.length > 0 && <SwipeIntro onClose={() => setIntro(false)} />}</AnimatePresence>

      {queue.length > 0 ? (
        <>
          <div className="relative h-[min(60vh,540px)]">
            <AnimatePresence custom={lastChoice}>
              {queue
                .slice(0, 3)
                .map((m, depth) => (
                  <SwipeCard
                    key={m.tmdbId}
                    movie={m}
                    depth={depth}
                    enterFrom={returning?.id === m.tmdbId ? returning.choice : null}
                    onVote={(choice) => cast(m, choice)}
                  />
                ))
                .reverse()}
            </AnimatePresence>
          </div>
          {/* Knopfleiste: Nein | Wäre ok | Ja, jeweils beschriftet. Rückgängig klein links daneben. */}
          <div className="grid grid-cols-[3rem_1fr_1fr_1fr_3rem] items-start justify-items-center gap-1">
            <VoteButton label={t.swipe.back} ariaLabel={t.swipe.undo} size="sm" tone="muted" disabled={history.length === 0} onClick={undo} tap={{ scale: 0.88, rotate: -40 }}>
              ↺
            </VoteButton>
            <VoteButton label={t.swipe.no} size="lg" tone="no" onClick={() => cast(queue[0], "no")}>
              ✕
            </VoteButton>
            <VoteButton label={t.swipe.maybe} size="md" tone="accent" onClick={() => cast(queue[0], "maybe")} tap={{ scale: 0.86, y: -4 }}>
              <span className="font-display text-xl font-extrabold uppercase">ok</span>
            </VoteButton>
            <VoteButton label={t.swipe.yes} size="lg" tone="yes" onClick={() => cast(queue[0], "yes")}>
              ♥
            </VoteButton>
            <span aria-hidden />
          </div>
          <p className="text-center text-sm text-muted sm:hidden">{t.swipe.hintMobile}</p>
          <p className="hidden text-center text-sm text-muted sm:block">{t.swipe.hintDesktop}</p>
        </>
      ) : (
        <motion.section
          className="card text-center"
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={SPRING}
        >
          <h2 className="text-4xl">{t.swipe.doneTitle}</h2>
          <p className="mt-2 text-muted">{t.swipe.doneText}</p>
        </motion.section>
      )}
      {error && <p className="text-center text-sm text-no">{error}</p>}

      {(queue.length === 0 || state.me?.isHost) && (
        <section className="card flex flex-col gap-3">
          <h2 className="text-2xl">{t.swipe.progress}</h2>
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
  const t = useT();
  const top = state.ranking[0];
  const tied = tiedLeaders(state.ranking).length;
  return (
    <div className="flex flex-col gap-3 border-t-2 border-dashed border-line pt-4">
      {top && (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={addToAbspann} onChange={(e) => setAdd(e.target.checked)} className="h-4 w-4 accent-[var(--butter)]" />
          {t.swipe.toAbspann}
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
              body: { addToAbspann: addToAbspann && !!top },
            });
            onChange();
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        {tied > 1 ? t.swipe.finishTie(tied) : t.swipe.finish(top?.title ?? null)}
      </button>
      {tied > 1 && (
        <p className="text-center text-sm text-muted">{t.swipe.tieHint(tied)}</p>
      )}
    </div>
  );
}

const cardVariants = {
  // Neue Karten tauchen hinten im Stapel auf. Bei Rückgängig fliegt die Karte von der Seite zurück, zu der sie raus ist.
  initial: (enterFrom: Choice | null) =>
    enterFrom
      ? { x: FLY[enterFrom].x * 520, y: FLY[enterFrom].y * 620, rotate: FLY[enterFrom].x * 22, opacity: 1 }
      : { scale: 0.86, y: 46, opacity: 0 },
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
  exit: (choice: Choice) => ({
    x: FLY[choice].x * 640,
    y: FLY[choice].y ? FLY[choice].y * 760 : 40,
    rotate: FLY[choice].x * 26,
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
  enterFrom: Choice | null;
  onVote: (choice: Choice) => void;
}) {
  const top = depth === 0;
  const t = useT();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-320, 0, 320], [-16, 0, 16]);
  const yesOpacity = useTransform(x, [24, THRESHOLD], [0, 1]);
  const noOpacity = useTransform(x, [-THRESHOLD, -24], [1, 0]);
  const yesScale = useTransform(x, [24, THRESHOLD], [0.7, 1]);
  const noScale = useTransform(x, [-THRESHOLD, -24], [1, 0.7]);
  // "Wäre ok" zählt nur, wenn klar nach oben gewischt wird (mehr hoch als zur Seite)
  const maybeOpacity = useTransform(() => (Math.abs(y.get()) > Math.abs(x.get()) ? clamp((-y.get() - 24) / (THRESHOLD - 24)) : 0));
  const maybeScale = useTransform(maybeOpacity, [0, 1], [0.7, 1]);
  const glow = useTransform(() => {
    const up = Math.abs(y.get()) > Math.abs(x.get()) && y.get() < 0;
    const t = clamp((up ? -y.get() : Math.abs(x.get())) / THRESHOLD);
    const rgb = up ? "255 201 77" : x.get() > 0 ? "143 224 176" : "255 138 122";
    return `inset 0 0 0 ${(t * 4).toFixed(1)}px rgb(${rgb} / ${(t * 0.9).toFixed(2)})`;
  });

  function onDragEnd(_: unknown, info: PanInfo) {
    const { offset, velocity } = info;
    const upwards = -offset.y > Math.abs(offset.x);
    if (upwards && (-offset.y > THRESHOLD || -velocity.y > FLICK)) onVote("maybe");
    else if (offset.x > THRESHOLD || velocity.x > FLICK) onVote("yes");
    else if (offset.x < -THRESHOLD || velocity.x < -FLICK) onVote("no");
    // sonst federt die Karte über dragConstraints von selbst zurück
  }

  return (
    <motion.article
      custom={depth}
      variants={cardVariants}
      initial={cardVariants.initial(enterFrom)}
      animate="stack"
      exit="exit"
      style={{ x, y, rotate, zIndex: 10 - depth }}
      drag={top}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={{ left: 0.95, right: 0.95, top: 0.9, bottom: 0.15 }}
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
            {t.swipe.stampYes}
          </motion.span>
          <motion.span
            className="absolute top-6 right-6 rotate-12 rounded-lg border-4 border-no px-3 py-0.5 font-display text-4xl font-extrabold uppercase text-no"
            style={{ opacity: noOpacity, scale: noScale }}
          >
            {t.swipe.stampNo}
          </motion.span>
          <motion.span
            className="absolute top-1/3 left-1/2 -translate-x-1/2 -rotate-3 whitespace-nowrap rounded-lg border-4 border-accent px-3 py-0.5 font-display text-4xl font-extrabold uppercase text-accent"
            style={{ opacity: maybeOpacity, scale: maybeScale }}
          >
            {t.swipe.stampMaybe}
          </motion.span>
        </>
      )}
      <div className="absolute inset-x-0 bottom-0 p-5">
        {movie.genres?.length > 0 && (
          <p className="mb-1 text-xs font-bold tracking-[0.14em] text-accent uppercase">
            <span className="sr-only">{t.swipe.genre}</span>
            {movie.genres.join(" · ")}
          </p>
        )}
        <h3 className="text-4xl">{movie.title}</h3>
        <p className="mt-1.5 flex flex-wrap gap-x-3 text-muted">
          {movie.year && <span>{movie.year}</span>}
          {movie.runtime != null && <span>{t.swipe.runtime(movie.runtime)}</span>}
          {movie.rating != null && <span className="text-accent">★ {movie.rating.toFixed(1)}</span>}
        </p>
        {movie.overview && (
          <p className={`mt-2 text-[0.95rem] text-text/90 ${movie.tags?.length ? "line-clamp-3" : "line-clamp-4"}`}>{movie.overview}</p>
        )}
        {movie.tags?.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t.swipe.tags}>
            {movie.tags.map((t) => (
              <li key={t} className="rounded-full border border-ticket/45 bg-black/30 px-2.5 py-0.5 text-sm font-semibold text-ticket backdrop-blur-sm">
                #{t}
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.article>
  );
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));

const TONES = {
  no: "border-no text-no hover:bg-no hover:text-accent-ink",
  yes: "border-yes text-yes hover:bg-yes hover:text-accent-ink",
  accent: "border-accent text-accent hover:bg-accent hover:text-accent-ink",
  muted: "border-line text-muted",
} as const;
const SIZES = { sm: "h-12 w-12 text-xl mt-3", md: "h-14 w-14 text-xl mt-2", lg: "h-[4.5rem] w-[4.5rem] text-3xl" } as const;

/** Runder Abstimmknopf mit kleiner Beschriftung darunter (das Symbol allein war nicht eindeutig). */
function VoteButton({
  label,
  ariaLabel,
  size,
  tone,
  disabled,
  onClick,
  tap = { scale: 0.86 },
  children,
}: {
  label: string;
  ariaLabel?: string;
  size: keyof typeof SIZES;
  tone: keyof typeof TONES;
  disabled?: boolean;
  onClick: () => void;
  tap?: Record<string, number>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.button
        whileHover={disabled ? undefined : { scale: 1.06 }}
        whileTap={tap}
        transition={SPRING}
        className={`btn rounded-full border-2 bg-surface/60 p-0 shadow-[0_6px_18px_rgb(0_0_0/0.35)] backdrop-blur ${SIZES[size]} ${TONES[tone]}`}
        aria-label={ariaLabel ?? label}
        title={ariaLabel ?? label}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </motion.button>
      <span aria-hidden className={`text-xs font-semibold tracking-wide uppercase ${disabled ? "text-line" : tone === "muted" ? "text-muted" : TONES[tone].split(" ")[1]}`}>
        {label}
      </span>
    </div>
  );
}
