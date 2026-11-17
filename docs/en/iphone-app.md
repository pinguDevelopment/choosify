**English** · [Deutsch](../de/iphone-app.md)

# Cinemood on the iPhone (free, no App Store)

Cinemood works like an app on iPhone and iPad: its own icon on the Home Screen, full screen without an address bar,
and a navigation bar at the bottom (**Lobby**, **Watchlist**, **Train**, **Account**) just like the Android app.
No App Store, no TestFlight and no Apple developer account needed. The app is always up to date because it runs
the website directly.

## Install (30 seconds)

1. On the iPhone, open `cinemood.yugusaa.de/ios-app` in Safari. It shows the same steps.
2. Tap the **Share** icon (a square with an arrow pointing up). If you don't see it, tap **···** in the bottom right first.
3. Scroll down a little and tap **Add to Home Screen**.
4. Leave **Open as Web App** switched on and tap **Add** in the top right.
5. From now on, open Cinemood from the new icon.

Chrome and Edge on the iPhone can do this too: Share icon next to the address bar, then **Add to Home Screen**.

iPhone visitors also see a small hint about this on the start page (can be closed with ✕).

## Share it with friends

Just send the link `cinemood.yugusaa.de/ios-app` (the page has a **Share link** button). Everyone installs Cinemood
themselves, for free and without an expiry date. Android users find the link to the Android app on the same page.

## Signing in inside the app

- **With Google:** under **Account**, tap **Sign in with Google**. iOS briefly opens the Google sign-in in a browser
  window on top of the app and then jumps back.
- **By email:** type the **code from the email** into the app. The link in the email opens Safari, not the app,
  so the sign-in would end up in Safari.

Note: the Home Screen app has its own storage, separate from Safari. If you were signed in in Safari, sign in once
more inside the app.

## Differences from an App Store app

- Not listed in the App Store, no one-tap install from a link (you tap **Add to Home Screen** once).
- Round QR codes open in Safari, not in the app. Joining works the same there.
- Updates happen automatically: every new version of the website is instantly in the app.

## Other options (for comparison)

| Option | Cost | Lasts | What you need |
| --- | --- | --- | --- |
| **Add to Home Screen** (this guide) | free | forever | just Safari |
| TestFlight / App Store | $99 per year (Apple Developer Program) | TestFlight builds 90 days, App Store forever | Apple developer account, review by Apple |
| Sideloadly / AltStore with a free Apple ID | free | 7 days, then reinstall | Mac or PC, cable, max. 3 apps per Apple ID, every friend has to do it themselves |

So for sharing with friends for free, **Add to Home Screen** is the only option that keeps working. A native iOS
app could be added later if an Apple developer account comes into play.

## Technical notes (for developers)

- Manifest: `src/app/manifest.ts`, icons and launch images: `public/app/`
- iPhone metadata (icon, launch images, status bar, `viewport-fit=cover`): `src/app/[lang]/layout.tsx`
- Navigation bar in app mode only: `src/components/AppNav.tsx` (sets the class `app` on `<html>`, spacing in `globals.css`)
- Start page hint: `src/components/IosInstallHint.tsx`, guide page: `/ios-app`
