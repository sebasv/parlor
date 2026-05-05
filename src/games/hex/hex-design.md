# Hex — Design Decisions

## Board size

**2-player**: **11×11** rhombus — the canonical tournament size, also used by most Hex literature and software. The constant `BOARD_SIZE` at the top of `index.ts` can be changed to `9` for shorter games.

**3-player**: **radius 5 hexagonal board** — 91 cells (formula: 3r² + 3r + 1; r=5 → 91). For comparison, r=4 → 61 cells, r=6 → 127 cells. Radius 5 gives a game of comparable length to the 11×11 rhombus and fits comfortably on a tablet. The constant `HEX_BOARD_RADIUS` can be adjusted.

## Coordinate system

**2-player**: **Offset coordinates** — each cell is addressed as `(col, row)` with `col` and `row` in `0..BOARD_SIZE-1`. Rendered as a rhombus by shifting each row to the right by `row × (hexWidth / 2)`. This maps cleanly to a flat 2D array.

**3-player**: **Axial coordinates** `(q, r)`. A cell exists when `max(|q|, |r|, |q+r|) ≤ radius`. This is the natural coordinate system for a regular hexagonal grid; it makes neighbour enumeration trivial and the board boundary easy to define.

## Hex rendering

**SVG, pointy-top hexagons.** One `<polygon>` per cell. SVG is native to the DOM, needs no dependencies, scales perfectly, and makes per-cell interactivity trivial. Each polygon has `role="button"` and `tabindex` so keyboard navigation works without extra scaffolding.

## Player edge assignment

### 2-player (rhombus)

| Player | Colour | Owns |
|--------|--------|------|
| Player 0 (`ctx.players[0]`) | Red (#ef4444) | Top and bottom edges (row 0, row N-1) |
| Player 1 (`ctx.players[1]`) | Blue (#6cb1ff) | Left and right edges (col 0, col N-1) |

### 3-player (hexagonal board)

The hexagonal board has 6 sides, numbered 0–5 going clockwise from the top-right. Each player owns two diametrically opposite sides so they get a fair path across the board:

| Player | Colour | Side A | Side B (opposite) |
|--------|--------|--------|------------------|
| Player 0 | Red (#ef4444) | Side 0: `r = −R` (top-right) | Side 3: `r = +R` (bottom-left) |
| Player 1 | Blue (#6cb1ff) | Side 1: `q+r = R` (right) | Side 4: `q+r = −R` (left) |
| Player 2 | Green (#4ade80) | Side 2: `q = R` (bottom-right) | Side 5: `q = −R` (top-left) |

Owner assignment alternates around the perimeter (0,1,2,0,1,2) so each player's sides are strictly opposite each other. Coloured edge strips along each side show ownership visually.

## Win detection

**BFS flood fill** in `checkWinner2` / `checkWinner3` and their `hasWon` helpers. Starting from all of a player's pieces on their first edge, BFS expands through same-colour neighbours. If the search reaches the opposite edge, the player has won. Complexity O(N²) per move — trivial at the board sizes used.

`findWinningCells2` / `findWinningCells3` run a second BFS recording `prev` pointers for path reconstruction, used to visually highlight the winning chain.

## Draw possibility

**2-player**: Hex is provably non-draw (Zermelo / hex-specific topology theorem). When the board is full, exactly one player's chain spans their edges.

**3-player**: The non-draw guarantee does **not** extend to three players. It is theoretically possible for the board to fill with no player having connected their two sides (e.g. each player's chain is blocked by another). This is extremely rare in practice on a radius-5 board but cannot be ruled out by theory. The game currently ends without a winner if the board fills and no player has won — this should be detected and displayed appropriately. A future improvement could add draw-detection on board-full.

## Active-player pill colouring

The legend pill for the active player is tinted in that player's identity colour:
- **Border**: 3 px solid in player colour.
- **Background**: `color-mix(in srgb, <playerColor> 18%, var(--bg-elev))` — subtle tint.
- **Glow / pulse**: `box-shadow` in player colour, animated with `hex-pulse` keyframes.
- **Text**: player colour.

Inactive pills are dimmed (opacity 0.45, transparent border).

## Pie rule

**Deferred (TODO v2).** The pie rule lets Player 1 swap Player 0's first move instead of making their own. For 3-player, no standard swap rule exists; it is left out for now.

## Tablet-first sizing

`HEX_SIZE = 52px` (flat-to-flat). The boards fit within ~820px wide at this size. The SVG wrapper has `overflow: auto` so smaller screens can scroll.

## TODOs / future work

- **Draw detection on board-full (3-player)**: detect and display a draw result.
- **Pie rule**: swap mechanism for 2-player first move.
- **AI / hint**: minimax or Monte Carlo Tree Search opponent.
- **Animations**: smooth disc placement, win-path flash.
- **Sound**: subtle click on cell claim, fanfare on win.
- **Accessibility**: better ARIA live region for status updates; focus management after move.
- **Smaller board option**: expose board size in a pre-game settings screen.
