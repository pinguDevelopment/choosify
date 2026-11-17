[English](../en/android-app.md) · **Deutsch**

# Cinemood als App fürs Handy (Android, z. B. Samsung Galaxy)

Die App **Cinemood** fürs Handy und Tablet kann alles, was die Webseite kann: Runde erstellen, Freunde per
QR-Code einladen, Genres wählen und abstimmen. Dazu kommt die **Anmeldung mit Google**: Einmal antippen,
Google-Konto auswählen, fertig. Deine Crews, die Watchlist und deine Lieblingsdienste hängen an diesem Konto
und sind auf jedem Gerät da, auf dem du dich mit demselben Google-Konto anmeldest.

Gäste brauchen weder die App noch ein Konto. Sie scannen den QR-Code und machen im Browser mit.

## Herunterladen und installieren

1. Am Handy im Browser `cinemood.yugusaa.de/handy-app` öffnen. Das lädt die aktuelle APK
   (`https://github.com/pinguDevelopment/cinemood/releases/download/handy-app/cinemood-handy.apk`).
2. Die heruntergeladene Datei antippen. Beim ersten Mal fragt Android, ob der Browser (Samsung Internet
   oder Chrome) Apps installieren darf: **Einstellungen → Zulassen**, dann zurück und **Installieren**.
3. Google Play Protect warnt eventuell vor einer „unbekannten App“, weil sie nicht aus dem Play Store kommt:
   **Weitere Details → Trotzdem installieren**.
4. Cinemood öffnen. Unter **Konto** auf **Mit Google anmelden** tippen.

Die App sucht beim Start selbst nach neuen Versionen und fragt, ob sie das Update installieren soll.
Dafür einmal erlauben, dass Cinemood Apps installieren darf (die App führt dich hin).

## QR-Codes direkt in der App öffnen

Scannt jemand mit installierter App einen Einladungs-QR-Code, öffnet Android die Runde direkt in der App.
Klappt das nicht und es öffnet sich der Browser: **Einstellungen → Apps → Cinemood → Als Standard festlegen →
Unterstützte Links öffnen** einschalten.

## Einstellungen

Cinemood-Symbol auf dem Startbildschirm **lange drücken → Einstellungen**: andere Server-Adresse (eigener Server),
Seite neu laden, nach Updates suchen.

## Wie die Google-Anmeldung in der App funktioniert

Google erlaubt die Anmeldung nicht innerhalb einer App-Ansicht (WebView). Die App öffnet die Anmeldung deshalb
kurz im Browser (sieht aus wie ein Fenster der App), danach springt sie automatisch zurück in die App.
Dabei wandert nur ein kurzlebiges, signiertes Ticket zurück, das nur zusammen mit einem Geheimnis gilt, das
allein die App kennt. Die eigentliche Anmeldung landet so in der App und nicht im Browser.

Voraussetzung: Google ist in Supabase eingerichtet, siehe [login-einrichten.md](login-einrichten.md#google-login-einrichten).
Ohne diese Einrichtung zeigt die App (und die Webseite) einfach keinen Google-Knopf.

## Eigener Server oder eigener Signier-Schlüssel

- Andere Start-Adresse beim Bauen: In GitHub unter **Actions → Handy-App → Run workflow** eine Adresse eintragen.
- Die App wird mit demselben Sideload-Schlüssel signiert wie die TV-App. Wer per GitHub-Secret
  `CINEMOOD_KEYSTORE_B64` einen eigenen Schlüssel nutzt, trägt dessen SHA-256-Fingerabdruck in Vercel als
  `ANDROID_CERT_SHA256` ein, sonst öffnen QR-Codes im Browser statt in der App
  (`keytool -list -v -keystore eigener.jks` zeigt den Fingerabdruck).
