"use client";
import { motion } from "motion/react";
import { useId } from "react";

const SPRING = { type: "spring", stiffness: 600, damping: 34 } as const;

/**
 * Schalter zum An- und Ausmachen (statt Häkchen). Der ganze Bereich mit Text ist antippbar,
 * Screenreader hören „Schalter, an/aus“.
 */
export function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  label: React.ReactNode;
  hint?: React.ReactNode;
}) {
  const hintId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={hint ? hintId : undefined}
      onClick={() => onChange(!checked)}
      className="group flex w-full items-center gap-3 rounded-2xl text-left"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold text-text">{label}</span>
        {hint && (
          <span id={hintId} className="text-sm text-muted">
            {hint}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 p-0.5 transition-colors duration-200 ${
          checked ? "justify-end border-accent bg-accent" : "justify-start border-line bg-surface-2 group-hover:border-muted"
        }`}
      >
        <motion.span
          layout
          transition={SPRING}
          className={`h-6 w-6 rounded-full shadow-md ${checked ? "bg-accent-ink" : "bg-muted"}`}
        />
      </span>
    </button>
  );
}
