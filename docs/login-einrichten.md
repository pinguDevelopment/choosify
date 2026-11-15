# Login per Magic-Link einrichten (Supabase)

Das Konto ist freiwillig und nur für Hosts gedacht. Gäste treten weiterhin nur mit ihrem Namen bei.
Mit Konto sind Crews, Abspann und Lieblingsdienste auf jedem Gerät da.

Neue Umgebungsvariablen braucht es nicht. Der Server nutzt die vorhandene `SUPABASE_URL` und den Service-Role-Key.

## 1. Datenbank aktualisieren (vor dem Merge!)

Im Supabase-Dashboard unter **SQL Editor** den kompletten Inhalt von `supabase/update-auf-aktuell.sql` einfügen und **Run** klicken.
Die Prüfung ganz unten muss ein leeres Ergebnis liefern.

## 2. E-Mail-Login einschalten

**Authentication → Sign In / Providers → Email**

- *Enable Email provider*: an
- *Confirm email*: an (Standard)
- Unter **Authentication → Sign In / Providers** muss *Allow new users to sign up* an sein, sonst kann sich niemand zum ersten Mal anmelden.

## 3. Adressen erlauben

**Authentication → URL Configuration**

- **Site URL**: deine Produktions-Adresse, z. B. `https://cinemood.vercel.app`
- **Redirect URLs** (jede Zeile einzeln mit *Add URL*):
  - `http://localhost:3000/**` (lokal mit `npm run dev`)
  - `https://*.*.devtunnels.ms/**` (VS-Code-Port-Forwarding, Adressen wie `abc123-3000.euw.devtunnels.ms`)
  - `https://cinemood-*-steallights-projects.vercel.app/**` (Vercel-Vorschauen pro PR)
  - `https://cinemood.vercel.app/**` bzw. deine eigene Domain

Die Vercel-Adressen hängen am Namen des Vercel-Projekts. Heißt das Projekt noch anders (z. B. `choosify` oder `filmabend`),
lauten sie entsprechend `choosify.vercel.app` bzw. `choosify-*-steallights-projects.vercel.app`. Nach einer Umbenennung oder
neuen Domain hier die neuen Adressen eintragen (die alten können stehen bleiben, bis niemand sie mehr nutzt).

Der Link in der Mail führt immer zurück auf die Adresse, auf der die Anmeldung angefordert wurde.
Steht diese Adresse nicht in der Liste, schickt Supabase den Link auf die Site URL. Die App fängt das auf der Startseite ab,
aber dann landet man eben auf der Produktion statt lokal.

## 4. Mail-Vorlagen anpassen

**Authentication → Emails → Templates**. Beide Vorlagen **Magic Link** und **Confirm signup** bekommen denselben Inhalt
(neue Adressen bekommen beim ersten Mal „Confirm signup“, danach „Magic Link“).

Supabase kennt nur eine Vorlage für alle, deshalb ist die Mail zweisprachig (Deutsch und Englisch).

Betreff: `Dein Login für Cinemood · Your Cinemood sign-in`

```html
<h2>Bei Cinemood anmelden</h2>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Jetzt anmelden</a></p>
<p>Oder gib diesen Code in der App ein: <strong>{{ .Token }}</strong></p>
<p>Der Code ist praktisch, wenn die Mail auf einem anderen Gerät ankommt als dem, auf dem du dich anmelden willst.</p>
<p>Du hast das nicht angefordert? Dann ignoriere diese Mail einfach.</p>
<hr>
<h2>Sign in to Cinemood</h2>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Sign in now</a></p>
<p>Or enter this code in the app: <strong>{{ .Token }}</strong></p>
<p>The code is handy if this email arrives on a different device than the one you want to sign in on.</p>
<p>Didn’t request this? Just ignore this email.</p>
```

Wichtig: `{{ .RedirectTo }}` und `{{ .TokenHash }}` müssen genau so drinstehen. Die Standardvorlage mit `{{ .ConfirmationURL }}`
funktioniert nicht, weil die App sich nur über ihren eigenen Server anmeldet.

## 5. Mailversand (SMTP)

Der eingebaute Mailversand von Supabase ist nur zum Ausprobieren: Er schickt nur an Adressen aus deinem Supabase-Team
und nur sehr wenige Mails pro Stunde. Für Freunde braucht es einen eigenen SMTP-Dienst, z. B. Resend, Brevo oder Postmark
(alle mit kostenlosem Kontingent).

**Authentication → Emails → SMTP Settings**: *Enable custom SMTP* an, dann Host, Port, Benutzer, Passwort und Absender
vom Mail-Dienst eintragen. Danach unter **Authentication → Rate Limits** das Limit für E-Mails pro Stunde z. B. auf 30 setzen.

Das SMTP-Passwort gehört nur ins Supabase-Dashboard, nicht ins Repo und nicht in den Chat.

## 6. Ausprobieren

1. `/konto` öffnen, E-Mail eingeben, „Anmelde-Link schicken“.
2. In der Mail auf den Link tippen und „Jetzt anmelden“ drücken, oder den Code in der App eingeben.
3. Gibt es auf dem Gerät schon eine Crew, fragt die App, ob sie ins Konto übernommen werden soll.
4. Auf einem zweiten Gerät anmelden: Crew, Abspann und Lieblingsdienste sind da.

Lokal ohne echte Mails: `AUTH_MOCK=1` in `.env.local`. Dann ist der Code immer `123456` und der Link steht im Server-Log.
