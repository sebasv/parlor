# Order and Chaos — Design Document

## Overview

Order and Chaos is a two-player abstract strategy game played on a 6x6 grid. Unlike most
combinatorial games the move sets are identical for both players: on each turn, the active
player places either an X or an O on any empty square. The asymmetry is purely in the
winning conditions:

- **Order** (`ctx.players[0]`) wins by creating five-in-a-row of either symbol (X or O).
- **Chaos** (`ctx.players[1]`) wins by filling the board completely without any five-in-a-row occurring.

## Role Assignment

Player 1 (the first name entered in the roster) is always **Order**; Player 2 is always
**Chaos**. This is the standard tournament convention.

TODO: Add a "swap roles" toggle before the first move so players can decide who goes first
without re-entering names.

## Board Representation

The board is a flat `Cell[]` of length 36 (a TypeScript type alias). Index mapping:
`index = row * 6 + col`. This is simple and cache-friendly. The 2-D coordinates are only
reconstructed inside the win-detection loop.

A `Cell` is `'X' | 'O' | null`. No numeric encoding — the string values serve directly as
display text, removing any display-layer translation.

## Five-in-a-Row Detection

`findFiveInARow(board)` scans all 36 cells in four directions (right, down, diagonal
down-right, diagonal down-left). For each non-null cell it walks up to 5 steps; if it
accumulates 5 identical symbols it returns their indices. The caller uses the indices to
highlight the winning line in the UI.

The function is pure (no side effects, no DOM) and exported implicitly through the module
boundary. A future AI player can import it directly.

Complexity: O(n * d * k) where n = 36 cells, d = 4 directions, k = 5 steps = 720
operations maximum — negligible on every platform.

## UI Interaction Model

**Two-step confirm pattern**: tap a cell to select it (preview appears), tap Confirm to
commit. This prevents accidental placements on a touch screen and gives the player a moment
to reconsider.

Before confirming, the player can:
- Tap a different empty cell to change the selected square.
- Tap the same cell again to deselect it.
- Toggle the X / O buttons to change the symbol (the preview on the board updates live).

The X and O symbol buttons are always visible during play. The active one is highlighted
with the accent colour. The Confirm button is disabled until a cell is selected.

Alternative considered: "tap X or O button, then tap a cell" (one step). Rejected because
it requires remembering the chosen symbol across two separate gestures, which is harder on
tablet with multiple players leaning over.

## State Machine

```
initialState()
  phase: 'playing'
    -> applyMove() -> 'order-wins'  (five-in-a-row found)
    -> applyMove() -> 'chaos-wins'  (board full, no five-in-a-row)
    -> applyMove() -> 'playing'     (normal move, toggle player)
```

All state transitions are immutable (spread copies). The single `state` variable in
`renderGame` is reassigned; there is no shared mutable data structure.

## Player Turn Tracking

`currentPlayer` is `0 | 1` indexing into `ctx.players`. It only advances when `phase`
remains `'playing'` after a move; on a game-ending move the player index stays so the
status message correctly names the winner.

## DOM / CSS Architecture

The game is self-contained: it appends a `<style>` tag to `<head>` on mount and removes
it on cleanup. No global stylesheet is modified. CSS classes are all prefixed `oc-` to
avoid collisions with shell styles.

The board uses CSS Grid (`grid-template-columns: repeat(6, 1fr)`) with a `width/height`
bounded by `min(90vw, 90vh, 480px)` so it fills the viewport on tablets without
overflowing on small phones.

Cell font size uses `clamp(1rem, 4vw, 2rem)` for fluid scaling.

## What Is Deferred

- **Role swap toggle** — let players decide Order/Chaos before starting.
- **Win animation** — the winning cells are highlighted in gold; a CSS keyframe pulse would
  add polish.
- **Move history / undo** — useful for teaching; the immutable state array makes this
  straightforward to add.
- **AI opponent** — Chaos is the easier side to automate (fill board randomly); Order
  requires a minimax or MCTS search. The pure `findFiveInARow` function is already
  extracted for reuse.
- **Accessibility** — ARIA live region for announcing moves; keyboard navigation across
  cells.
- **Score tracking** — cumulative wins across multiple rounds.
