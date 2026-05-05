# Tsuro Design Document

## Port Indexing (Canonical)

Ports are numbered 0–7 clockwise starting from the top-left corner of each tile:

```
      0   1
    +-------+
  7 |       | 2
  6 |       | 3
    +-------+
      5   4
```

- Top edge:    0 (left of centre), 1 (right of centre)
- Right edge:  2 (top of centre), 3 (bottom of centre)
- Bottom edge: 4 (right of centre — reversed so numbering stays clockwise), 5 (left of centre)
- Left edge:   6 (bottom of centre — reversed), 7 (top of centre)

This is the canonical layout used throughout the codebase. All rotation and cross-tile
connection logic derives from this numbering.

## Tile Data Model

A tile is an array of 4 pairs: `[Connection, Connection, Connection, Connection]` where
each `Connection = [Port, Port]`. All 8 ports appear exactly once across the 4 pairs.

Example: `[[0,5],[1,2],[3,7],[4,6]]`

## Rotation

A 90° clockwise rotation increments each port index by 2 (mod 8), because:
- The tile has 4 sides, each with 2 ports.
- Rotating 90° CW moves every port forward by exactly one side (2 ports).

Formula: `rotatedPort = (port + quarterTurns * 2) % 8`

## Cross-Tile Port Mapping

When a pawn exits via port `p`, it enters the adjacent tile via the "opposite" port:

| Exit | Adjacent entry | Direction |
|------|---------------|-----------|
| 0    | 5             | up        |
| 1    | 4             | up        |
| 2    | 7             | right     |
| 3    | 6             | right     |
| 4    | 1             | down      |
| 5    | 0             | down      |
| 6    | 3             | left      |
| 7    | 2             | left      |

These are derived geometrically: two touching edges share the same physical points,
so the port that is "left of centre" on the top edge of tile A becomes "right of centre"
on the bottom edge of tile B (above A), which is port 4 (right of centre on bottom edge).

## Tile Generation — SIMPLIFICATION (v1)

**WARNING: This is a major simplification from canonical Tsuro rules.**

The real game uses exactly 35 unique tiles (plus the Dragon Tile) dealt as a shuffled
deck. Each player draws to maintain a hand of 3 tiles. Tile uniqueness prevents degenerate
trivial tiles and ensures strategic depth.

**V1 approach:** Generate a completely random tile (random pairing of 8 ports) each time
a player needs one. No deck, no hand, no limit on tile supply.

**TODO:** Implement the canonical 35-tile deck + 3-card hand mechanic. The 35 tiles can
be enumerated by generating all valid pairings of 8 ports into 4 pairs and filtering for
unique representatives under rotation. This requires:
1. Enumerating all 105 perfect matchings of {0..7}.
2. Deduplicating under 4 rotations.
3. Implementing a draw pile with shuffle and deal-to-hand.

## Hand Mechanics — DEFERRED

Real Tsuro: each player has a hand of 3 tiles; can pick any of the 3 and any rotation.

V1: each player has exactly 1 tile (randomly generated), and can rotate it freely.

**TODO:** Implement 3-card hand UI (show 3 tile previews, click to select, rotate selected).

## Player Starting Positions

Pawns are distributed around the board perimeter. For each player count:

- 2 players: top edge and bottom edge (opposite sides)
- 3 players: top, right, bottom edges
- 4 players: top, right, bottom, left edges (one per side)

Each pawn starts at approximately the midpoint of its edge, sitting at the outward-facing
port of the border tile slot. Before any tile is placed in the pawn's slot, the pawn
renders slightly outside the board grid to indicate its starting position.

## Tile Placement UX

1. A tile is drawn automatically at the start of each turn.
2. The tile preview panel shows the current tile with its active rotation.
3. "Rotate 90°" button cycles the rotation 0° → 90° → 180° → 270° → 0°.
4. "Place tile" button places the rotated tile in the slot directly in front of the
   current player's pawn.
5. The slot directly in front of the pawn is highlighted on the board.

The game validates that the target slot is empty and in bounds before allowing placement.

## Path-Following Algorithm

After a tile is placed at `(col, row)`:

1. For each active pawn whose facing port leads into `(col, row)`:
   a. Enter the new tile via `oppositePort(pawn.port)` → get the entry port.
   b. Follow the tile connection to get the exit port.
   c. From the exit port, check the adjacent slot in the exit direction.
   d. If the adjacent slot is off the board → pawn is eliminated.
   e. If the adjacent slot is empty → pawn stops here, at its current exit port.
   f. If the adjacent slot has a placed tile → repeat from step (a) in the new slot.

