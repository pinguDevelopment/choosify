import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { localeFromAcceptLanguage, resolveLocale } from "../src/lib/i18n/config.ts";
import { ERROR_TRANSLATIONS, translateError } from "../src/lib/i18n/errors.ts";
import { ALL_TAGS, GENRE_NAMES, GENRE_NAMES_EN, TAG_LABELS_EN, genreNames, tagLabel } from "../src/lib/tags.ts";

test("Browsersprache: Deutsch und Englisch erkannt, sonst Englisch", () => {
  assert.equal(localeFromAcceptLanguage("de-DE,de;q=0.9,en;q=0.8"), "de");
  assert.equal(localeFromAcceptLanguage("de-AT"), "de");
  assert.equal(localeFromAcceptLanguage("en-US,en;q=0.9"), "en");
  assert.equal(localeFromAcceptLanguage("fr-FR,fr;q=0.9,de;q=0.8"), "de", "erste unterstützte Sprache");
  assert.equal(localeFromAcceptLanguage("fr-FR,en;q=0.5,de;q=0.7"), "de", "nach Gewichtung");
  assert.equal(localeFromAcceptLanguage("fr-FR,es"), "en");
  assert.equal(localeFromAcceptLanguage(""), "en");
  assert.equal(localeFromAcceptLanguage(null), "en");
  assert.equal(localeFromAcceptLanguage("de;q=0"), "en", "q=0 heißt: nicht gewünscht");
});

test("Gespeicherte Wahl schlägt Browsersprache, Unsinn im Cookie zählt nicht", () => {
  assert.equal(resolveLocale("en", "de-DE"), "en");
  assert.equal(resolveLocale("de", "en-US"), "de");
  assert.equal(resolveLocale("xx", "de-DE"), "de");
  assert.equal(resolveLocale(undefined, "en-GB"), "en");
});

/** Alle Fehlermeldungen, die der Server an Browser schickt (AppError und jsonError). */
function serverMessages(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name)) files.push(p);
    }
  };
  walk("src/app/api");
  walk("src/lib/server");
  const out = new Set<string>();
  for (const f of files) {
    for (const m of readFileSync(f, "utf8").matchAll(/(?:AppError|jsonError)\(\s*\d{3},\s*"([^"]+)"/g)) out.add(m[1]);
  }
  return [...out];
}

test("Jede Fehlermeldung des Servers hat eine englische Übersetzung", () => {
  const messages = serverMessages();
  assert.ok(messages.length > 30, `gefunden: ${messages.length}`);
  const missing = messages.filter((m) => !ERROR_TRANSLATIONS.en?.[m]);
  assert.deepEqual(missing, []);
  assert.equal(translateError("Die Runde ist voll", "en"), "The round is full");
  assert.equal(translateError("Die Runde ist voll", "de"), "Die Runde ist voll");
  assert.equal(translateError("Etwas Unbekanntes", "en"), "Etwas Unbekanntes");
});

test("Genres und Tags gibt es auf Englisch", () => {
  assert.deepEqual(Object.keys(GENRE_NAMES_EN).sort(), Object.keys(GENRE_NAMES).sort());
  assert.deepEqual(genreNames([35, 12], 3, "en"), ["Comedy", "Adventure"]);
  assert.deepEqual(genreNames([35, 12]), ["Komödie", "Abenteuer"]);
  const missing = ALL_TAGS.filter((t) => !TAG_LABELS_EN[t]);
  assert.deepEqual(missing, []);
  assert.equal(tagLabel("lustig", "en"), "funny");
  assert.equal(tagLabel("lustig", "de"), "lustig");
  for (const label of Object.values(TAG_LABELS_EN)) assert.match(label, /^[a-z]{2,24}$/, label);
});
