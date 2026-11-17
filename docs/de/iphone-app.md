[English](../en/iphone-app.md) · **Deutsch**

# Cinemood auf dem iPhone (kostenlos, ohne App Store)

Cinemood läuft auf iPhone und iPad wie eine App: eigenes Symbol auf dem Home-Bildschirm, Vollbild ohne
Adresszeile, Navigationsleiste unten (**Lobby**, **Watchlist**, **Trainieren**, **Konto**) wie in der Android-App.
Dafür braucht es weder App Store noch TestFlight noch einen Apple-Entwickler-Account. Die App ist immer auf dem
neuesten Stand, weil sie direkt die Webseite nutzt.

## Installieren (30 Sekunden)

1. Am iPhone in Safari `cinemood.yugusaa.de/ios-app` öffnen. Dort steht dieselbe Anleitung mit Bildern.
2. Auf das **Teilen-Symbol** tippen (Quadrat mit Pfeil nach oben). Siehst du es nicht, zuerst unten rechts auf **···** tippen.
3. Etwas nach unten scrollen und **Zum Home-Bildschirm** antippen.
4. **Als Web-App öffnen** eingeschaltet lassen und oben rechts auf **Hinzufügen** tippen.
5. Ab jetzt Cinemood über das neue Symbol starten.

Chrome und Edge auf dem iPhone können das auch: Teilen-Symbol neben der Adresszeile, dann **Zum Home-Bildschirm**.

iPhone-Besucher sehen auf der Startseite außerdem einen kleinen Hinweis dazu (lässt sich mit ✕ ausblenden).

## An Freunde verteilen

Einfach den Link `cinemood.yugusaa.de/ios-app` schicken (auf der Seite gibt es dafür den Knopf **Link teilen**).
Jeder installiert Cinemood damit selbst, kostenlos und ohne Ablaufdatum. Android-Nutzer bekommen auf derselben
Seite den Link zur Android-App.

## Anmelden in der App

- **Mit Google:** Unter **Konto** auf **Mit Google anmelden** tippen. iOS öffnet die Google-Anmeldung kurz in einem
  Browserfenster über der App und springt danach zurück.
- **Per Mail:** Den **Code aus der Mail** in der App eintippen. Der Link in der Mail öffnet Safari und nicht die App,
  die Anmeldung landet dann in Safari statt in der App.

Wichtig: Die App vom Home-Bildschirm hat ihren eigenen Speicher, getrennt von Safari. Wer in Safari schon
angemeldet war, meldet sich in der App einmal neu an.

## Was anders ist als bei einer App aus dem App Store

- Kein Eintrag im App Store, keine automatische Installation per Link (man tippt einmal **Zum Home-Bildschirm**).
- QR-Codes von Runden öffnen sich in Safari, nicht in der App. Mitmachen klappt dort genauso.
- Updates passieren von selbst: Jede neue Version der Webseite ist sofort auch in der App.

## Andere Wege (zum Vergleich)

| Weg | Kosten | Haltbarkeit | Was man braucht |
| --- | --- | --- | --- |
| **Zum Home-Bildschirm** (diese Anleitung) | kostenlos | unbegrenzt | nur Safari |
| TestFlight / App Store | 99 $ pro Jahr (Apple Developer Program) | TestFlight-Builds 90 Tage, App Store unbegrenzt | Apple-Entwickler-Account, Prüfung durch Apple |
| Sideloadly / AltStore mit kostenloser Apple-ID | kostenlos | 7 Tage, dann neu installieren | Mac oder PC, Kabel, höchstens 3 Apps pro Apple-ID, jeder Freund muss das selbst machen |

Zum kostenlosen Verteilen an Freunde ist **Zum Home-Bildschirm** deshalb der einzige Weg, der dauerhaft funktioniert.
Eine native iOS-App ließe sich später ergänzen, falls doch ein Apple-Entwickler-Account dazukommt.

## Technik (für Entwickler)

- Manifest: `src/app/manifest.ts`, Symbole und Startbilder: `public/app/`
- iPhone-Metadaten (Symbol, Startbilder, Statusleiste, `viewport-fit=cover`): `src/app/[lang]/layout.tsx`
- Navigationsleiste nur im App-Modus: `src/components/AppNav.tsx` (setzt die Klasse `app` auf `<html>`, Abstände in `globals.css`)
- Hinweis auf der Startseite: `src/components/IosInstallHint.tsx`, Anleitungsseite: `/ios-app`