2. After all pawns have moved, check for collisions: if two active pawns occupy the
   same `(col, row, port)` position, both are eliminated.

3. The current player's pawn is processed first in case of chain reactions.

## Pawn Rendering

Pawns are SVG circles (radius 9px) colored per player:
- Player 0: #ef4444 (red)
- Player 1: #6cb1ff (blue)
- Player 2: #4ade80 (green)
- Player 3: #facc15 (yellow)

When a pawn is on a placed tile, it renders at the pixel position of its current port.
When a pawn is at its starting position (no tile placed yet), it renders just outside
the board at its starting port, nudged outward by 14px.

Eliminated pawns are hidden (off-board sentinels have col=-1).

## Tile Path Rendering

Tile connections are drawn as quadratic Bézier curves. The control point for each curve
is the tile centre (TILE_SIZE/2, TILE_SIZE/2). This gives a gentle S-curve appearance.

**TODO:** Experiment with alternative control points for more visually distinct paths
(e.g. per-connection offsets to avoid overlap at the centre).

## Deferred / Known TODOs

1. **Canonical 35-tile deck** — replace `randomTile()` with a proper deck.
2. **3-card hand** — show 3 tiles, let player pick which to play.
3. **Dragon Tile** — special tile for when the deck runs out.
4. **Animations** — animate pawn movement along the path instead of snapping.
5. **Tile placement validation** — prevent players from placing a tile that immediately
   eliminates themselves (if another option exists). Canonical Tsuro rule.
6. **AI player** — simple heuristic: avoid self-elimination, prefer longer paths.
7. **Curved paths with better aesthetics** — avoid all 4 curves meeting at the exact
   same centre point.
8. **Sound effects / haptics** — subtle feedback on tile placement and pawn movement.

## Bug Fix: Blank tiles and unresponsive "Place tile" button (fix/tsuro-rendering)

**Root cause:** `rotatePort()` in `tiles.ts` used `(x % 8) + 8` instead of the correct
double-modulo `((x % 8) + 8) % 8`. For non-negative inputs (quarterTurns ∈ {0,1,2,3}),
the raw `% 8` result is already 0–7, so adding 8 without the outer `% 8` produced values
8–15. Every call to `rotateTile` — including the identity rotation (0 quarter-turns) —
returned a tile whose port indices were all in the range 8–15.

This caused two visible failures:

1. **Blank tile squares:** `tilePathD` calls `portPosition(port)` which has a `switch` with
   cases 0–7. Ports 8–15 fall through the switch and return `undefined`, producing SVG path
   data like `"M undefined undefined Q 45 45 undefined undefined"` — rendered as nothing.

2. **"Place tile" does nothing:** `handlePlace` calls `computePawnWaypoints` which calls
   `exitPort(rotatedTile, entryPort)`. Because the rotated tile's connections only contain
   ports 8–15, no match for a valid entry port (0–7) is found, and `exitPort` throws
   `"Port N not found in tile connections"`. The uncaught exception silently aborted the
   handler, leaving the board unchanged.

**Fix:** Changed `return (((port + quarterTurns * 2) % 8) + 8) as Port` to
`return ((((port + quarterTurns * 2) % 8) + 8) % 8) as Port` — the standard
double-modulo idiom that also handles negative inputs without corrupting non-negative ones.
The bug was introduced when the `+ 8` guard for negative modulo was added without the
corresponding outer `% 8` to clamp the result back into range.

## Bug Fix: "Cannot place tile" (fix/tsuro-interactions)

**Root cause:** Pawns were initialised *on* the board edge tiles with outward-facing ports
(e.g. port 0 for the top edge). `placementSlot()` calls `portDelta(port)` to find the tile
in front of the pawn, but an outward-facing port on an edge tile pointed *off* the board,
so the computed slot was out-of-bounds and `handlePlace()` rejected it as invalid.

**Fix:** Pawns now start one step *outside* the board in ghost cells (out-of-bounds col/row)
with an *inward-facing* port. `portDelta` then steps correctly into the first real tile slot.
`isEliminated()` was tightened to `col === -1 && row === -1` (the explicit sentinel) so that
left-edge ghost positions (`col: -1, row: mid+1`) are not mistaken for eliminated pawns.
`pawnStartCoord()` in the renderer was updated to project the ghost position onto the nearest
board edge for display.
