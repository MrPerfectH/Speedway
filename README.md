# Speedway - One-Button Oval Track Racing

A browser-based local multiplayer arcade racer where each rider uses exactly one key to steer left around an oval track.

## Run

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Controls

- Player 1: `Space`
- Player 2: `Enter`
- Player 3: `Left Shift`
- Player 4: `Left Ctrl`

Hold your key to turn left. Release to drift outward.

## Gameplay

- 1-4 players on one shared oval track
- Fixed speed per race (Slow/Medium/Fast)
- Collision with inner/outer wall eliminates rider
- Bike-to-bike collisions eliminate riders
- Win by reaching target laps first or being last rider standing
