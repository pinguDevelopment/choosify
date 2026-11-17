**English** · [Deutsch](../de/login-einrichten.md)

# Setting up sign-in: Google and magic link (Supabase)

The account is optional and meant only for hosts. Guests still join with just their name.
With an account, crews, the watchlist and favorite services are there on every device.

No new environment variables are needed. The server uses the existing `SUPABASE_URL` and the service role key.

There are two ways to sign in; both lead to the same account if the email address is the same:

- **With Google** (recommended): no email sending needed, also works in the phone app. Setup: [below](#setting-up-google-sign-in).
- **By email** (link or code): for more than a few test emails you need your own SMTP service (step 5).

## 1. Update the database (before merging!)

In the Supabase dashboard under **SQL Editor**, paste the full contents of `supabase/update-auf-aktuell.sql` and click **Run**.
The check at the very bottom must return an empty result.

Starting over: `supabase/neu-aufsetzen.sql` deletes **all** Cinemood data (rounds, account data, watchlists, training)
and recreates an empty database on the current version. Sign-ins in Supabase Auth are kept.

## 2. Turn on email sign-in

**Authentication → Sign In / Providers → Email**

- *Enable Email provider*: on
- *Confirm email*: on (default)
- Under **Authentication → Sign In / Providers**, *Allow new users to sign up* must be on, otherwise nobody can sign in for the first time.

## 3. Allow addresses

**Authentication → URL Configuration**

- **Site URL**: your production address, e.g. `https://cinemood.vercel.app`
- **Redirect URLs** (add each line separately with *Add URL*):
  - `http://localhost:3000/**` (locally with `npm run dev`)
  - `https://*.*.devtunnels.ms/**` (VS Code port forwarding, addresses like `abc123-3000.euw.devtunnels.ms`)
  - `https://cinemood-*-steallights-projects.vercel.app/**` (Vercel previews per PR)
  - `https://cinemood.vercel.app/**` or your own domain

The Vercel addresses depend on the name of the Vercel project. If the project still has a different name (e.g. `choosify` or `filmabend`),
they are `choosify.vercel.app` or `choosify-*-steallights-projects.vercel.app` accordingly. After a rename or a
new domain, add the new addresses here (the old ones can stay until nobody uses them anymore).

The link in the email always leads back to the address where the sign-in was requested.
If that address is not in the list, Supabase sends the link to the Site URL. The app catches this on the home page,
but then you end up on production instead of locally.

## 4. Adjust the email templates

**Authentication → Emails → Templates**. Both templates, **Magic Link** and **Confirm signup**, get the same content
(new addresses get "Confirm signup" the first time, "Magic Link" after that).

Supabase only has one template for everyone, so the email is bilingual (German and English).

Subject: `Dein Login für Cinemood · Your Cinemood sign-in`

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

Important: `{{ .RedirectTo }}` and `{{ .TokenHash }}` must appear exactly like this. The default template with `{{ .ConfirmationURL }}`
doesn't work, because the app only signs in through its own server.

## 5. Sending email (SMTP)

Supabase's built-in email sending is only for trying things out: it only sends to addresses in your Supabase team
and only very few emails per hour. For friends you need your own SMTP service, e.g. Resend, Brevo or Postmark
(all with a free tier).

**Authentication → Emails → SMTP Settings**: turn on *Enable custom SMTP*, then enter host, port, user, password and sender
from the email service. Then under **Authentication → Rate Limits**, set the limit for emails per hour to e.g. 30.

The SMTP password belongs only in the Supabase dashboard, not in the repo and not in a chat.

## 6. Try it out

1. Open `/konto`, enter your email, "Send sign-in link".
2. In the email, tap the link and press "Sign in now", or enter the code in the app.
3. If the device already has a crew, the app asks whether to move it to the account.
4. Sign in on a second device: crew, watchlist and favorite services are there.

Locally without real emails: `AUTH_MOCK=1` in `.env.local`. The code is then always `123456` and the link appears in the server log.

## Setting up Google sign-in

Takes about 10 minutes. You need a Google account and access to the Supabase dashboard.
The client ID and client secret belong only in the Supabase dashboard, not in the repo and not in a chat.

### A. Look up the callback address in Supabase

Open **Authentication → Sign In / Providers → Google** (don't turn it on yet). Under
**Callback URL (for OAuth)** there is an address like `https://<your-project>.supabase.co/auth/v1/callback`. Copy it.

### B. Google Cloud Console

1. Open [console.cloud.google.com](https://console.cloud.google.com) and create a new project at the top,
   e.g. "Cinemood".
2. On the left, **APIs & Services → OAuth consent screen** (sometimes also called **Google Auth Platform**) →
   **Get started**:
   - App name: `Cinemood`, support email: your address
   - Audience: **External**
   - Contact information: your address, accept the policy, **Create**
3. Under **Audience**, press **Publish app** (status "In production"). Otherwise only explicitly added
   test users can sign in. A review by Google is not needed, because Cinemood only asks for
   name and email address.
4. **Clients → Create client**:
   - Application type: **Web application**, name: `Cinemood`
   - **Authorized JavaScript origins**: `https://cinemood.yugusaa.de`
   - **Authorized redirect URIs**: the callback address from step A
   - **Create**. Google now shows the **Client ID** and **Client secret**.

The phone app doesn't need anything extra in Google: it signs in through the browser, just like the website.

### C. Supabase

1. **Authentication → Sign In / Providers → Google**: turn it on, paste the **Client ID** and **Client Secret** from B.4,
   **Save**.
2. **Authentication → URL Configuration → Redirect URLs**: there must be a line for your domain, e.g.
   `https://cinemood.yugusaa.de/**` (see step 3 above). After Google, the app redirects back to
   `/api/auth/google/zurueck`, which `/**` covers.

### D. Try it out

After 5 minutes at most, `/konto` shows the **Sign in with Google** button (the server asks Supabase
whether Google is turned on and remembers the answer for a short while). Tap it, choose a Google account, done.

If you previously signed in by email and use the same address with Google, you end up in the same
account with the same crews. The TV app has no Google button, because Google doesn't allow signing in
there (and you don't need an account on the TV anyway).

Locally without Google: with `AUTH_MOCK=1`, `/api/auth/google?mock=you@example.org` jumps straight back and signs in
with that address (for tests only, never takes effect in production).
