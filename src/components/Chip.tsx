"use client";
import { AnimatePresence, motion } from "motion/react";

const SPRING = { type: "spring", stiffness: 520, damping: 30 } as const;

/** Auswahl-Pille mit weichem Umschalten: gibt beim Tippen nach, Häkchen schiebt sich rein. */
export function Chip({
  pressed,
  onToggle,
  children,
}: {
  pressed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      layout
      className="chip inline-flex items-center"
      aria-pressed={pressed}
      onClick={onToggle}
      whileTap={{ scale: 0.92 }}
      animate={{ scale: pressed ? [1, 1.07, 1] : 1 }}
      transition={{ layout: SPRING, scale: { duration: 0.32, ease: "easeOut" } }}
    >
      <AnimatePresence initial={false}>
        {pressed && (
          <motion.span
            aria-hidden
            className="inline-block overflow-hidden font-bold"
            initial={{ width: 0, opacity: 0, x: -6 }}
            animate={{ width: "1.1em", opacity: 1, x: 0 }}
            exit={{ width: 0, opacity: 0, x: -6 }}
            transition={SPRING}
          >
            ✓
          </motion.span>
        )}
      </AnimatePresence>
      <span className="inline-flex items-center gap-2">{children}</span>
    </motion.button>
  );
}
