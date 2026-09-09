# Speedster 🏁

A multiplayer, side-scrolling elimination speedrun. Up to 10 racers auto-run
through a course of hurdles and thrown obstacles, grab speed boosts, and get
cut down at checkpoints until only a final few sprint for the finish line.
Characters are cosmetically customizable, with cosmetics unlocked by playing.

This repo currently implements the **core playable loop** end-to-end:
lobby → customization → countdown → race (obstacles, two power-up types, two
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
  the lobby, countdown, HUD, and results screens are DOM overlays on top of
  the canvas.
- **Art** (`packages/client/src/render`): all game art is generated in code
  with the Canvas2D API and baked into Phaser textures at startup - there are
  no image assets in the repo. See "Art pipeline" below.

## Art pipeline

Everything you see is drawn procedurally:

- `characters.ts` - a parametric, skeletal runner. Poses come from joint
  angles, so the 8-frame run cycle is a function of phase rather than
  hand-drawn frames, and jump/fall/duck/stumble are extra pose functions.
  Each player colour is baked into its own sprite sheet so characters get
  real shading in their own hue instead of a flat tint over a white sprite.
- `props.ts` / `environment.ts` - obstacles, pickups, gates, and the
  parallax scenery. Background layers are built from sine terms with whole
  numbers of cycles across the tile width, which makes them tile seamlessly.
- `textures.ts` - bakes those drawings into Phaser textures at 3x and
  displays them scaled back down, which is what keeps curves and outlines
  crisp. Anything using these textures needs `SPRITE_SCALE`.

The draw functions deliberately take only a `CanvasRenderingContext2D` and
know nothing about Phaser, so the art can be iterated on in isolation:

```bash
npm run dev -w @speedster/client   # then open /art-preview.html
```

That page renders a contact sheet of every pose, colour, prop, and a full
scene mockup. It is a dev-only tool and is not part of the production build.

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
   speed. Press **Space** (or tap) to jump over ground hurdles, and hold
   **Down/S** to duck under obstacles thrown at head height — jumping
   doesn't clear those, only ducking does. Miss either and you stumble
   (temporary speed penalty), unless you're holding a shield. Two
   power-ups are up for grabs along the way (speed boost, shield), first
   come first served. A progress bar along the bottom of the HUD shows
   every racer's position, the checkpoints, and the finish line.
3. **Checkpoints** — when the leader reaches a checkpoint gate, stragglers
   get a grace window to catch up, then the bottom half of the field is cut.
   The last checkpoint cuts down to the final 3 survivors.
4. **Finish** — survivors race the last stretch; standings are ranked by
   finish order, then by how far each eliminated runner got.
5. **Results** — final standings are shown (place, finished vs. eliminated
   and where). Finishing 1st unlocks a cosmetic (the Crown hat) via
   localStorage, then the room resets to the lobby.

## Deploying: play it from a real URL

GitHub Pages only serves static files, so it can host the **client**, but
not the Node/Socket.io **server** - that needs somewhere that runs a real
process. This repo is wired up for a free split deployment:

- **Client → GitHub Pages.** `.github/workflows/deploy-pages.yml` builds
  `packages/client` and publishes it to Pages automatically on every push
  to `main` that touches the client or shared package.
- **Server → Render.com.** `render.yaml` at the repo root is a Render
  [Blueprint](https://render.com/docs/blueprint-spec) describing the
  server as a free web service.

### One-time setup (only a repo owner with dashboard access can do these)

1. **Enable Pages via Actions.** In the repo's Settings → Pages, set
   "Source" to **GitHub Actions** (if it isn't already). The workflow
   above then publishes to `https://<owner>.github.io/speedster/` on the
   next push to `main`.
2. **Deploy the server on Render.** Create a free Render account, then
   "New +" → "Blueprint", and point it at this repo - it picks up
   `render.yaml` automatically. First deploy takes a few minutes.
3. **Double-check the URLs line up.** The workflow assumes the Render
   service ends up at `https://speedster-server.onrender.com` (from the
   service name `speedster-server` in `render.yaml`) and that Pages ends
   up at `https://jfekete43.github.io` (from `CLIENT_ORIGIN` in
   `render.yaml`). If either differs - e.g. the Render name was already
   taken, or the repo lives under a different owner - update the other
   config to match:
   - Render URL differs → update `VITE_SERVER_URL` in
     `.github/workflows/deploy-pages.yml` and re-run the workflow.
   - Pages origin differs → update `CLIENT_ORIGIN` in `render.yaml` and
     redeploy the Render service.

### Heads up on the free tiers

Render's free web service spins down after ~15 minutes idle. The first
join after a period of inactivity can take 30-60 seconds while it wakes
back up (the client will just look stuck connecting - give it a minute).
There's nothing broken; it's the tradeoff for free hosting.
