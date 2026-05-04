# Hex — Design Decisions

## Board size

**11×11** — the canonical tournament size, also used by most Hex literature and software. Makes the board tactically rich but the game still resolves in reasonable time for casual play. The constant `BOARD_SIZE` at the top of `index.ts` can be changed to `9` for shorter games.

## Coordinate system

**Offset coordinates** — each cell is addressed as `(col, row)` with `col` and `row` both in `0..BOARD_SIZE-1`. Row 0 is the top row; col 0 is the leftmost column. Rendered as a rhombus by shifting each row to the right by `row × (hexWidth / 2)`.

This is simpler to reason about for a rectangular board than axial (q, r) coordinates, and maps cleanly to a flat 2D array without any index translation in the game logic.

## Hex rendering

**SVG, pointy-top hexagons.** One `<polygon>` per cell. SVG is native to the DOM, needs no dependencies, scales perfectly, and makes it trivial to add per-cell interactivity. Pointy-top orientation aligns columns vertically, which matches the natural reading direction (top–bottom = Player 0's goal).

Each polygon has `role="button"` and `tabindex` so keyboard navigation works without extra scaffolding.

## Player edge assignment

| Player | Colour | Owns |
|--------|--------|------|
| Player 0 (`ctx.players[0]`) | Red (#ef4444) | Top and bottom edges (row 0, row N-1) |
| Player 1 (`ctx.players[1]`) | Blue (#6cb1ff) | Left and right edges (col 0, col N-1) |

Coloured strips are rendered just outside the corresponding edges of the board using `<polygon>` overlays behind the cell layer.

## Win detection

**BFS flood fill** in `checkWinner()` and `hasWon()`. Starting from all of a player's pieces on their first edge, BFS expands through same-colour neighbours. If the search reaches the opposite edge, the player has won. Complexity is O(N²) per move — trivial for N=11.

The separate `findWinningCells()` function runs a second BFS that also records `prev` pointers so it can trace back one winning path for visual highlighting. Only called once, on game-over.

Hex is provably non-draw (Zermelo / hex-specific topology proof): when the board is full, exactly one player's pieces form a spanning path between their edges.

## Pie rule

**Deferred (TODO v2).** The pie rule lets Player 1 swap Player 0's first move instead of making their own, eliminating first-move advantage. On 11×11 the advantage is significant for strong players; on 9×9 it matters less casually. The rule is a one-line state extension (track whether swap is offered and handle it in the click handler) and is intentionally left for a follow-up.

## Tablet-first sizing

`HEX_SIZE = 52px` (flat-to-flat). The 11×11 board with row offset fits within ~860px wide and ~720px tall — within viewport on most tablets in landscape. The SVG wrapper is `overflow: auto` so smaller screens can scroll. Hex cell size can be adjusted by changing the `HEX_SIZE` constant.

## TODOs / future work

- **Pie rule**: swap mechanism in the first move of the game.
- **AI / hint**: minimax or Monte Carlo Tree Search opponent.
- **Animations**: smooth disc placement, win-path flash animation.
- **Sound**: subtle click on cell claim, fanfare on win.
- **Accessibility**: better ARIA live region for status updates; focus management after move.
- **Smaller board option**: expose board size in a pre-game settings screen.
