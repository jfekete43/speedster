# Speedster — Design & Roadmap

## Concept

A multiplayer side-scrolling speedrun for up to 10 players. Everyone races
the same course simultaneously. Checkpoints along the way eliminate the
players furthest behind, narrowing the field down to a final handful for a
last sprint to the finish. Obstacles (including things "thrown" at you) must
be dodged, a power-up or two can be grabbed along the way, and characters are
cosmetically customizable with unlocks earned by playing.

This document captures the full vision and separates what the current
codebase implements (see the root `README.md`) from what's deliberately
deferred, so future work has a clear map instead of guessing scope.

## What's built (MVP core loop)

- Authoritative server simulation at a fixed tick, shared physics code
  between server and (future) client prediction.
- Lobby with name/color/hat customization, ready-up, host-started race, and
  a bot-filler for solo testing.
- One track: hurdles + "barrage" obstacles requiring timed jumps, one
  speed-boost power-up type, two elimination checkpoints that funnel the
  field down to a final 3 survivors, then a finish line.
- Results screen with standings, and one working unlock (finish 1st → Crown
  hat), persisted client-side via `localStorage`.

## Deferred / roadmap

Roughly in the order it'd make sense to tackle:

1. **Client-side prediction & reconciliation.** The client currently just
   renders (lightly smoothed) server snapshots at the 20Hz tick rate, which
   is fine locally but will feel laggy on real network latency. Next step:
   predict the local player's jump using the same shared `stepPhysics`, and
   reconcile against server snapshots.
2. **More obstacle & power-up variety.** Today there's one power-up (speed
   boost) and two obstacle shapes (hurdle, barrage). Natural next additions:
   a shield/invincibility power-up, a magnet, obstacles that actually
   telegraph and get thrown at players in real time (rather than fixed
   track positions), moving/timed obstacles, and multiple lanes to dodge
   sideways instead of only jumping.
3. **Real matchmaking.** Right now everyone lands in a single shared public
   room. Needs: multiple concurrent rooms, room codes / private lobbies,
   spectating a race already in progress instead of waiting, and
   reconnection handling (currently a disconnect mid-race just eliminates
   you).
4. **Deeper customization & unlock economy.** Only two hats and eight flat
   colors right now, one unlock condition. Roadmap: a real cosmetic catalog
   (body shapes/skins, trail effects, victory emotes), a currency or
   challenge-based unlock system, and persisting profiles server-side /
   behind accounts instead of only `localStorage`.
5. **More tracks & track variety.** One hand-authored track today. Add a
   track rotation/voting, and eventually procedural or community-built
   tracks.
6. **Art & audio pass.** Characters and obstacles are currently flat
   colored rectangles (functional, not pretty). Needs real sprites,
   animations (run/jump/stumble/celebrate), parallax backgrounds, and
   sound effects/music.
7. **Mobile-friendly controls & responsive HUD.** Tap-to-jump already works;
   needs real on-screen controls and layout testing on small screens.
8. **Anti-cheat hardening.** Server is authoritative for physics, but input
   isn't rate-limited or sanity-checked yet (e.g. jump spam, malformed
   payloads) — worth tightening before any public deployment.
9. **Scale-testing at full 10 players** with real obstacle/power-up density
   tuned for a bigger, more chaotic field than the 2-6 players used for
   local bot-assisted testing so far.
