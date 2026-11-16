**English** · [Deutsch](../de/android-tv.md)

# Cinemood on an Android TV

The **Cinemood TV** app opens the TV page (`/tv`) in full screen. You don't have to operate anything on
the TV: it shows a 6-digit code, which you as the host enter in the lobby on your phone. After that the
TV shows the QR code for joining, the progress and, at the end, the winning movie.

The app runs on **Android TV and Google TV** (e.g. Chromecast with Google TV, Nvidia Shield,
Fire TV Stick, Sony, Philips, TCL). Samsung TVs (Tizen) and LG (webOS) are not Android; there you
simply open `/tv` in the TV's browser.

## Download

- Direct link to the current APK:
  `https://github.com/pinguDevelopment/cinemood/releases/download/tv-app/cinemood-tv.apk`
- Short (redirects to the same link): `cinemood.yugusaa.de/tv-app`

The APK is rebuilt automatically whenever the app changes (GitHub Actions, workflow
"Android-TV-App").

## Installing with the Downloader app (easiest)

1. On the TV, install the **Downloader** app (by AFTVnews) from the Play Store.
2. Open the TV's settings: **Apps → Security & restrictions → Unknown sources**
   and allow **Downloader** there. (On Google TV: **Settings → System → About**, click
   **Android TV OS build** seven times to unlock the developer options; then allow Downloader under
   **Apps → Security & restrictions → Install unknown apps**.
   On Fire TV: **My Fire TV → Developer Options → Install unknown apps**.)
3. Open Downloader, enter `cinemood.yugusaa.de/tv-app` as the address, then **Go**.
4. After the download, press **Install**. You can let it delete the APK afterwards.
5. Cinemood now appears among the apps on the home screen.

## Installing via adb (from a computer)

1. Unlock the developer options on the TV (see above) and turn on **USB debugging** or
   **Network debugging** there. The IP address is under **Network & Internet**.
2. On the computer (with the Android Platform Tools):
   ```bash
   adb connect 192.168.1.50      # IP of the TV
   adb install -r cinemood-tv.apk
   ```
3. The first time you connect, the TV asks whether to allow the computer: **Yes**.

## Using the app

- Start the app: the pairing code appears right away. The screen stays on while the app is running.
- **Menu button** or **hold OK for about a second**: opens the settings. There you can change the
  server address, **reload the page** (e.g. if it hangs) and **check for updates**.
- **Press Back twice**: exits the app.
- If the server can't be reached, the app shows a notice and tries again every 10 seconds.

## Your own domain or your own server

By default the app opens `https://cinemood.yugusaa.de/tv`. If you run Cinemood yourself, enter
your own address:

- **In the app:** Menu button (or hold OK), type the address, e.g. `movies.example.com` or
  `http://192.168.1.20:3000` for a server on your home network, then **Save**. The app adds `https://`
  and `/tv` itself. **Default** resets the address.
- **Built in:** on GitHub under **Actions → Android-TV-App → Run workflow**, enter your own address in the
  "Server-Adresse" field. The finished APK is then in that run under **Artifacts**.
  (This run doesn't replace the public APK.)

## Updates

At every start the app checks GitHub for a new version (release `tv-app`, file
`version.json`). If there is one, it asks: **Install** downloads the new version, after which Android
itself asks once more "Do you want to update this app?". Your settings are kept. You can also do this
manually from the menu with **Check for updates**.

For the first update you have to allow the app to install apps once. The app opens the right
setting if it can. On Fire TV: turn on **My Fire TV → Developer Options → Install unknown apps →
Cinemood**.

If you still have an older app without the "Check for updates" button, update once by hand: install the
new APK exactly like the first time; the old version is replaced and your settings are kept.
All versions are signed with the same key
(`android-tv/signing/sideload.jks`). If you want your own secret key, create the secrets
`CINEMOOD_KEYSTORE_B64` (the .jks file as Base64), `CINEMOOD_KEYSTORE_PASSWORD`, `CINEMOOD_KEY_ALIAS`
and `CINEMOOD_KEY_PASSWORD` on GitHub under **Settings → Secrets and variables → Actions**. Note:
after changing the key, the old app has to be uninstalled once.
