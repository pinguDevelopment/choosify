"use client";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useT } from "@/components/I18nProvider";
import { Switch } from "@/components/Switch";
import { TasteRow, Thumb } from "@/components/AbspannClient";
import { MovieSheet } from "@/components/room/MovieSheet";
import { SPRING, SwipeCard, VoteButton, type Exit } from "@/components/room/Swiper";
import type { Choice, Movie } from "@/components/room/types";

/** Antwort von GET /api/training */
type Profile =
  | { account: false }
  | {
      account: true;
      count: number;
      max: number;
      useInGroups: boolean;
      taste: { likes: string[]; dislikes: string[] };
      recent: { tmdbId: number; title: string; poster: string | null; year: number | null; choice: Choice }[];
    };

type Step = { movie: Movie; exit: Exit };

/** Ab so wenigen Karten im Stapel wird nachgeladen. */
const REFILL_AT = 6;

/**
 * „Train my Algorithm“: allein durch Filme wischen. Jede Stimme landet im Konto und
 * verbessert die Filmauswahl in Gruppenrunden.
 */
export function TrainClient() {
  const t = useT();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [queue, setQueue] = useState<Movie[]>([]);
  const [history, setHistory] = useState<Step[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExit, setLastExit] = useState<Exit>("yes");
  const [returning, setReturning] = useState<{ id: number; exit: Exit } | null>(null);
  const [details, setDetails] = useState<Movie | null>(null);
  const closeDetails = useCallback(() => setDetails(null), []);
  // Alle Filme, die dieser Browser schon gesehen hat (damit der nächste Stapel keine Doppelten bringt)
  const seen = useRef(new Set<number>());
  const sinceRefresh = useRef(0);

  const loadProfile = useCallback(async () => {
    try {
      const p = await api<Profile>("/api/training");
      setProfile(p);
      if (p.account) setCount(p.count);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const loadMore = useCallback(async () => {
    setLoading(true);
    setEmpty(false);
    try {
      const { movies } = await api<{ movies: Movie[] }>("/api/training/movies", {
        body: { exclude: [...seen.current].slice(-300) },
      });
      const fresh = movies.filter((m) => !seen.current.has(m.tmdbId));
      for (const m of fresh) seen.current.add(m.tmdbId);
      setQueue((q) => [...q, ...fresh]);
      if (!fresh.length) setEmpty(true);
    } catch (e) {
      setError((e as Error).message);
      setEmpty(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- einmalig beim Öffnen laden
    loadProfile();
  }, [loadProfile]);

  const signedIn = profile?.account === true;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Stapel nachfüllen, wenn er knapp wird
    if (signedIn && queue.length < REFILL_AT && !loading && !empty) loadMore();
  }, [signedIn, queue.length, loading, empty, loadMore]);

  function take(m: Movie, exit: Exit) {
    setLastExit(exit);
    setReturning(null);
    setQueue((q) => q.filter((x) => x.tmdbId !== m.tmdbId));
    setHistory((h) => [...h.slice(-49), { movie: m, exit }]);
  }

  async function cast(m: Movie, choice: Choice) {
    take(m, choice);
    setCount((c) => c + 1);
    navigator.vibrate?.(choice === "yes" ? [12, 40, 12] : choice === "maybe" ? 8 : 12);
    try {
      await api("/api/training/vote", { body: { tmdbId: m.tmdbId, choice } });
      // Ab und zu zeigen, was schon gelernt wurde
      if (++sinceRefresh.current >= 8) {
        sinceRefresh.current = 0;
        loadProfile();
      }
    } catch (e) {
      setError((e as Error).message);
      setCount((c) => c - 1);
      setHistory((h) => h.filter((s) => s.movie.tmdbId !== m.tmdbId));
      setQueue((q) => [m, ...q]);
    }
  }

  function skip(m: Movie) {
    take(m, "skip");
  }

  async function undo() {
    const last = history.at(-1);
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setReturning({ id: last.movie.tmdbId, exit: last.exit });
    setQueue((q) => [last.movie, ...q]);
    if (last.exit === "skip") return;
    setCount((c) => c - 1);
    try {
      await api("/api/training/vote", { body: { tmdbId: last.movie.tmdbId, choice: null } });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Tastatur: ← Nicht meins, ↑ Geht so, → Mag ich, ↓ Kenn ich nicht, Rücktaste, I = Details
  const top = queue[0];
  const actions = useRef({ cast, skip, undo });
  useEffect(() => {
    actions.current = { cast, skip, undo };
  });
  useEffect(() => {
    if (details || !signedIn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const a = actions.current;
      if ((e.key === "i" || e.key === "I") && top) setDetails(top);
      else if (e.key === "ArrowRight" && top) a.cast(top, "yes");
      else if (e.key === "ArrowLeft" && top) a.cast(top, "no");
      else if (e.key === "ArrowUp" && top) {
        e.preventDefault();
        a.cast(top, "maybe");
      } else if (e.key === "ArrowDown" && top) {
        e.preventDefault();
        a.skip(top);
      } else if (e.key === "Backspace") a.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [top, details, signedIn]);

  if (!profile) return <p className="text-muted">{t.common.loading}</p>;

  if (!profile.account) {
    return (
      <section className="card flex flex-col gap-3">
        <h2 className="text-2xl">{t.train.signInTitle}</h2>
        <p className="text-muted">{t.train.signInText}</p>
        <Link href="/konto" className="btn-primary">
          {t.train.signIn}
        </Link>
      </section>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <p className="-mt-3 flex items-center gap-2 font-display text-lg font-extrabold text-accent tabular-nums" aria-live="polite">
        {t.train.count(count)}
      </p>

      <AnimatePresence>
        {details && (
          <MovieSheet
            key={details.tmdbId}
            movie={details}
            onClose={closeDetails}
            onVote={
              queue.some((m) => m.tmdbId === details.tmdbId)
                ? (choice) => {
                    setDetails(null);
                    cast(details, choice);
                  }
                : undefined
            }
          />
        )}
      </AnimatePresence>

      {queue.length > 0 ? (
        <>
          <div className="relative h-[min(60vh,540px)]">
            <AnimatePresence custom={lastExit}>
              {queue
                .slice(0, 3)
                .map((m, depth) => (
                  <SwipeCard
                    key={m.tmdbId}
                    movie={m}
                    depth={depth}
                    enterFrom={returning?.id === m.tmdbId ? returning.exit : null}
                    onVote={(choice) => cast(m, choice)}
                    onOpen={() => setDetails(m)}
                  />
                ))
                .reverse()}
            </AnimatePresence>
          </div>
          <div className="grid grid-cols-[3rem_1fr_1fr_1fr_3rem] items-start justify-items-center gap-1">
            <VoteButton label={t.swipe.back} ariaLabel={t.swipe.undo} size="sm" tone="muted" disabled={history.length === 0} onClick={undo} tap={{ scale: 0.88, rotate: -40 }}>
              ↺
            </VoteButton>
            <VoteButton label={t.train.no} size="lg" tone="no" onClick={() => cast(queue[0], "no")}>
              ✕
            </VoteButton>
            <VoteButton label={t.train.maybe} size="md" tone="accent" onClick={() => cast(queue[0], "maybe")} tap={{ scale: 0.86, y: -4 }}>
              <span className="font-display text-xl font-extrabold uppercase">ok</span>
            </VoteButton>
            <VoteButton label={t.train.yes} size="lg" tone="yes" onClick={() => cast(queue[0], "yes")}>
              ♥
            </VoteButton>
            <VoteButton label={t.train.skip} ariaLabel={t.train.skipAria} size="sm" tone="muted" onClick={() => skip(queue[0])} tap={{ scale: 0.88, y: 4 }}>
              ?
            </VoteButton>
          </div>
          <p className="text-center text-sm text-muted sm:hidden">{t.train.hintMobile}</p>
          <p className="hidden text-center text-sm text-muted sm:block">{t.train.hintDesktop}</p>
          <p className="-mt-3 text-center text-sm text-muted">{t.train.hintSeen}</p>
        </>
      ) : (
        <motion.section className="card flex flex-col items-center gap-3 text-center" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>
          {loading || !empty ? (
            <p className="text-muted">{t.train.loadingMore}</p>
          ) : (
            <>
              <p className="text-muted">{t.train.noMore}</p>
              <button className="btn-ghost" onClick={loadMore}>
                {t.train.retry}
              </button>
            </>
          )}
        </motion.section>
      )}
      {error && <p className="text-center text-sm text-no">{error}</p>}

      <ProfileCard profile={profile} count={count} onChange={loadProfile} onError={setError} />
    </MotionConfig>
  );
}

function ProfileCard({
  profile,
  count,
  onChange,
  onError,
}: {
  profile: Extract<Profile, { account: true }>;
  count: number;
  onChange: () => void;
  onError: (msg: string) => void;
}) {
  const t = useT();
  const [useInGroups, setUseInGroups] = useState(profile.useInGroups);
  const [confirmReset, setConfirmReset] = useState(false);
  const { likes, dislikes } = profile.taste;

  async function toggle(on: boolean) {
    setUseInGroups(on);
    try {
      await api("/api/training", { method: "PATCH", body: { useInGroups: on } });
    } catch (e) {
      setUseInGroups(!on);
      onError((e as Error).message);
    }
  }

  return (
    <>
      <section className="card flex flex-col gap-3">
        <h2 className="text-2xl">{t.train.profile}</h2>
        {likes.length || dislikes.length ? (
          <>
            {likes.length > 0 && <TasteRow label={t.train.likes} items={likes} good />}
            {dislikes.length > 0 && <TasteRow label={t.train.dislikes} items={dislikes} />}
          </>
        ) : (
          <p className="text-muted">{t.train.tooFew}</p>
        )}
        <div className="border-t-2 border-dashed border-line pt-3">
          <Switch checked={useInGroups} onChange={toggle} label={t.train.useInGroups} hint={t.train.useInGroupsHint} />
        </div>
      </section>

      {profile.recent.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-2xl">{t.train.recent}</h2>
          <ul className="flex flex-col gap-2">
            {profile.recent.map((m) => (
              <li key={m.tmdbId} className="flex items-center gap-3 rounded-xl bg-surface p-2 pr-3">
                <Thumb src={m.poster} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-semibold">{m.title}</span>
                  <span className="text-sm text-muted">
                    {m.year ?? t.common.yearUnknown} ·{" "}
                    <span className={m.choice === "yes" ? "text-yes" : m.choice === "no" ? "text-no" : "text-accent"}>{t.train.choice[m.choice]}</span>
                  </span>
                </span>
                <button
                  className="px-1 text-muted hover:text-no"
                  aria-label={t.train.forget(m.title)}
                  title={t.train.forget(m.title)}
                  onClick={async () => {
                    try {
                      await api("/api/training/vote", { body: { tmdbId: m.tmdbId, choice: null } });
                      onChange();
                    } catch (e) {
                      onError((e as Error).message);
                    }
                  }}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {count > 0 &&
        (confirmReset ? (
          <div className="flex flex-col gap-2 rounded-2xl border-2 border-no/50 p-3 animate-pop">
            <p className="font-semibold">{t.train.resetConfirm}</p>
            <div className="flex gap-2">
              <button
                className="btn flex-1 border-2 border-no py-2 text-no hover:bg-no hover:text-accent-ink"
                onClick={async () => {
                  try {
                    await api("/api/training", { method: "DELETE", body: {} });
                    setConfirmReset(false);
                    onChange();
                  } catch (e) {
                    onError((e as Error).message);
                  }
                }}
              >
                {t.train.resetYes}
              </button>
              <button className="btn-ghost flex-1 py-2" onClick={() => setConfirmReset(false)}>
                {t.train.cancel}
              </button>
            </div>
          </div>
        ) : (
          <button className="self-start text-sm text-muted underline decoration-line underline-offset-4 hover:text-no" onClick={() => setConfirmReset(true)}>
            {t.train.reset}
          </button>
        ))}
    </>
  );
}
