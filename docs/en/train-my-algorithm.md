# Train my Algorithm

With **Train my Algorithm**, everyone can teach Cinemood their own taste in movies, on their own and for as
long as they like. Group rounds then also pick movies based on it.

## How it works

1. Sign in (account via Google or email). Without an account there's nowhere to store your taste.
2. Open **Train my Algorithm** from the start page or your account (address `/trainieren`).
3. Swipe through the movies:
   - → **Like it**, ↑ **It's ok**, ← **Not for me**
   - **Skip** (↓) skips a movie without saving anything
   - **Back** (Backspace) brings back the last card, tapping shows details and the trailer
   - Whether you've seen the movie doesn't matter: it's only about whether it's your thing.
4. Below the stack you see what Cinemood has learned (genres and #tags you like or rather don't).

Movies come from all decades and pools (popular, classics, hidden gems), without a streaming filter.
Movies you've already rated won't come up again.

## What happens in group rounds

Anyone who joins (or creates) a round **signed in** brings their taste along:

- **Movie selection:** when the round starts, movies with genres and tags the trained people enjoy move up,
  disliked ones move down. Several trained people are averaged so nobody decides the round alone. The crew's
  star ratings from the credits still count as before (half each). A movie someone explicitly marked
  "Not for me" drops noticeably.
- **Own order:** each trained person sees movies matching their taste a bit earlier in their stack.
  Everyone still swipes the same movies.
- Others never see your training votes.

The **Use in group rounds** switch (on the training page) turns this off; your training stays saved.
**Reset training** deletes all votes, and single movies can be forgotten under "Recently rated".

## Setup

- **Supabase:** before updating, run `supabase/update-2026-11-16-training.sql` once (or, as always,
  `supabase/update-auf-aktuell.sql`) in the Supabase SQL Editor.
- **MariaDB/MySQL/SQLite:** nothing to do, the app creates the new tables itself.
  Without accounts (self-host without sign-in) the mode isn't available.

New in the database: table `training_votes` (votes per account, at most 3000), column
`accounts.use_training` (the switch) and `participants.account_id` (which account takes part in a round).
