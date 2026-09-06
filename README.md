# Speedster 🏁

A multiplayer, side-scrolling elimination speedrun. Up to 10 racers auto-run
through a course of hurdles and thrown obstacles, grab speed boosts, and get
cut down at checkpoints until only a final few sprint for the finish line.
Characters are cosmetically customizable, with cosmetics unlocked by playing.

This repo currently implements the **core playable loop** end-to-end:
lobby → customization → countdown → race (obstacles, one power-up type, two
elimination checkpoints funneling the field down to a final 3) → results →
back to lobby. See [`docs/DESIGN.md`](docs/DESIGN.md) for the full vision and
what's intentionally deferred for later passes.

## Stack

- **Shared** (`packages/shared`): TypeScript types, tuned physics constants,
  the pure physics step function, the default track layout, and the
  socket.io event contracts. Imported directly as source (no build step) by
  both the server and the client, so gameplay math never drifts between them.
- **Server** (`packages/server`): Express + Socket.io. One authoritative
  room runs a fixed 20Hz simulation tick, resolves obstacle hits, power-up
  pickups, checkpoint eliminations, and the finish line, and broadcasts
  snapshots to every client in the room.
- **Client** (`packages/client`): Vite + Phaser 3. A single scene renders
  the race from server snapshots (lightly smoothed for readability at 20Hz);
  the lobby, countdown, HUD, and results screens are plain DOM overlays on
  top of the canvas.

## Running it locally

```bash
npm install
npm run dev
```

This starts the server on `http://localhost:8787` and the client (Vite) on
`http://localhost:5173`. Open the client URL in a browser tab.

Since a single human can't easily test 10-way multiplayer, the lobby has an
**"+ Add Bot"** button — bots have simple reactive jump AI with randomized
skill, so one human plus a handful of bots is enough to see the full loop:
customization, ready-up, countdown, dodging obstacles, grabbing the speed
boost, getting cut at a checkpoint (or surviving it), and the results screen.
Open a second browser tab (or an incognito window) to test as two humans in
the same room.

To point the client at a non-default server (e.g. when deploying), set
`VITE_SERVER_URL` before building/running the client, and `PORT` /
`CLIENT_ORIGIN` for the server.

## Project layout

```
packages/
  shared/   physics, types, track data, socket event contracts
  server/   authoritative room simulation + socket.io wiring
  client/   Phaser rendering + DOM UI + socket.io client
docs/
  DESIGN.md full game vision and roadmap beyond this first pass
```

## How a race works right now

1. **Lobby** — pick a name, a color, and a hat (some hats start locked).
   Ready up; the host starts the race once everyone (2+ players, bots count)
   is ready.
2. **Countdown** → **Racing** — everyone auto-runs forward at a constant
   speed. Press **Space** (or tap) to jump. Hurdles and "thrown" obstacle
   barrages need a well-timed jump or you stumble (temporary speed penalty).
   A speed-boost power-up is up for grabs, first come first served.
3. **Checkpoints** — when the leader reaches a checkpoint gate, stragglers
   get a grace window to catch up, then the bottom half of the field is cut.
   The last checkpoint cuts down to the final 3 survivors.
4. **Finish** — survivors race the last stretch; standings are ranked by
   finish order, then by how far each eliminated runner got.
5. **Results** — final standings are shown (place, finished vs. eliminated
   and where). Finishing 1st unlocks a cosmetic (the Crown hat) via
   localStorage, then the room resets to the lobby.
