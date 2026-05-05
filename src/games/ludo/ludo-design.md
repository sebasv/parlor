# Ludo — Design Choices & Simplifications

## Board Model

The board geometry varies by player count. All geometry data lives in a
`BoardGeometry` struct built in `index.ts` and consumed by both the SVG renderer
and the animation helpers.

### Position model

Pawn position is one of:

```
{ zone: 'yard' }                       — not yet on the board
{ zone: 'track', index: 0..trackLen-1 }— on the shared main track
{ zone: 'home', index: 0–5 }           — player's home column (5 = finished)
{ zone: 'finished' }                   — in the home target (all 4 = win)
```

`trackLen` is 52 for 2- and 4-player games, and 39 for the 3-player triangular
board. All rules logic is parametric over `trackLen` via `GameState.trackLength`.

### Quadrant slot mapping

Each player is assigned a **visual slot** (0–3 for 4-quad boards, 0–2 for
3-leg boards) via `GameState.quadrantSlots`. The slot determines which start
square, home column, yard, and colour a player uses.

| Player count | `quadrantSlots` | Track entries | Spacing |
|---|---|---|---|
| 2 | `[0, 2]` | 0, 26 | 26 apart — symmetric |
| 3 | `[0, 1, 2]` | 0, 13, 26 | 13 apart — symmetric (39-sq track) |
| 4 | `[0, 1, 2, 3]` | 0, 13, 26, 39 | 13 apart — symmetric |

## Board Variants

### 4-quadrant board (2 and 4 players)

Standard 15×15 grid, 480×480px, rendered inside a 600×500 SVG canvas (offset
60px left, 10px top). One 32×32px cell per grid square. 52-square outer track.

- **2 players** use slots 0 and 2 (opposite corners: Red bottom-left, Green
  top-right). Slot 1 (Yellow) and slot 3 (Blue) yard areas are rendered at
  reduced opacity as decorative empty zones.
- **4 players** use all four slots as before.

### 3-leg triangular board (3 players)

A triangular board rendered using raw SVG pixel coordinates in the same
600×500 canvas. Three equal legs of 13 squares each form a 39-square outer
track. Entry points are 13 squares apart — perfectly symmetric.

Triangle vertices (circumradius ≈ 185px, centred at 300×260):
- V0 (slot 0, Red):    bottom centre — track index 0
- V1 (slot 1, Yellow): top left      — track index 13
- V2 (slot 2, Green):  top right     — track index 26

Each leg is divided into 14 equal segments; the 13 intermediate points form
the track squares. Home columns extend from each entry point toward the shared
triangular centroid. Yard areas are circular regions near each vertex.

## Player Entry Points

### 2-player (52-square track, slots 0 and 2)

| Logical player | Slot | Main-track entry | Home entry |
|---|---|---|---|
| 0 | 0 (Red) | 0 | 51 |
| 1 | 2 (Green) | 26 | 25 |

### 3-player (39-square track, slots 0–2)

| Logical player | Slot | Main-track entry | Home entry |
|---|---|---|---|
| 0 | 0 (Red) | 0 | 38 |
| 1 | 1 (Yellow) | 13 | 12 |
| 2 | 2 (Green) | 26 | 25 |

### 4-player (52-square track, slots 0–3)

| Logical player | Slot | Main-track entry | Home entry |
|---|---|---|---|
| 0 | 0 (Red) | 0 | 51 |
| 1 | 1 (Yellow) | 13 | 12 |
| 2 | 2 (Green) | 26 | 25 |
| 3 | 3 (Blue) | 39 | 38 |

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
- Roll button → sets `state.dice`; clicking a selectable pawn calls `applyMove`.
- `BoardGeometry` is built once and cached; the 3-leg geometry uses
  programmatic coordinate computation (no hard-coded pixel tables).
- No framework dependencies; vanilla DOM + SVG.
