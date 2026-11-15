# Cinemood mit Home Assistant starten

Ziel: Du sagst „Starte Cinemood“ (oder drückst einen Knopf), der Fernseher geht an und zeigt groß den QR-Code für die Runde. Alle scannen mit dem Handy, wer zuerst beitritt, leitet die Runde.

Home Assistant macht dabei nur zwei Dinge: Fernseher einschalten und einen Link im Browser des Fernsehers öffnen. Alles andere passiert in Cinemood. Ohne Home Assistant geht es genauso: den Link einfach von Hand auf dem Fernseher öffnen (oder als Lesezeichen speichern).

## 1. Link in Cinemood holen

1. Cinemood öffnen, unten auf **Fernseher** tippen (oder `/fernseher` aufrufen).
   Gibt es auf dem Gerät noch keine Crew, zuerst einmal eine Runde starten.
2. Die Dienste wählen, die ihr zu Hause habt (Netflix, Prime Video, …). Diese gelten für jede Runde vom Fernseher.
3. **Fernseher einrichten** drücken, dann **Link kopieren**.
   Der Link sieht so aus: `https://deine-domain/tv#…langer-Code…`

Der Link ist wie ein Schlüssel für eure Crew: Wer ihn hat, kann eine Runde öffnen (mehr nicht). Nicht öffentlich teilen. Ist er doch rausgegangen: **Neuen Link erzeugen**, dann geht der alte nicht mehr (in Home Assistant den neuen eintragen).

Gut zu wissen:
- Wird der Link nochmal geöffnet, solange die Runde läuft, zeigt er dieselbe Runde. Ist sie vorbei (oder älter als 6 Stunden), startet automatisch eine neue.
- Der Fernseher zeigt erst den QR-Code und wer da ist, dann den Fortschritt beim Swipen und am Ende den Gewinner.
- Auch ohne Fernseher-Link kann der Host jeder normalen Runde in der Lobby auf **Auf dem Fernseher zeigen** tippen.

## 2. Skript in Home Assistant anlegen

Einstellungen → Automationen & Szenen → **Skripte** → Skript hinzufügen → oben rechts ⋮ → **In YAML bearbeiten**. Je nach Fernseher einen der Blöcke einfügen. `media_player.fernseher` durch den Namen deines Fernsehers ersetzen (steht unter Einstellungen → Geräte & Dienste → Entitäten) und den Link aus Schritt 1 einsetzen.

### LG (webOS)

Integration: **LG webOS TV**. Damit der Fernseher aus dem Standby angeht, muss in der Integration „Einschalten“ eingerichtet sein (meist per Wake-on-LAN, am Fernseher „Mit Mobilgerät einschalten“ aktivieren).

```yaml
alias: Starte Cinemood
sequence:
  - action: media_player.turn_on
    target:
      entity_id: media_player.fernseher
  - wait_template: "{{ is_state('media_player.fernseher', 'on') }}"
    timeout: "00:00:30"
  - delay: "00:00:05"
  - action: webostv.command
    target:
      entity_id: media_player.fernseher
    data:
      command: system.launcher/open
      payload:
        target: "https://deine-domain/tv#HIER-DEIN-CODE"
```

### Android TV, Google TV, Fire TV

Integration: **Android Debug Bridge** (am Fernseher in den Entwickleroptionen „ADB-Debugging“ bzw. „Netzwerk-Debugging“ einschalten). Auf dem Fernseher muss ein Browser installiert sein (Fire TV: Silk; Google TV z. B. „TV Bro“).

```yaml
alias: Starte Cinemood
sequence:
  - action: media_player.turn_on
    target:
      entity_id: media_player.fernseher
  - delay: "00:00:08"
  - action: androidtv.adb_command
    target:
      entity_id: media_player.fernseher
    data:
      command: am start -a android.intent.action.VIEW -d "https://deine-domain/tv#HIER-DEIN-CODE"
```

### Samsung (Tizen)

Die eingebaute Samsung-Integration kann keine Webseiten öffnen. Mit der Zusatz-Integration **SamsungTV Smart** (über HACS) geht es:

```yaml
alias: Starte Cinemood
sequence:
  - action: media_player.turn_on
    target:
      entity_id: media_player.fernseher
  - delay: "00:00:08"
  - action: media_player.play_media
    target:
      entity_id: media_player.fernseher
    data:
      media_content_type: url
      media_content_id: "https://deine-domain/tv#HIER-DEIN-CODE"
```

### Andere Fernseher / Chromecast ohne Google TV

Ein reiner Chromecast hat keinen Browser. Dann am einfachsten einen Fire-TV-Stick oder ein Google-TV-Gerät nehmen (siehe oben) oder ein Tablet neben dem Fernseher.

Falls ein Fernseher alles nach dem `#` abschneidet: statt `/tv#CODE` geht notfalls auch `/tv?k=CODE`. Das funktioniert genauso, nur taucht der Code dann in den Server-Protokollen auf, deshalb ist `#` die bessere Wahl.

## 3. Per Sprache oder Knopf starten

**Sprachassistent von Home Assistant (Assist):** Automation anlegen, ebenfalls „In YAML bearbeiten“:

```yaml
alias: Cinemood per Sprache
triggers:
  - trigger: conversation
    command:
      - Starte Cinemood
      - Cinemood starten
actions:
  - action: script.starte_cinemood
```

(`script.starte_cinemood` ist der Name des Skripts aus Schritt 2, steht in der Skript-Übersicht.)

**Alexa oder Google Assistant:** Das Skript über Home Assistant Cloud (oder die jeweilige Integration) freigeben, dann z. B. „Alexa, schalte Starte Cinemood ein“ bzw. eine Routine „Starte Cinemood“ anlegen, die das Skript ausführt.

**Knopf:** Das Skript auf dem Dashboard als Karte hinzufügen oder einem Zigbee-Taster zuweisen.

## Wenn etwas nicht klappt

- **„Dieser Fernseher-Link gilt nicht mehr“**: Es wurde ein neuer Link erzeugt oder der Fernseher-Link ausgeschaltet. Den aktuellen Link unter **Fernseher** kopieren und im Skript ersetzen. Das passiert auch, wenn sich `APP_SECRET` in Vercel ändert.
- **„Die Datenbank ist noch nicht auf dem neuesten Stand“**: Das SQL-Update (`supabase/update-auf-aktuell.sql`) im Supabase SQL Editor ausführen.
- **Fernseher geht an, aber kein Browser**: Kurz länger warten lassen (`delay` erhöhen), manche Fernseher brauchen nach dem Einschalten 10 bis 15 Sekunden.
- **Neue Domain**: Im Link nur den Teil vor `/tv#` austauschen, der Code bleibt gleich.
