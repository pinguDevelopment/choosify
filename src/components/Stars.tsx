"use client";
import { motion } from "motion/react";
import { useState } from "react";

const LABELS = ["", "Schwach", "Ging so", "Okay", "Gut", "Großartig"];
const fmt = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Fünf Sterne zum Anzeigen, teilweise gefüllt (z. B. 3,6). */
export function StarsDisplay({ value, size = "text-base" }: { value: number; size?: string }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className={`relative inline-block leading-none tracking-[0.08em] ${size}`} role="img" aria-label={`${fmt(value)} von 5 Sternen`}>
      <span aria-hidden className="text-line">★★★★★</span>
      <span aria-hidden className="absolute inset-0 overflow-hidden text-accent" style={{ width: `${pct}%` }}>
        ★★★★★
      </span>
    </span>
  );
}

export function Average({ value, count }: { value: number | null; count: number }) {
  if (value == null) return <span className="text-sm text-muted">noch keine Sterne</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <StarsDisplay value={value} />
      <span className="font-semibold">{fmt(value)}</span>
      <span className="text-sm text-muted">({count})</span>
    </span>
  );
}

/** Sterne zum Antippen, als Radiogruppe (auch per Tastatur bedienbar). */
export function StarsInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex flex-col items-center gap-2">
      <div role="radiogroup" aria-label="Sterne" className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <motion.button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? "Stern" : "Sterne"}`}
            tabIndex={value === n || (!value && n === 1) ? 0 : -1}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(Math.min(5, (value || 0) + 1));
              else if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(Math.max(1, (value || 2) - 1));
              else return;
              e.preventDefault();
            }}
            whileTap={{ scale: 0.85 }}
            animate={{ scale: value === n ? [1, 1.25, 1] : 1 }}
            transition={{ duration: 0.3 }}
            className={`px-1 text-[2.9rem] leading-none transition-colors ${n <= shown ? "text-accent drop-shadow-[0_0_10px_rgb(255_201_77/0.45)]" : "text-line"}`}
          >
            ★
          </motion.button>
        ))}
      </div>
      <p className="h-6 font-display text-lg font-bold text-muted" aria-live="polite">
        {LABELS[shown]}
      </p>
    </div>
  );
}
