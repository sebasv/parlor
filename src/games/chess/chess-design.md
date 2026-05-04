# Chess — Design Document

## Scope (v1)

Pass-and-play Chess with legal-move highlighting. No AI.

## Dependencies

| Package | Version | Why not hand-rolled |
|---------|---------|---------------------|
| chess.js 1.4.0 | rules engine | ~3 000 lines of move generation, check detection, draw conditions (50-move, threefold repetition, insufficient material, stalemate), FEN/SAN parsing. Reimplementing this correctly takes weeks and produces a bug surface that obscures the rest of the project. |
| chessground 9.2.1 | board UI | Lichess's production board renderer: touch/mouse drag, animation, legal-move dots, check highlight, SVG coordinate labels, accessible markup — all in ~15 kB gzip. The deprecation notice on npm refers to the package being migrated to a scoped name in future; the code itself is stable and widely used. |

Both packages are small: combined ~45 kB gzip, well within the 50–80 kB budget stated in the spec.

## CSS Imports

Three chessground CSS files are imported at the top of `index.ts`:

```ts
import 'chessground/assets/chessground.base.css'   // core layout
import 'chessground/assets/chessground.brown.css'  // board squares (brown theme — calm)
import 'chessground/assets/chessground.cburnett.css' // CBurnett flat SVG pieces (Lichess default)
```

`chessground.base.css` — required; handles the cg-board grid, piece sizing, drag ghost.
`chessground.brown.css` — picked over blue/green alternatives; brown is visually neutral and pairs well with the dark shell background.
`chessground.cburnett.css` — the CBurnett piece set is a flat, low-contrast SVG set widely regarded as the cleanest web chess pieces. Preferred over 3D/glossy alternatives per spec.

## Architecture

chess.js is the **single source of truth** for game state (FEN, legal moves, turn, draw conditions). chessground is a **view** — it receives the position and legal-move map and fires `events.movable.after` when the user makes a gesture. The game then applies the move through chess.js, validates it, and pushes the updated state back to chessground via `cg.set(...)`.

```
User gesture
    ↓
chessground event.movable.after(orig, dest)
    ↓
chess.move({ from, to, promotion? })    ← validates + applies
    ↓
syncBoard() → cg.set({ fen, turnColor, check, dests })
    ↓
renderStatus() + renderPlayerTags() + renderHistory()
```

## Player → Color Mapping

`ctx.players[0]` → White (sits at the bottom of the board, moves first).
`ctx.players[1]` → Black (sits at the top of the board).

## Board Orientation

Fixed: White is always at the bottom (`orientation: 'white'`). For hot-seat play, both players look at the same screen, so the board does not flip between turns. A per-turn flip is possible via `cg.toggleOrientation()` and was considered for v1 but omitted: it requires physically handing the device and can be disorienting mid-game. Documented as TODO below.

## Promotion

Pawn promotion is detected when a pawn reaches the back rank. In v1, promotion always defaults to **queen** (the strongest piece and the right choice in >95% of practical cases). The `promotionFlag` check in `handleMove` inspects the moving piece via `chess.get(orig)` before the move is applied.

chessground has a built-in promotion dialog (it can render a piece picker); wiring it requires intercepting the move before it is applied and re-triggering after the user selects. This is straightforward but adds event-handling complexity. Deferred to v2 — see TODOs.

## Legal-Move Highlighting

`computeDests(chess)` calls `chess.moves({ verbose: true })` and aggregates results into a `Map<from, to[]>` (chessground's `Dests` type). This is recomputed on every move and passed to `cg.set({ movable: { dests } })`.

chessground renders legal destinations as small dots (for empty squares) or rings (for capture squares) using the `move-dest` CSS class.

## Move History

`chess.history()` returns an array of SAN (Standard Algebraic Notation) strings. These are rendered in a paired grid (move number, white's move, black's move) in a scrollable sidebar.

## Draw / Game-Over Detection

All draw conditions are handled via chess.js:
- `chess.isCheckmate()` — checkmate
- `chess.isStalemate()` — stalemate
- `chess.isThreefoldRepetition()` — threefold repetition
- `chess.isInsufficientMaterial()` — insufficient material
- `chess.isDraw()` — 50-move rule and any other draw

When the game is over, `movable.color` is set to `undefined`, disabling further moves.

## Resign / Draw Offer

Not implemented in v1. A resign button would call `ctx.onExit()` or trigger a game-over state. Deferred.

## Chessground Cleanup

`cg.destroy()` is called in the cleanup function returned by `mount()`. This removes chessground's internal event listeners and DOM observers.

---

## TODOs (v2 and beyond)

- **Stockfish AI** via WebAssembly — dial strength down to beginner levels via `setoption name Skill Level`. The spec recommends this for hint mode or single-player. Requires a Web Worker and a bundler-friendly WASM import strategy.
- **Promotion picker** — wire chessground's built-in dialog via `movable.events.after` interception + `cg.setPieces()`.
- **Per-turn board flip** — `cg.toggleOrientation()` between moves for hot-seat comfort. Simple to add; omitted in v1 because fixed orientation is less surprising.
- **Takebacks** — `chess.undo()` + `syncBoard()`. Needs mutual consent UI.
- **Time controls** — per-player clock with configurable increment.
- **Sound effects** — move, capture, check, game-over events.
- **Draw offer / resign** — buttons in the sidebar; pressing resign concedes the game.
- **Board themes** — expose the chessground CSS theme as a user setting.
- **Piece set choice** — CBurnett is the default; other SVG sets (Merida, Alpha) could be user-selectable.
