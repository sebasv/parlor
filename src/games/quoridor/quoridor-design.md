# Quoridor — Design Document

## Board representation

- **Cell grid**: 9×9 array of cells (rows 0–8, cols 0–8). Row 0 is the top, row 8 is the bottom.
  - Player 1 starts at (8, 4) — bottom center. Goal: reach row 0.
  - Player 2 starts at (0, 4) — top center. Goal: reach row 8.
- **Walls**: two 8×8 boolean grids.
  - `hWalls[r][c]` = true → horizontal wall segment below cell row `r`, between columns `c` and `c+1`. A full horizontal wall spans two adjacent segments: placing at `(r, c)` sets `hWalls[r][c]` and `hWalls[r][c+1]` is implicitly the second cell covered (but in this implementation each wall occupies a 1×2 region: both `hWalls[r][c]` and `hWalls[r][c+1]` are set).
  - `vWalls[r][c]` = true → vertical wall segment to the right of cell column `c`, between rows `r` and `r+1`. A vertical wall spans `vWalls[r][c]` and `vWalls[r+1][c]`.
  - Wall placement: a horizontal wall at position `(r, c)` where `r ∈ [0,7]`, `c ∈ [0,7]` blocks the south edge of cells `(r, c)` and `(r, c+1)` — i.e., movement between row r and r+1 at those columns. The wall uses two adjacent horizontal segments: `hWalls[r][c]` and `hWalls[r][c+1]`.
  - A vertical wall at `(r, c)` blocks the east edge of cells `(r, c)` and `(r+1, c)` — movement between column c and c+1 at those rows. Uses `vWalls[r][c]` and `vWalls[r+1][c]`.

## Wall segment indexing

```
hWalls: 8×8 grid (indexed by [wallRow][wallCol])
  hWalls[r][c] is set when a horizontal wall occupies segment at row-gap r, column c.
  Placing a wall at anchor (r, c) sets hWalls[r][c] AND hWalls[r][c+1].

vWalls: 8×8 grid (indexed by [wallRow][wallCol])
  vWalls[r][c] is set when a vertical wall occupies segment at row r, column-gap c.
  Placing a wall at anchor (r, c) sets vWalls[r][c] AND vWalls[r+1][c].
```

Movement blocking:
- Moving south from `(r, c)` to `(r+1, c)` is blocked if `hWalls[r][c]` is true.
- Moving north from `(r, c)` to `(r-1, c)` is blocked if `hWalls[r-1][c]` is true.
- Moving east from `(r, c)` to `(r, c+1)` is blocked if `vWalls[r][c]` is true.
- Moving west from `(r, c)` to `(r, c-1)` is blocked if `vWalls[r][c-1]` is true.

## Wall placement legality

A wall placement `(orientation, r, c)` is illegal if:
1. The player has 0 walls remaining.
2. Any of the two segments it would occupy are already used by a previous wall.
3. It crosses a perpendicular wall (overlap detection on shared intersection).
4. After placement, either pawn has no path to its goal row (BFS check).

Overlap rule:
- A horizontal wall at `(r, c)` overlaps with an existing horizontal wall at `(r, c-1)` if `hWalls[r][c]` is already set (shares the second segment) or with `(r, c+1)` similarly.
- A vertical wall at `(r, c)` overlaps with existing vertical walls the same way.
- A horizontal wall at `(r, c)` crosses a vertical wall at `(r, c)` because they share the same intersection point. Specifically `hWalls[r][c]` and `hWalls[r][c+1]` crossing `vWalls[r][c]` and `vWalls[r+1][c]` share the center point at grid intersection `(r, c+1)` — detected by checking if `vWalls[r][c]` AND `vWalls[r+1][c]` are both set when placing horizontal at `(r, c)`.

## Path-check (no-block-off)

BFS from each pawn position over the 9×9 grid respecting all walls. Both pawns must reach their respective goal rows after the proposed wall is placed. Pure function with no mutation of game state.

## Jump rules

**Implemented**: Standard straight jump — if adjacent cell contains the opponent and the cell beyond (in the same direction) is empty and reachable (no wall on either gap), jump over.

**Simplified / deferred**: Diagonal jump (side-step) when straight jump is blocked by a wall or board edge. The official rule allows stepping diagonally to an adjacent square next to the opponent when the straight jump is blocked. This is marked as TODO and the current implementation falls back to treating the blocked jump as unavailable (i.e., the player can still move in other directions but cannot reach diagonal squares via jump). This means fewer legal moves in edge cases but never produces illegal positions.

## UI: wall placement mode

Two-mode approach:
- **Mode 1 — Move**: click any highlighted legal pawn destination to move.
- **Mode 2 — Place wall**: click a wall slot (thin gap between cells) to place a wall.

A "Place wall / Move pawn" toggle button switches between modes. In place-wall mode, hovering a wall slot previews it; clicking places the wall if legal. This avoids ambiguous clicks where a tap near a cell edge could be a move or a wall.

Wall slots are rendered as thin invisible hit targets overlaid on the SVG gaps between cells. Horizontal wall slots sit in the gap below each row (8 rows × 8 columns of positions). Vertical wall slots sit in the gap to the right of each column (8 rows × 8 columns).

Wall visual: 2-cell-length colored bar in the gap between cells.

## SVG layout

- Cell size: 56px (large enough for tablet touch).
- Gap between cells: 8px (wall region).
- Margin: 24px.
- Total SVG: 24 + 9×56 + 8×8 + 24 = 568px square.
- Pawn: circle centered in cell.
- Wall slot hit target: covers the full 2-cell length of the gap.

## Bug fix — out-of-bounds vWalls access on row 8

Root cause: `vWalls` is an 8×8 grid (rows 0–7), but pawns can legitimately sit on row 8 (Player 0's start). `blockedEast` and `blockedWest` were indexing `state.vWalls[r]` without a bounds check, so accessing row 8 returned `undefined`, and the subsequent property access on `undefined` threw a TypeError that crashed the entire move-generation loop — making no legal moves appear and all pawn clicks do nothing. Similarly, the cross-check in `canPlaceWall` for horizontal walls was accessing `state.vWalls[r + 1][c]` when `r = 7`, which is out of bounds. The fix adds `if (r >= WALL_GRID) return false` guards in both east/west blocked helpers, and a `r + 1 < WALL_GRID` guard before the cross-check in `canPlaceWall`.

## Deferred / TODOs

- AI opponent
- Undo move
- Diagonal jump (side-step) when straight jump is blocked — currently not implemented; documented above
- Animations / transitions
- Game history / replay
- Sound effects
