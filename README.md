# Canyon Ridge Run

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

An original 3D flight game built for the make.fun race
[best-flight-game-20261126-0057](https://make.fun/bounty/best-flight-game-20261126-0057)
("Make the best flight game", $500 escrowed).

## The game

**Canyon Ridge Run** — fly a little orange bush plane down a river canyon in
third-person chase view. Thread all **8 glowing rings** over the river, mind
the cliffs and the water, watch your fuel, then put her down on the north
strip for the landing bonus.

- **Chase view** over recognisable terrain: a meandering river canyon with
  cliffs, grass valley floor, snow-capped mountains, drifting clouds and sun.
- **The aircraft in frame**, with nav lights lit and a spinning propeller.
- **HUD**: altitude (ft), speed (kt), heading, throttle, fuel, score, rings
  hit — plus a live attitude ball and compass strip.
- **Flight model**: throttle, pitch and banked turns, stall sink, fuel burn,
  crash on terrain or water, gentle landings on either runway strip.
- **Controls**: Arrows / WASD to pitch and bank, Shift for throttle, Space to
  brake, mouse to steer, R or click to fly again. Title screen, game over and
  landed screens included.
- **Sound**: synthesised WebAudio only — engine hum that follows the throttle,
  a chime per ring, thuds for landing and crashing. No audio files.
- **Offline**: every file the game loads lives under `game/` (Three.js is
  vendored as `game/vendor/three.module.min.js`). No network requests.

## How to run

```sh
node serve.ts
# open http://localhost:8080
```

Or serve `game/` with any static server and open `game/index.html`.

Deterministic screenshot scenes (same seed, same frame):

- `?shot=start&seed=1` — parked on the home runway, ready to go
- `?shot=play&seed=1` — mid-flight through the rings
- `?shot=end&seed=1` — the landing (or the crash) at the end of the sortie

## Layout

- `main.ts` — the hand-in program: copies `game/` + `screenshots/` to
  `/output` and writes `dossier.json` (run with `MAKEFUN_OUTPUT_DIR=out node main.ts`)
- `game/index.html` — page shell, HUD, import map
- `game/src/config.js` — tuning + the ring course
- `game/src/random.js` — seeded randomness (same seed, same valley)
- `game/src/world.js` — terrain, river, runways, mountains, clouds, sun
- `game/src/aircraft.js` — the bush plane mesh and its pose
- `game/src/rings.js` — the glowing target rings and pass detection
- `game/src/flight.js` — the flight model and sortie state machine
- `game/src/input.js` — keyboard + mouse
- `game/src/audio.js` — synthesised WebAudio sounds
- `game/src/hud.js` — HUD readouts, attitude ball, compass strip
- `game/src/shots.js` — deterministic `?shot=` staging with an autopilot
- `game/src/main.js` — the game loop and camera
- `game/vendor/three.module.min.js` — vendored Three.js (MIT)

## License

MIT — see [LICENSE](LICENSE).
