# Connect Four — Design Document

## Overview

Vanilla TypeScript + DOM implementation of Connect Four for the Parlor Games shell.
No external dependencies beyond the project's existing stack.

---

## Grid Representation

- `type Board = Cell[][]` — a 2-D array indexed `[row][col]`.
- `row 0` = top of the visible board; `row ROWS-1` = bottom.
- `type Cell = 0 | 1 | 2` — 0 is empty, 1 is player 1, 2 is player 2.
- The board is treated as immutable: `drop()` returns a new board rather than mutating in place.

## Win Detection

`checkWin(board, player)` scans all cells. For each cell occupied by `player` it walks
four directions:

1. Horizontal (0, +1)
2. Vertical (+1, 0)
3. Diagonal down-right (+1, +1)
4. Diagonal down-left (+1, -1)

If four consecutive cells all belong to `player`, the function returns those four
`[row, col]` pairs. The caller highlights them on the board. Returns `null` when no
win is found.

Scanning only starts from the current `player`, so we never need to check the other
player on the same turn.

## Drop Logic

`drop(board, col, player)` calls `dropRow()` which scans upward from the bottom row to
find the lowest empty slot. It returns the new board and the landing row, or `null` when
the column is full. Pure function — no side-effects.

## UI Layout

- Scoped CSS injected via a `<style>` tag on mount, removed on cleanup.
- The board is a CSS `grid` with `repeat(7, clamp(40px, 11vw, 70px))` columns and
  matching rows — fluid on mobile/tablet without media queries.
- Discs are `border-radius: 50%` divs placed via explicit `grid-column` / `grid-row`.
- Column tap targets are transparent `<button>` elements spanning all six rows in their
  column via `grid-row: 1 / 7`. They sit above the cell divs in DOM order so pointer
  events reach them first.
- Winning cells receive a white ring via `box-shadow`.
- Player colours: red (`#ef4444`) for player 1, yellow (`#facc15`) for player 2 —
  standard Connect Four convention.

## Interaction

- Tapping or clicking anywhere in a column triggers a drop for that column.
- Buttons are disabled after game-over to prevent stale input.
- "New game" resets state without page reload.
- "Back to menu" calls `ctx.onExit()`.
- `aria-label="Drop in column N"` on each column button for basic accessibility.

## Separation of Concerns

- `createBoard`, `drop`, `dropRow`, `checkWin`, `isBoardFull` — pure functions,
  zero DOM coupling. A future AI opponent can import and use these directly.
- `mount()` owns all DOM lifecycle; the cleanup function removes the wrapper and
  the injected `<style>` tag.

## What Was Deferred (TODOs)

- **Drop animation** — a disc sliding down to its resting row. Skipped in v1 because it
  requires animating between grid rows and adds meaningful complexity with little game-
  logic benefit. Would likely use `transform: translateY` with a calculated offset.
- **Column hover preview** — show a ghost disc at the top of the hovered column.
  Currently only the background of empty cells lightens on hover.
- **AI opponent** — single-player mode with a minimax or heuristic AI. The pure game
  functions (`drop`, `checkWin`) are already AI-ready.
- **Sound effects** — a click/clack on drop, fanfare on win.
- **Persistent score** — track wins across games in `localStorage`.
- **Keyboard navigation** — arrow keys to select column, Enter to drop.
- **Colour-blind mode** — shape or pattern inside discs in addition to colour.
