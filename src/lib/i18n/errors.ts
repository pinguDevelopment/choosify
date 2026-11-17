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
  "Diese Einladung ist ungültig oder abgelaufen": "This invitation is invalid or has expired",
  "Diese Crew ist voll": "This crew is full",
  "Nur wer die Crew angelegt hat, kann andere entfernen": "Only the person who created the crew can remove others",
  "Du bist allein in dieser Crew": "You’re the only one in this crew",
  "Auf diesem Gerät gibt es noch keine Crew. Starte zuerst eine Runde.": "There’s no crew on this device yet. Start a round first.",
  "Runde nicht gefunden": "Round not found",
  "Du bist dieser Runde nicht beigetreten": "You haven’t joined this round",
  "Keine Crew gefunden": "No crew found",
  "Ungültige Region": "Invalid region",
  "Suchbegriff 2 bis 100 Zeichen": "Search term must be 2 to 100 characters",
  "Gerade ist viel los, bitte gleich nochmal versuchen": "It’s busy right now, please try again in a moment",
  "Nur der Host kann den Fernseher verbinden": "Only the host can connect the TV",
  "Diesen Code gibt es nicht (mehr). Schau nochmal auf den Fernseher.":
    "That code doesn’t exist (anymore). Take another look at the TV.",
  "Gerade wurden zu viele Mails verschickt. Bitte in ein paar Minuten nochmal.":
    "Too many emails were sent just now. Please try again in a few minutes.",
  "Die Anmelde-Mail konnte nicht verschickt werden. Bitte später nochmal versuchen.":
    "The sign-in email couldn’t be sent. Please try again later.",
  "Der Link oder Code ist ungültig oder abgelaufen. Fordere einfach einen neuen an.":
    "The link or code is invalid or expired. Just request a new one.",
  "Zu viele Versuche. Bitte kurz warten.": "Too many attempts. Please wait a moment.",
  "Anmeldung gerade nicht möglich. Bitte später nochmal.": "Signing in isn’t possible right now. Please try again later.",
  "Anmeldung ist auf diesem Server ausgeschaltet": "Signing in is turned off on this server",
  "Die Datenbank ist noch nicht auf dem neuesten Stand. Der Host muss die SQL-Updates einspielen.":
    "The database isn’t up to date yet. The host needs to run the SQL updates.",
  "Interner Fehler": "Internal error",
  "Filmdetails gerade nicht erreichbar": "Movie details aren’t available right now",
  "Dieser Bewertungslink ist ungültig": "This rating link is invalid",
  "Diesen Film gibt es auf der Watchlist nicht mehr": "This movie is no longer on the watchlist",
  "Diesen Namen hat bei diesem Film schon jemand anderes benutzt": "Someone else already used this name for this movie",
  "Diesen Film haben schon genug Leute bewertet": "Enough people have already rated this movie",
  "Diese Runde ist schon beendet": "This round has already ended",
  "Die Runde ist voll": "The round is full",
  "Dieser Name ist schon vergeben": "This name is already taken",
  "Nur der Host kann starten": "Only the host can start",
  "Die Runde läuft schon": "The round is already running",
  "Keine passenden Filme gefunden, die gerade im Abo laufen. Wähle mehr Dienste, mehr Genres oder einen größeren Zeitraum.":
    "No matching movies found that are currently included in your subscriptions. Pick more services, more genres or a wider time span.",
  "Keine passenden Filme gefunden, die gerade im Abo laufen. Wähle mehr Dienste oder Genres.":
    "No matching movies found that are currently included in your subscriptions. Pick more services or genres.",
  "Gerade wird nicht abgestimmt": "Voting isn’t open right now",
  "Unbekannter Film": "Unknown movie",
  "Die Anmeldung mit Google ist abgelaufen oder ungültig. Bitte nochmal versuchen.":
    "Signing in with Google expired or is invalid. Please try again.",
  "Dein Google-Konto hat keine E-Mail-Adresse freigegeben.": "Your Google account didn’t share an email address.",
  "Du hast schon sehr viele Filme bewertet. Setz das Training zurück, um neu anzufangen.":
    "You’ve already rated a lot of movies. Reset your training to start over.",
  "Nur der Host kann beenden": "Only the host can end the vote",
  "Die Abstimmung ist schon beendet": "Voting has already ended",
  "Gerade läuft keine Stichwahl": "There’s no runoff right now",
  "Dieser Film ist nicht in der Stichwahl": "This movie isn’t in the runoff",
  "Die Watchlist ist voll": "The watchlist is full",
};

const TABLES: Partial<Record<Locale, Record<string, string>>> = { en: EN };

/** Übersetzt eine Fehlermeldung des Servers; Unbekanntes bleibt, wie es ist. */
export function translateError(message: string, locale: Locale): string {
  return TABLES[locale]?.[message] ?? message;
}

export const ERROR_TRANSLATIONS = TABLES;
