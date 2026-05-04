# Two Together — Design Document

## Name choice

Named "Two Together" rather than "Pico Park" to avoid borrowing a brand name.
The id remains `pico-park` for URL stability.

## Rendering approach

Canvas 2D (`<canvas>`), fullscreen within the game-root div.
A `ResizeObserver` keeps the canvas pixel dimensions in sync with the container.
The game loop uses `requestAnimationFrame` with a fixed 60 Hz physics timestep
and an accumulated-remainder approach (spiral-of-death capped at 100 ms).

## Tile grid format

Each level is a `string[]`, one string per row, 32×32 px tiles.

| Character | Meaning |
|-----------|---------|
| `#` | Solid platform / wall |
| `.` | Empty / air |
| `1` | Player 1 spawn (replaced with `.` at runtime) |
| `2` | Player 2 spawn (replaced with `.` at runtime) |
| `P` | Pressure plate — opens all `D` tiles while any character overlaps it |
| `D` | Door tile — solid; replaced with ` ` (space) when plate is active |
| `G` | Goal tile — both characters must stand on a `G` tile to complete |

## Physics approach

Kinematic AABB with separate-axis resolution (vertical first, then horizontal).
Located entirely in `physics.ts` with no DOM imports.

Steps per tick (60 Hz fixed dt = 1/60 s):
1. Set `vx` to walk speed or zero (instant response, no acceleration).
2. Apply gravity to `vy`; clamp at terminal velocity.
3. Apply jump impulse if `onGround` and jump input.
4. Integrate `y += vy * dt`; scan overlapping solid tiles; push out vertically.
5. Check platform rect (other character) for stand-on-head landing.
6. Integrate `x += vx * dt`; scan overlapping solid tiles; push out horizontally.

## Co-op mechanics (v1)

Two mechanics implemented:

1. **Pressure plate + door** — one character stands on a `P` tile; all `D` tiles
   in the level switch to passable space. Released instantly when no character
   overlaps the plate.

2. **Stand-on-head boost** — each character's rect is passed to the other's
   `stepChar` call as an optional `platformRect`. When a character is falling
   and lands on the other's head (feet within the top half of the other's rect),
   the other character acts as a moving platform.

## Input scheme

Two touch-control panels, one per screen half.
- Left half: player 1 controls (`<` left arrow, `>` right arrow, `UP` jump).
- Right half: player 2 controls (same layout).

Pointer events with `setPointerCapture` handle multi-touch independently.
Buttons are 72×72 px — large enough for tablet play.

## Level count (v1)

Three hand-designed levels:
- Level 1 "Open Sesame" — pressure plate + door only.
- Level 2 "Shoulders" — stand-on-head boost only.
- Level 3 "Double Act" — both mechanics combined.

## What is deferred (TODO)

- **More levels** — levels 4–6 stubbed in comments in `levels.ts`:
  - Level 4 "Timing" — two simultaneous pressure plates.
  - Level 5 "Labyrinth" — split paths; carry-and-throw mechanic.
  - Level 6 "Tower" — tall shaft; stacked stand-on-head.
- **Level select screen** — jump to any unlocked level.
- **Save progress** — persist highest completed level via `localStorage`.
- **Sound effects** — jump, land, door open, goal reached.
- **Particle effects** — win celebration, door open animation.
- **More co-op mechanics** — carry-and-throw, two-button simultaneous press,
  follow-the-leader gates, toggle switches.
- **Animated sprites** — walk cycle, idle bob.
- **Background art** — scrolling parallax layer.
- **Narrative / story** — level intro text, character dialogue.
- **Keyboard fallback** — WASD / arrow-key controls for desktop testing.
