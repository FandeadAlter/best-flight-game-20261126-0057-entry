# Cendrawasih Coast Run

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/FandeadAlter/best-flight-game-20261126-0057-entry/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/FandeadAlter/best-flight-game-20261126-0057-entry/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

A morning mail run along the coast: fly the little prop plane **PK-CND**
through eight gold rings — over the bay, across the river, past the
rooftops — then bring her home on the runway at Cendrawasih Field. An
original 3D chase-view flight game in plain Canvas 2D: no libraries, no
images, no network requests, all art drawn in code and all sound
synthesised with WebAudio.

Built for the [make.fun bounty "Make the best flight game"](https://make.fun/c/best-flight-game-20261126-0057)
(best-flight-game-20261126-0057, $500).

## Play

Serve `game/` with any static server (or `node serve.ts`) and open
`game/index.html` in a desktop browser. No build step, no network.

- **↑ / ↓ or W / S** — pitch (pull up / push down)
- **← / → or A / D** — bank and turn
- **Shift / Ctrl** — throttle up / down
- **Mouse** — steer like a stick; **wheel** — throttle
- **P** — pause · **M** — mute · **R** — restart · **Enter** — start

## The flight

- **Goal:** thread all 8 gold rings (+100 each, +25 for a near miss), then
  land on the runway (+500, +250 for a feather-soft touchdown, +5 per
  second left on the 4-minute clock).
- **Honest flight model:** speed comes from the throttle, the wing stalls
  below 55 kt, bank turns the aircraft, and the ground — bay, beach,
  hills, rooftops — is solid. Ditch in the bay, clip a rooftop, or plant
  it too hard and the flight is over.
- **Instruments:** lit airspeed and altimeter dials, an artificial
  horizon, a heading tape, vertical speed, throttle lever and a ring
  progress board, plus a HUD with altitude, speed, heading, score, time
  and a pointer to the next ring.

## Files

- `game/` — the playable game (static files only): `index.html` and
  `src/` (`config`, `random`, `terrain`, `physics`, `audio`, `input`,
  `render`, `shots`, `main`).
- `screenshots/` — four real renders of the game's own code, staged with
  `?shot=play|city|final|win&seed=1` (see `shots.json`).
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with `vendor/makefun-game.ts`.
- `DOSSIER.md` — what the game is, how it plays, and how it meets each
  judged element.
- `test-logic.mjs` — Node tests for the flight model and terrain
  (27 checks, all passing).

## License

MIT — see `LICENSE`.
