# Tic-Tac-Toe — Design Notes

## Board representation

The board is a flat 9-element TypeScript tuple (`Board = [Cell, Cell, Cell, ...]`) where index 0 is top-left and index 8 is bottom-right (row-major order). Each cell is `null` (empty), `0` (player 0 / X), or `1` (player 1 / O). A flat array is simpler to pass around and check than a nested 3x3 matrix for a fixed-size board.

## Win detection

`checkWinner(board)` is a pure function exported separately from the module so a future AI could import and reuse it. It iterates over the 8 statically defined win lines (3 rows, 3 columns, 2 diagonals) and returns the winning player index or `null`. This runs in O(1) time (constant 8 checks).

## Rendering approach

Vanilla DOM — no Solid, no virtual DOM. The board is a CSS Grid of 9 `<button>` elements. Each render call syncs all 9 cells from the current board state (text content, `data-mark` attribute for colour, `disabled` flag). Using `<button>` elements gives keyboard navigation and correct semantics for free.

Styles are injected as a `<style>` element alongside the container so they are scoped to the game lifecycle and removed on cleanup.

## UI layout

- Board: `min(90vw, 360px)` square with `aspect-ratio: 1`, subdivided by CSS Grid. Each cell is at least 60 px tall to satisfy the tablet tap-target requirement.
- Status bar above the board shows whose turn it is (name + mark) or the result.
- Controls row below with "New game" (accent-coloured) and "Back to picker".

## Player labels

`ctx.players[0]` is always X; `ctx.players[1]` is always O. The status bar shows the player's name and their mark.

## Winning highlight

When a game is won, all three winning cells receive the `ttt-winning` class (slightly different background). The win lines are re-checked during render rather than stored to keep state minimal.

## Cleanup

The returned cleanup function removes both the `<style>` tag and the container element. All event listeners are on elements inside the container, so they are garbage-collected when the elements are removed. No timers or animation frames are used, so no cancellation needed.

## Deferred / Polish TODOs

- **Animations:** winning cells could animate (pulse, shake, fade in mark on placement).
- **Sound:** short click on mark placement, fanfare on win.
- **AI opponent:** `checkWinner` is already extracted as a pure function. A minimax solver (the board is tiny) could be wired in as a single-player mode.
- **Score tracking:** persist wins across rounds in `localStorage` using the storage helpers.
- **Turn indicator:** a small visual indicator (underline, dot) beside each player's name in the header.
- **Accessibility:** announce turn changes and results via an ARIA live region.
