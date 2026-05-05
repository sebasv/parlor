# Ludo -- Design Choices & Simplifications

## Board Model

The board is an N-pointed star, one point per player. All geometry data lives
in `makeStarGeometry()` in `index.ts` and is consumed by the SVG renderer and
animation helpers.

### Position model

Pawn position is one of:

```
{ zone: 'yard' }                        -- not yet on the board
{ zone: 'track', index: 0..trackLen-1 } -- on the shared main track
{ zone: 'home', index: 0-5 }            -- player's home column (5 = finished)
{ zone: 'finished' }                    -- in the home target (all 4 = win)
```

### Track length

Every variant uses L = 13 squares per arm (classic Ludo):

| Player count | Track length | Entries |
|---|---|---|
| 2 | 26 (2 x 13) | 0, 13 |
| 3 | 39 (3 x 13) | 0, 13, 26 |
| 4 | 52 (4 x 13) | 0, 13, 26, 39 |

Player i's entry is at track index `i * 13`.
Player i's home turn-off is at `(i * 13 - 1 + trackLength) % trackLength`,
which is the last square of the previous arm.

### Star geometry

For N players:

- N outer tips at radius R_OUTER = 200 px, angles `theta_i = -90 + i * (360/N)` degrees
  (tip 0 always points upward).
- N inner valleys at radius R_INNER = 100 px, angles `theta_i + (180/N)` degrees
  (halfway between adjacent tips).
- Star centre at SVG coordinates (300, 260).

Each arm of the star is traversed by the shared track in two half-legs:

- Half-leg A (7 squares): approaches the outer tip from the left inner valley.
  Square 0 of half-leg A is player i's **entry** (track index `i * 13`).
- Half-leg B (6 squares): leaves the outer tip toward the right inner valley.
  Last square of half-leg B is player i's **home turn-off** (track index
  `(i+1)*13 - 1`).

Home column: 6 squares from the outer tip inward to the star centre,
placed at lerp fractions 1/7 to 6/7 along the tip-to-centre line.

Yard: 4 pawn positions in a 2x2 grid around a point 22% of the way from
tip to centre, offset perpendicular to the arm direction.

### Quadrant slot mapping

For the N-pointed star the slot mapping is trivial -- player i uses star
point i. `quadrantSlots` is always `[0, 1, ..., N-1]`.

## Player Entry Points

### 2-player (26-square track)

| Logical player | Slot | Main-track entry | Home turn-off |
|---|---|---|---|
| 0 | 0 (Red)    | 0  | 25 |
| 1 | 1 (Yellow) | 13 | 12 |

### 3-player (39-square track)

| Logical player | Slot | Main-track entry | Home turn-off |
|---|---|---|---|
| 0 | 0 (Red)    | 0  | 38 |
| 1 | 1 (Yellow) | 13 | 12 |
| 2 | 2 (Green)  | 26 | 25 |

### 4-player (52-square track)

| Logical player | Slot | Main-track entry | Home turn-off |
|---|---|---|---|
| 0 | 0 (Red)    | 0  | 51 |
| 1 | 1 (Yellow) | 13 | 12 |
| 2 | 2 (Green)  | 26 | 25 |
| 3 | 3 (Blue)   | 39 | 38 |

## N = 2 decision

A 2-pointed star (N=2) has tips pointing up and down, connected by two inner
valleys to the left and right. Visually it looks like a tall pointed oval or
lens shape -- two opposing teardrops. This is a degenerate but valid star.

We chose to **use the same N-pointed-star generator for N=2** rather than
falling back to the classic 4-quadrant cross. Reasons:

- Code consistency: one geometry path for all player counts.
- The geometry is actually playable: a 26-square track with two players on a
  vertical star is not confusing for kids.
- Keeping the previous 4-quadrant board for N=2 would require maintaining two
  separate code paths that diverge from the PR #43 direction.

The N=2 board looks like a vertical diamond/star with the Red player's tip at
top and the Yellow player's tip at bottom.

## Rules Implemented

- Roll d6 to move; must roll **6** to release a pawn from yard onto start square.
- Landing on an opponent pawn sends it back to its yard (capture).
- Exact roll required to enter the final home square (index 5). Overshoot = illegal.
- Rolling a 6 grants an extra roll (bonus turn).
- Three consecutive 6s forfeit the turn (state tracked via `consecutiveSixes`).
- First player to have all 4 pawns in `zone: 'finished'` wins.

## Simplifications (v1)

- **No safe squares**: Any square on the main track can be a capture square.
- **No blocking**: Two pawns of the same colour on the same square do not form
  an unpassable block. Stacking is silently allowed.
- **Capture all**: All opponent pawns on a landing square are captured. Standard
  rules only capture lone pawns; stacks of 2+ form a block. TODO.
- **No global home-column uniqueness**: Multiple own pawns can occupy the same
  home-column square. Standard rules forbid this. TODO.
- **No computer opponent**: All players are human (hot-seat).

## TODO

- Implement blocking: 2+ same-colour pawns on a square form an impassable block.
- Implement safe squares (highlighted squares where capture is not allowed).
- Computer / AI opponent.
- Persistent game state (local storage).

## UI Architecture

- Pure SVG board rendered once per game; pawn positions re-rendered on every
  state change.
- State lives in a single `GameState` object (from `rules.ts`).
- Roll button sets `state.dice`; clicking a selectable pawn calls `applyMove`.
- `BoardGeometry` is built once via `makeStarGeometry(playerCount)` and cached.
- No framework dependencies; vanilla DOM + SVG.
