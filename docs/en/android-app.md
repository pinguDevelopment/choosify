**English** · [Deutsch](../de/android-app.md)

# Cinemood as a phone app (Android, e.g. Samsung Galaxy)

The **Cinemood** app for phones and tablets can do everything the website can: create a round, invite friends
by QR code, pick genres and vote. On top of that there is **sign-in with Google**: tap once,
choose your Google account, done. Your crews, the watchlist and your favorite services are tied to this account
and are there on every device where you sign in with the same Google account.

Guests need neither the app nor an account. They scan the QR code and join in the browser.

## Navigation bar

At the bottom of the app, one tap switches between **Lobby** (start or join a round), **Watchlist**,
**Train** (Train my Algorithm) and **Account**. Tapping the section you're already in scrolls to the top.
While typing (keyboard open), the bar hides.

## Download and install

1. On your phone, open `cinemood.yugusaa.de/handy-app` in the browser. This downloads the current APK
   (`https://github.com/pinguDevelopment/cinemood/releases/download/handy-app/cinemood-handy.apk`).
2. Tap the downloaded file. The first time, Android asks whether the browser (Samsung Internet
   or Chrome) may install apps: **Settings → Allow**, then go back and tap **Install**.
3. Google Play Protect may warn about an "unknown app" because it doesn't come from the Play Store:
   **More details → Install anyway**.
4. Open Cinemood. Under **Account**, tap **Sign in with Google**.

The app checks for new versions on its own at startup and asks whether to install the update.
For that, allow Cinemood to install apps once (the app takes you there).

## Opening QR codes directly in the app

If someone with the app installed scans an invite QR code, Android opens the round directly in the app.
If that doesn't work and the browser opens instead: turn on **Settings → Apps → Cinemood → Set as default →
Open supported links**.

## Settings

**Press and hold** the Cinemood icon on the home screen **→ Settings**: a different server address (your own server),
reload page, check for updates.

## How Google sign-in works in the app

Google doesn't allow signing in inside an in-app view (WebView). So the app briefly opens the sign-in
in the browser (it looks like a window of the app), and then jumps back into the app automatically.
Only a short-lived, signed ticket travels back, and it is valid only together with a secret that
only the app knows. This way the actual sign-in ends up in the app and not in the browser.

Requirement: Google is set up in Supabase, see [login-setup.md](login-setup.md#setting-up-google-sign-in).
Without that setup, the app (and the website) simply shows no Google button.

## Your own server or your own signing key

- Different start address at build time: on GitHub under **Actions → Handy-App → Run workflow**, enter an address.
- The app is signed with the same sideload key as the TV app. If you use your own key via the GitHub secret
  `CINEMOOD_KEYSTORE_B64`, enter its SHA-256 fingerprint in Vercel as
  `ANDROID_CERT_SHA256`, otherwise QR codes open in the browser instead of the app
  (`keytool -list -v -keystore your-own.jks` shows the fingerprint).
