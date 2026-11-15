# Cinemood auf dem Android-Fernseher

Die App **Cinemood TV** öffnet die Fernseher-Seite (`/tv`) im Vollbild. Am Fernseher musst du nichts
bedienen: Er zeigt einen 6-stelligen Code, den gibst du als Host in der Lobby am Handy ein. Danach zeigt
der Fernseher den QR-Code zum Mitmachen, den Fortschritt und am Ende den Gewinnerfilm.

Die App läuft auf **Android TV und Google TV** (z. B. Chromecast mit Google TV, Nvidia Shield,
Fire TV Stick, Sony, Philips, TCL). Samsung-Fernseher (Tizen) und LG (webOS) sind kein Android, dort
öffnest du einfach `/tv` im Browser des Fernsehers.

## Herunterladen

- Direkter Link zur aktuellen APK:
  `https://github.com/pinguDevelopment/cinemood/releases/download/tv-app/cinemood-tv.apk`
- Kurz (leitet auf denselben Link weiter): `cinemood.yugusaa.de/tv-app`

Die APK wird bei jeder Änderung an der App automatisch neu gebaut (GitHub Actions, Workflow
„Android-TV-App“).

## Installieren mit der Downloader-App (am einfachsten)

1. Am Fernseher im Play Store die App **Downloader** (von AFTVnews) installieren.
2. Einstellungen des Fernsehers öffnen: **Apps → Sicherheit & Einschränkungen → Unbekannte Quellen**
   und dort **Downloader** erlauben. (Bei Google TV: **Einstellungen → System → Info**, siebenmal auf
   **Android TV OS-Build** klicken, um die Entwickleroptionen freizuschalten; danach unter
   **Apps → Sicherheit & Einschränkungen → Unbekannte Apps installieren** Downloader erlauben.
   Bei Fire TV: **Mein Fire TV → Entwickleroptionen → Apps unbekannter Herkunft installieren**.)
3. Downloader öffnen und als Adresse `cinemood.yugusaa.de/tv-app` eingeben, dann **Go**.
4. Nach dem Download auf **Installieren** drücken. Die APK danach ruhig löschen lassen.
5. Cinemood erscheint jetzt bei den Apps auf dem Startbildschirm.

## Installieren per adb (vom Computer aus)

1. Am Fernseher die Entwickleroptionen freischalten (siehe oben) und dort **USB-Debugging** bzw.
   **Netzwerk-Debugging** einschalten. Die IP-Adresse steht unter **Netzwerk & Internet**.
2. Am Computer (mit den Android Platform Tools):
   ```bash
   adb connect 192.168.1.50      # IP des Fernsehers
   adb install -r cinemood-tv.apk
   ```
3. Beim ersten Verbinden fragt der Fernseher, ob er den Computer erlauben soll: **Ja**.

## Bedienung

- App starten: Der Code zum Koppeln erscheint sofort. Der Bildschirm bleibt an, solange die App läuft.
- **Menü-Taste** oder **OK etwa eine Sekunde halten**: Einstellungen öffnen. Dort kannst du die
  Server-Adresse ändern, die **Seite neu laden** (z. B. wenn sie hängt) und **nach Updates suchen**.
- **Zurück zweimal drücken**: App beenden.
- Ist der Server nicht erreichbar, zeigt die App einen Hinweis und versucht es alle 10 Sekunden erneut.

## Eigene Domain oder eigener Server

Standardmäßig öffnet die App `https://cinemood.yugusaa.de/tv`. Wer Cinemood selbst betreibt, trägt
seine eigene Adresse ein:

- **In der App:** Menü-Taste (oder OK halten), Adresse eintippen, z. B. `film.example.de` oder
  `http://192.168.1.20:3000` für einen Server im Heimnetz, dann **Speichern**. `https://` und `/tv`
  ergänzt die App selbst. **Standard** setzt die Adresse zurück.
- **Fest eingebaut:** Auf GitHub unter **Actions → Android-TV-App → Run workflow** im Feld
  „Server-Adresse“ die eigene Adresse eintragen. Die fertige APK liegt danach in dem Lauf unter
  **Artifacts**. (Dieser Lauf ersetzt die öffentliche APK nicht.)

## Updates

Die App sucht bei jedem Start auf GitHub nach einer neuen Version (Release `tv-app`, Datei
`version.json`). Gibt es eine, fragt sie: **Installieren** lädt die neue Version herunter, danach fragt
Android selbst noch einmal „Diese App aktualisieren?“. Die Einstellungen bleiben erhalten. Von Hand geht
das im Menü mit **Nach Updates suchen**.

Beim ersten Update muss man der App einmal erlauben, Apps zu installieren. Die App öffnet die passende
Einstellung, wenn es geht. Bei Fire TV: **Mein Fire TV → Entwickleroptionen → Apps unbekannter Herkunft
installieren → Cinemood** einschalten.

Wer noch eine ältere App ohne den Knopf „Nach Updates suchen“ hat, aktualisiert einmal von Hand: die neue APK
genauso installieren wie beim ersten Mal, die alte Version wird ersetzt und die Einstellungen bleiben
erhalten. Alle Versionen sind mit demselben Schlüssel signiert
(`android-tv/signing/sideload.jks`). Wer einen eigenen, geheimen Schlüssel möchte, legt in GitHub unter
**Settings → Secrets and variables → Actions** die Secrets `CINEMOOD_KEYSTORE_B64` (die .jks-Datei
als Base64), `CINEMOOD_KEYSTORE_PASSWORD`, `CINEMOOD_KEY_ALIAS` und `CINEMOOD_KEY_PASSWORD` an. Achtung:
Nach einem Schlüsselwechsel muss die alte App einmal deinstalliert werden.
