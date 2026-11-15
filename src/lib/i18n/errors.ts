// Fehlermeldungen der API kommen auf Deutsch vom Server und werden im Browser übersetzt.
// tests/i18n.test.ts prüft, dass jede Meldung aus src/ hier eine Übersetzung hat.
import type { Locale } from "./config.ts";

const EN: Record<string, string> = {
  "Origin fehlt": "Origin missing",
  "Fremde Origin. Für Tunnel/Port-Forwarding die Adresse in ALLOWED_ORIGINS eintragen.":
    "Foreign origin. For tunnels/port forwarding, add the address to ALLOWED_ORIGINS.",
  "JSON erwartet": "JSON expected",
  "Anfrage zu groß": "Request too large",
  "Ungültiges JSON": "Invalid JSON",
  "Ungültige Eingabe": "Invalid input",
  "Zu viele Anfragen, bitte kurz warten": "Too many requests, please wait a moment",
  "Nicht angemeldet": "Not signed in",
  "Auf diesem Gerät gibt es keine Crew zum Übernehmen": "There’s no crew on this device to take over",
  "Dein Konto hat schon die maximale Zahl an Crews": "Your account already has the maximum number of crews",
  "Crew nicht gefunden": "Crew not found",
  "Auf diesem Gerät gibt es noch keine Crew. Starte zuerst eine Runde.": "There’s no crew on this device yet. Start a round first.",
  "Runde nicht gefunden": "Round not found",
  "Du bist dieser Runde nicht beigetreten": "You haven’t joined this round",
  "Keine Crew gefunden": "No crew found",
  "Ungültige Region": "Invalid region",
  "Suchbegriff 2 bis 100 Zeichen": "Search term must be 2 to 100 characters",
  "Für diese Crew ist noch kein Fernseher eingerichtet": "No TV has been set up for this crew yet",
  "Dieser Fernseher-Link gilt nicht mehr. Im Web unter „Fernseher“ gibt es den aktuellen.":
    "This TV link is no longer valid. You’ll find the current one on the “TV” page.",
  "Gerade wurde schon eine Runde gestartet, bitte neu laden": "A round was just started, please reload",
  "Gerade wurden zu viele Mails verschickt. Bitte in ein paar Minuten nochmal.":
    "Too many emails were sent just now. Please try again in a few minutes.",
  "Die Anmelde-Mail konnte nicht verschickt werden. Bitte später nochmal versuchen.":
    "The sign-in email couldn’t be sent. Please try again later.",
  "Der Link oder Code ist ungültig oder abgelaufen. Fordere einfach einen neuen an.":
    "The link or code is invalid or expired. Just request a new one.",
  "Zu viele Versuche. Bitte kurz warten.": "Too many attempts. Please wait a moment.",
  "Anmeldung gerade nicht möglich. Bitte später nochmal.": "Signing in isn’t possible right now. Please try again later.",
  "Die Datenbank ist noch nicht auf dem neuesten Stand. Der Host muss die SQL-Updates einspielen.":
    "The database isn’t up to date yet. The host needs to run the SQL updates.",
  "Interner Fehler": "Internal error",
  "Dieser Bewertungslink ist ungültig": "This rating link is invalid",
  "Diesen Film gibt es im Abspann nicht mehr": "This movie is no longer in the credits",
  "Diesen Namen hat bei diesem Film schon jemand anderes benutzt": "Someone else already used this name for this movie",
  "Diesen Film haben schon genug Leute bewertet": "Enough people have already rated this movie",
  "Diese Runde ist schon beendet": "This round has already ended",
  "Die Runde ist voll": "The round is full",
  "Dieser Name ist schon vergeben": "This name is already taken",
  "Nur der Host kann starten": "Only the host can start",
  "Die Runde läuft schon": "The round is already running",
  "Keine passenden Filme gefunden, die gerade im Abo laufen. Wähle mehr Dienste oder Genres.":
    "No matching movies found that are currently included in your subscriptions. Pick more services or genres.",
  "Gerade wird nicht abgestimmt": "Voting isn’t open right now",
  "Unbekannter Film": "Unknown movie",
  "Nur der Host kann beenden": "Only the host can end the vote",
  "Die Abstimmung ist schon beendet": "Voting has already ended",
  "Gerade läuft keine Stichwahl": "There’s no runoff right now",
  "Dieser Film ist nicht in der Stichwahl": "This movie isn’t in the runoff",
  "Der Abspann ist voll": "The credits are full",
};

const TABLES: Partial<Record<Locale, Record<string, string>>> = { en: EN };

/** Übersetzt eine Fehlermeldung des Servers; Unbekanntes bleibt, wie es ist. */
export function translateError(message: string, locale: Locale): string {
  return TABLES[locale]?.[message] ?? message;
}

export const ERROR_TRANSLATIONS = TABLES;
