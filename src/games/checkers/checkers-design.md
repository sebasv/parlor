# Checkers (International Draughts) — Design Notes

## Variant chosen

**International Draughts (10×10)**, the FMJD standard and Dutch school default.
Key differences from English/American checkers:
- 10×10 board (100 squares, 50 dark)
- Each side starts with 20 men
- Men capture both forwards and backwards
- Kings are "flying kings" — slide any number of squares
- Mandatory capture, maximum-capture rule enforced

## Board representation

Flat array of **50 entries** — one per dark square, indexed 0–49 in reading order
(top-left dark square first, row by row). Light squares are never stored; they don't
participate in the game.

**Coordinate mapping:**
- Row r (0–9), column c (0–9).
- A square is dark when `(r + c) % 2 === 1`.
- Even rows: dark squares at cols 1, 3, 5, 7, 9 → `col = rank * 2 + 1`
- Odd rows: dark squares at cols 0, 2, 4, 6, 8 → `col = rank * 2`
- Flat index: `row * 5 + rank`

`idxToRowCol` / `rowColToIdx` convert between the two representations.

## Player orientation

- **Player 0 (light, ctx.players[0])**: starts at the bottom (indices 30–49), moves up (toward row 0). Promotes at row 0.
- **Player 1 (dark, ctx.players[1])**: starts at the top (indices 0–19), moves down (toward row 9). Promotes at row 9.
- Light moves first.

## Move generation approach

Rules are kept pure in `rules.ts`:
- `legalMoves(state) → Move[]` — returns all legal moves for the current player.
- `applyMove(state, move) → GameState` — applies the full move atomically.
- `winner(state) → Player | null` — checks if current player has no legal moves.

**Capture sequences** are enumerated recursively in `captureSequences()`. The function
builds a temporary board at each recursion level to reflect pieces already captured in
the sequence, preventing the same piece from being jumped twice. Each recursive call
returns complete Move objects (full path + all captured squares).

**Flying king captures**: the king slides over one enemy piece and can land on any
empty square beyond it in the same diagonal direction. The recursion handles the fact
that a flying king can choose different landing squares and still continue capturing.

## Mandatory-capture handling

`legalMoves` checks for captures first. If any exist, only captures are returned
(quiet moves are excluded). This makes mandatory capture automatic — the UI only offers
valid moves, and only capture-origin squares are selectable when captures exist.

**Maximum-capture rule**: fully enforced. After collecting all capture sequences,
`legalMoves` filters to keep only those with the maximum number of captured pieces.
Both mandatory capture and maximum-capture are enforced in v1.

## Multi-jump UX

Multi-jump sequences are resolved **in a single selection**. When a player selects a
piece that has a capture available, all valid final destination squares are highlighted
(including those reachable only via a multi-jump path). The player taps the destination
square and the entire sequence (including all intermediate jumps) is applied atomically.

This differs slightly from the spec's "partial jump then force continue" model, but is
arguably better UX on a tablet: the player sees exactly where their piece ends up and
all intermediate captures happen automatically. The rules are still correctly enforced —
the maximum-capture filter means only the best destinations are shown.

The `GameState.midJump` field exists in the type system for a potential future
step-by-step implementation but is not used in v1 (always null).

## King promotion

A man that reaches the opposite back rank at the **end of its complete turn** is
promoted to king. Promotion happens in `applyMove` — since the full capture sequence is
applied at once, promotion is only awarded if the piece stops on the back rank (not just
passes through it during a multi-jump). This is the correct International Draughts rule.

## Win condition

`winner(state)` returns the opponent when `legalMoves(state)` is empty. This covers:
- All pieces captured.
- All pieces blocked (no legal moves).

Draw detection is deferred (see TODOs).

## What's deferred (TODOs)

- **AI opponent**: no computer player.
- **Undo / take-back**: not implemented.
- **Board flip**: board is always shown with light at bottom; no option to flip.
- **Draw conditions**: the 25-move-without-capture rule and three-position repetition rule are not tracked.
- **Animations**: piece movement is instantaneous.
- **Step-by-step multi-jump**: all captures applied atomically; no animated intermediate steps.
- **Rule variants**: only International Draughts (FMJD). English/American checkers not supported.
- **Persistence**: game state is not saved across page reloads.
