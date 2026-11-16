# Cinemood Handy-App (Android)

Android-App für Handy und Tablet: Runden erstellen, per QR-Code beitreten und abstimmen, mit Anmeldung über Google.
Die App zeigt die Web-App von Cinemood in einer WebView. Installation und Einrichtung: [Deutsch](../docs/de/android-app.md) · [English](../docs/en/android-app.md).

- Code: `app/src/main/java/app/cinemood/handy/`
  - `MainActivity`: WebView, Google-Anmeldung im Custom Tab, Rücksprung über `cinemood://anmelden`, QR-Links (`/r/…`)
  - `SettingsActivity`: Server-Adresse, Seite neu laden, Updates (App-Symbol lange drücken → Einstellungen)
  - `Updater`: sucht im GitHub-Release `handy-app` nach neuen Versionen
- Bauen: `./gradlew assembleRelease` (braucht JDK 17 und das Android SDK). Das macht normalerweise GitHub Actions
  (`.github/workflows/android-app.yml`). Signiert wird mit demselben Sideload-Schlüssel wie die TV-App (`../android-tv/signing/`).
- Start-Adresse beim Bauen ändern (Standard: https://cinemood.yugusaa.de): `CINEMOOD_URL=https://film.example.de ./gradlew assembleRelease`
