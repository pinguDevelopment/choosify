# Cinemood TV (Android TV / Google TV)

Kleine Android-App, die die Fernseher-Seite `/tv` von Cinemood im Vollbild in einer WebView öffnet.
Installation und Bedienung: [docs/android-tv.md](../docs/android-tv.md).

- Code: `app/src/main/java/app/cinemood/tv/` (eine Activity für die Seite, eine für die Server-Adresse)
- Bauen: `./gradlew assembleRelease` (braucht JDK 17 und das Android SDK), Ergebnis unter
  `app/build/outputs/apk/release/`. Das macht normalerweise GitHub Actions (`.github/workflows/android-tv.yml`).
- Start-Adresse beim Bauen ändern (Standard: https://cinemood.yugusaa.de): `CINEMOOD_URL=https://film.example.de ./gradlew assembleRelease`
