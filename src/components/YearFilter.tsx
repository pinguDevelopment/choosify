"use client";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Chip } from "@/components/Chip";
import { useT } from "@/components/I18nProvider";
import { normalizeYears, YEAR_MAX, YEAR_MIN, type YearRange } from "@/lib/candidates";

type Preset = "any" | "2020" | "2010" | "2000" | "old" | "custom";
// Feste Reihenfolge (Object.keys würde Zahlen-Schlüssel wie "2020" nach vorne sortieren)
const ORDER: Preset[] = ["any", "2000", "2010", "2020", "old", "custom"];
const PRESETS: Record<Exclude<Preset, "custom">, YearRange> = {
  any: { from: null, to: null },
  "2020": { from: 2020, to: null },
  "2010": { from: 2010, to: null },
  "2000": { from: 2000, to: null },
  old: { from: null, to: 1999 },
};

function presetOf(y: YearRange): Preset {
  const hit = (Object.keys(PRESETS) as (keyof typeof PRESETS)[]).find((k) => PRESETS[k].from === y.from && PRESETS[k].to === y.to);
  return hit ?? "custom";
}

const parseYear = (s: string): number | null => {
  const n = Number(s);
  return s.trim() && Number.isInteger(n) && n >= YEAR_MIN && n <= YEAR_MAX ? n : null;
};

/**
 * Host wählt, aus welcher Zeit die Filme kommen: schnelle Vorgaben ("ab 2000", "vor 2000")
 * oder ein eigener Zeitraum mit Jahr von/bis. Ein leeres Feld heißt: keine Grenze.
 */
export function YearFilter({ value, onChange }: { value: YearRange; onChange: (y: YearRange) => void }) {
  const t = useT();
  const [preset, setPreset] = useState<Preset>(() => presetOf(value));
  const [from, setFrom] = useState(value.from?.toString() ?? "");
  const [to, setTo] = useState(value.to?.toString() ?? "");

  function choose(p: Preset) {
    setPreset(p);
    if (p === "custom") onChange(normalizeYears({ from: parseYear(from), to: parseYear(to) }));
    else onChange(PRESETS[p]);
  }

  function edit(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    onChange(normalizeYears({ from: parseYear(nextFrom), to: parseYear(nextTo) }));
  }

  const label: Record<Preset, string> = {
    any: t.years.any,
    "2020": t.years.since(2020),
    "2010": t.years.since(2010),
    "2000": t.years.since(2000),
    old: t.years.before(2000),
    custom: t.years.custom,
  };
  const invalid = (s: string) => s.trim() !== "" && parseYear(s) == null;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-muted">
        <span className="block text-lg text-text">{t.years.title}</span>
        <span className="text-sm">{t.years.hint}</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {ORDER.map((p) => (
          <Chip key={p} pressed={preset === p} onToggle={() => choose(p)}>
            {label[p]}
          </Chip>
        ))}
      </div>
      <AnimatePresence initial={false}>
        {preset === "custom" && (
          <motion.div
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="flex items-end gap-3 pt-1">
              <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
                {t.years.from}
                <input
                  className={`input py-2.5 ${invalid(from) ? "border-no" : ""}`}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder={t.years.fromPlaceholder}
                  value={from}
                  aria-invalid={invalid(from)}
                  onChange={(e) => edit(e.target.value.replace(/\D/g, ""), to)}
                />
              </label>
              <span aria-hidden className="pb-3 text-muted">
                –
              </span>
              <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
                {t.years.to}
                <input
                  className={`input py-2.5 ${invalid(to) ? "border-no" : ""}`}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder={t.years.toPlaceholder}
                  value={to}
                  aria-invalid={invalid(to)}
                  onChange={(e) => edit(from, e.target.value.replace(/\D/g, ""))}
                />
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </fieldset>
  );
}
