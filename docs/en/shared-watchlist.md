# Shared watchlist

The **watchlist** (formerly “credits”) shows what your crew has already seen, with everyone's stars.
Cinemood won't suggest these movies again and learns your taste from the stars.

With an account you can **share** a watchlist with other accounts, e.g. with your partner.
Your own watchlist stays as it is: you can have as many as you like (up to 20).

## How it works

1. Both of you sign in (account via Google or email).
2. One person opens **Account** and creates one under **New shared watchlist**, e.g. “The two of us”.
   (Or shares an existing watchlist, its movies come along.)
3. Tap **Share & manage** on that watchlist, then **Create invite link**.
   Send the link or scan the QR code with the other phone.
4. The other person opens the link, signs in if needed and taps **Join**.

From now on you both see the same watchlist with the same stars. Anyone who adds, removes or rates movies
changes it for everyone.

## Switching

At the top of the **Watchlist** page you see all your watchlists (👥 = shared). One tap switches.
The selected watchlist is also used for new rounds: its movies aren't suggested, and the winner lands there.

## Who can do what

- All members can add, remove and rate movies, rename the watchlist and create new invite links.
- Only the person who created it can remove others.
- Every member can **leave**. If the creator leaves, the member who's been in it the longest takes over.
- The person who created the watchlist can delete it under **Share & manage → Delete watchlist**
  (asks once more). It's then gone for everyone, with all movies and stars. This works for your own,
  unshared watchlists too.
- Members only see the part of each other's email address before the @.

## Invite links

- A link is valid for 7 days. A new link replaces the old one, **Disable link** stops it right away.
- Each link is shown only once. The database only stores a keyed hash of it.
- Anyone with the link can join, so only send it to people who should be in.

When self-hosting (MariaDB, MySQL, SQLite) there are no accounts and therefore no shared watchlists.
The watchlist is tied to the browser there.

## Database update (Supabase only)

Before updating the app, run `supabase/update-2026-11-17-gemeinsam.sql` (or `supabase/update-auf-aktuell.sql`)
once in the Supabase SQL editor. MariaDB, MySQL and SQLite create the new tables themselves.
