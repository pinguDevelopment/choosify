"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/I18nProvider";

/*
  Kurze Einführung beim ersten Swipen: drei Hinweise (Wischen, Wäre ok, Zurück).
  Wird pro Gerät nur einmal gezeigt (localStorage), über das „?“ neben dem Fortschritt jederzeit wieder.
*/

const STORAGE_KEY = "choosify:intro-gesehen";
const SPRING = { type: "spring", stiffness: 380, damping: 32, mass: 0.9 } as const;

/** Schon gesehen? Ohne Speicher (privater Modus, blockiert) lieber zeigen, als zu verwirren. */
export function introSeen() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // ohne Speicher kommt die Einführung beim nächsten Mal eben noch einmal
  }
}

type Demo = "swipe" | "maybe" | "undo";
// Texte stehen in src/lib/i18n (intro.steps), in derselben Reihenfolge
const DEMOS: Demo[] = ["swipe", "maybe", "undo"];

export function SwipeIntro({ onClose }: { onClose: () => void }) {
  const t = useT();
  const STEPS = t.intro.steps.map((s, i) => ({ ...s, demo: DEMOS[i] }));
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const primary = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const last = step === STEPS.length - 1;

  function close() {
    markSeen();
    onClose();
  }
  function go(to: number) {
    if (to < 0 || to >= STEPS.length) return;
    setDir(to > step ? 1 : -1);
    setStep(to);
  }

  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  const closeRef = useRef(close);
  const goRef = useRef(go);
  useEffect(() => {
    closeRef.current = close;
    goRef.current = go;
  });

  // Fokus in den Dialog, Seite dahinter nicht scrollen, danach Fokus zurück
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    primary.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, []);

  // Esc schließt, Pfeiltasten blättern, Tab bleibt im Dialog
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      else if (e.key === "ArrowRight") goRef.current(stepRef.current + 1);
      else if (e.key === "ArrowLeft") goRef.current(stepRef.current - 1);
      else if (e.key === "Tab" && dialog.current) {
        const items = [...dialog.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
        const first = items[0];
        const end = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          end?.focus();
        } else if (!e.shiftKey && document.activeElement === end) {
          e.preventDefault();
          first?.focus();
        }
        return;
      } else return;
      // Swiper soll Pfeiltasten nicht als Stimme werten
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const current = STEPS[step];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-[3px] sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <motion.div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="intro-title"
        aria-describedby="intro-text"
        className="relative w-full max-w-md overflow-hidden rounded-t-[1.6rem] bg-surface px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgb(0_0_0/0.5)] sm:rounded-[1.6rem]"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={SPRING}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold tracking-[0.18em] text-accent uppercase">
            {t.intro.stepOf(step + 1, STEPS.length)}
          </p>
          <button type="button" onClick={close} className="rounded-full px-2 py-1 text-sm font-semibold text-muted hover:text-text">
            {t.intro.skip}
          </button>
        </div>

        <div className="relative mt-3 h-[17.5rem] overflow-hidden">
          <AnimatePresence initial={false} custom={dir} mode="popLayout">
            <motion.div
              key={step}
              custom={dir}
              className="absolute inset-0 flex flex-col"
              variants={{
                enter: (d: number) => ({ x: d * 80, opacity: 0 }),
                center: { x: 0, opacity: 1 },
                leave: (d: number) => ({ x: d * -80, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="leave"
              transition={SPRING}
            >
              <DemoStage demo={current.demo} />
              <h2 id="intro-title" className="mt-4 text-3xl">
                {current.title}
              </h2>
              <p id="intro-text" className="mt-1.5 text-text/90">
                {current.text}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex flex-1 gap-1.5" role="group" aria-label={t.intro.hints}>
            {STEPS.map((s, i) => (
              <button
                key={s.demo}
                type="button"
                aria-label={t.intro.hint(i + 1, s.title)}
                aria-current={i === step ? "step" : undefined}
                onClick={() => go(i)}
                className="grid h-6 place-items-center"
              >
                <motion.span
                  className="block h-2 rounded-full"
                  initial={false}
                  animate={{ width: i === step ? 26 : 8, backgroundColor: i === step ? "var(--butter)" : "var(--seam)" }}
                  transition={SPRING}
                />
              </button>
            ))}
          </div>
          <button ref={primary} type="button" className="btn-primary min-w-36" onClick={() => (last ? close() : go(step + 1))}>
            {last ? t.intro.go : t.intro.next}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* Kleine Vorführbühne: eine Mini-Karte macht die Geste vor. */
const LOOP = { duration: 3.2, repeat: Infinity, ease: "easeInOut" as const, repeatDelay: 0.4 };

function DemoStage({ demo }: { demo: Demo }) {
  return (
    <div aria-hidden className="relative flex h-36 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-bg/60">
      {/* angedeuteter Stapel dahinter */}
      <div className="absolute h-28 w-20 translate-y-2 scale-95 rounded-xl bg-surface-2/70" />
      {demo === "swipe" && <SwipeDemo />}
      {demo === "maybe" && <MaybeDemo />}
      {demo === "undo" && <UndoDemo />}
    </div>
  );
}

function MiniCard({ children, ...motionProps }: Omit<React.ComponentProps<typeof motion.div>, "children"> & { children?: React.ReactNode }) {
  return (
    <motion.div
      {...motionProps}
      className="absolute flex h-28 w-20 flex-col justify-end overflow-hidden rounded-xl p-2 shadow-[0_10px_24px_rgb(0_0_0/0.45)]"
      style={{ background: "linear-gradient(160deg, #7a2a3c 0%, #45101f 55%, #1a0509 100%)" }}
    >
      <span className="mb-1 block h-1.5 w-10 rounded-full bg-accent/80" />
      <span className="block h-1 w-14 rounded-full bg-text/40" />
      <span className="mt-1 block h-1 w-11 rounded-full bg-text/25" />
      {children}
    </motion.div>
  );
}

function Stamp({
  tone,
  children,
  ...motionProps
}: { tone: "yes" | "no" | "accent"; children: React.ReactNode } & Omit<React.ComponentProps<typeof motion.span>, "children">) {
  const color = { yes: "border-yes text-yes", no: "border-no text-no", accent: "border-accent text-accent" }[tone];
  return (
    <motion.span
      {...motionProps}
      className={`absolute top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border-2 px-1.5 font-display text-sm font-extrabold uppercase ${color}`}
    >
      {children}
    </motion.span>
  );
}

function Finger({ ...motionProps }: React.ComponentProps<typeof motion.span>) {
  return (
    <motion.span
      {...motionProps}
      className="absolute top-1/2 left-1/2 z-10 -mt-3 -ml-3 h-6 w-6 rounded-full border-2 border-text/80 bg-text/30 shadow-[0_0_14px_rgb(246_231_218/0.5)]"
    />
  );
}

function SwipeDemo() {
  const t = useT();
  const times = [0, 0.12, 0.32, 0.44, 0.56, 0.76, 0.88, 1];
  const x = [0, 0, 70, 0, 0, -70, 0, 0];
  return (
    <>
      <MiniCard animate={{ x, rotate: x.map((v) => v / 5) }} transition={{ ...LOOP, times }}>
        <Stamp tone="yes" animate={{ opacity: [0, 0, 1, 0, 0, 0, 0, 0] }} transition={{ ...LOOP, times }}>
          {t.swipe.stampYes}
        </Stamp>
        <Stamp tone="no" animate={{ opacity: [0, 0, 0, 0, 0, 1, 0, 0] }} transition={{ ...LOOP, times }}>
          {t.swipe.stampNo}
        </Stamp>
      </MiniCard>
      <Finger animate={{ x, opacity: [0, 1, 1, 0, 1, 1, 0, 0] }} transition={{ ...LOOP, times }} />
      <span className="absolute left-4 font-display text-2xl font-extrabold text-no">✕</span>
      <span className="absolute right-4 font-display text-2xl font-extrabold text-yes">♥</span>
    </>
  );
}

function MaybeDemo() {
  const t = useT();
  const times = [0, 0.18, 0.5, 0.62, 1];
  const y = [0, 0, -16, 0, 0];
  return (
    <>
      <MiniCard animate={{ y }} transition={{ ...LOOP, times }}>
        <Stamp tone="accent" animate={{ opacity: [0, 0, 1, 0, 0] }} transition={{ ...LOOP, times }}>
          {t.swipe.stampMaybe}
        </Stamp>
      </MiniCard>
      <Finger animate={{ y: [26, 26, 6, 6, 26], opacity: [0, 1, 1, 0, 0] }} transition={{ ...LOOP, times }} />
      <span className="absolute right-5 font-display text-2xl font-extrabold text-accent">↑ ok</span>
    </>
  );
}

function UndoDemo() {
  const t = useT();
  // Karte fliegt links raus, der Zurück-Knopf wird gedrückt, sie kommt wieder
  const times = [0, 0.15, 0.35, 0.55, 0.62, 0.82, 1];
  return (
    <>
      <MiniCard
        animate={{ x: [0, 0, -150, -150, -150, 0, 0], rotate: [0, 0, -20, -20, -20, 0, 0], opacity: [1, 1, 0, 0, 0.6, 1, 1] }}
        transition={{ ...LOOP, times }}
      >
        <Stamp tone="no" animate={{ opacity: [0, 0, 1, 0, 0, 0, 0] }} transition={{ ...LOOP, times }}>
          {t.swipe.stampNo}
        </Stamp>
      </MiniCard>
      <motion.span
        className="absolute right-5 grid h-11 w-11 place-items-center rounded-full border-2 border-line bg-surface text-lg text-muted"
        animate={{
          scale: [1, 1, 1, 1, 0.82, 1, 1],
          rotate: [0, 0, 0, 0, -40, 0, 0],
          borderColor: ["var(--seam)", "var(--seam)", "var(--seam)", "var(--butter)", "var(--butter)", "var(--seam)", "var(--seam)"],
          color: ["var(--rose)", "var(--rose)", "var(--rose)", "var(--butter)", "var(--butter)", "var(--rose)", "var(--rose)"],
        }}
        transition={{ ...LOOP, times }}
      >
        ↺
      </motion.span>
    </>
  );
}
