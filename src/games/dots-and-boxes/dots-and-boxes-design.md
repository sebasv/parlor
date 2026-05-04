# Dots and Boxes — Design Document

## Board Representation

### Data Model

The board is parameterised by `rows` and `cols` (number of dot rows/columns).
For a 5x5 dot grid there are 4x4 = 16 boxes.

Three separate 2-D arrays hold the full board state:

| Array | Dimensions | Meaning |
|-------|-----------|---------|
| `hLines[r][c]` | `rows` × `(cols-1)` | Horizontal line between dot `(r, c)` and `(r, c+1)` |
| `vLines[r][c]` | `(rows-1)` × `cols` | Vertical line between dot `(r, c)` and `(r+1, c)` |
| `boxes[r][c]` | `(rows-1)` × `(cols-1)` | Box whose top-left corner is dot `(r, c)` |

Each `Line` holds `{ owner: number | null }`.
Each box entry is `number | null` (player index, or unclaimed).

### Why three arrays instead of one flat structure?

Indexing into three purpose-specific arrays avoids the fiddly index arithmetic of a single interleaved array (the "compressed edge" representation). The code is easier to read and test at the cost of a tiny amount of redundancy.

---

## Core Logic Separation

Two pure functions hold all game rules — they receive `state` but never touch the DOM:

- `countCompletions(state, kind, r, c)` — how many boxes would claiming line `(kind, r, c)` complete. Used as a forward-look without mutating. A future AI/hint mode can call this directly.
- `applyMove(state, kind, r, c)` — mutates state; returns number of boxes claimed so the caller knows whether the same player takes another turn.
- `isGameOver(state)` — true when every line is claimed.

---

## Rendering Approach: SVG

SVG was chosen over an HTML-grid approach because:

- Line elements map naturally to SVG `<line>` primitives.
- SVG scales cleanly with `viewBox` on any tablet/screen size.
- Event delegation on a single `<g>` layer keeps listener management simple.

### Layers (back to front)

1. **Box fill layer** — `<rect>` per box; initially transparent, filled with player colour at 35% opacity when claimed.
2. **Line drawn layer** — `<line>` elements rendered as dashed/ghost lines initially; styled solid with player colour when claimed.
3. **Box initials layer** — `<text>` elements inserted dynamically when a box is claimed; shows the first letter of the claiming player's name.
4. **Dot layer** — `<circle>` per dot, always on top of lines.
5. **Hit-target layer** — transparent `<rect>` elements, pointer-events only; always the topmost layer.

### Tap Target Design

The visual line is 3px wide. The invisible hit `<rect>` surrounding each line extends **±16px** perpendicular to the line (32px total hit width), satisfying the ≥30px tablet-friendly target requirement. The hit rect is exactly the gap between the two adjacent dots along the line axis so it doesn't overlap dot circles.

Hit targets are disabled after claiming by setting `data-claimed` (matched by a CSS `pointer-events: none` rule and guarded in the click handler).

---

## Grid Size

Default: **5×5 dots** (4×4 boxes).
A `<select>` on the control bar lets players choose 4–8 dots per side (3×3 to 7×7 boxes) before or between games. Changing the selector immediately restarts with a fresh board.

---

## Extra Turn Rule

`applyMove` returns the number of boxes claimed. The caller in the click handler only advances `currentPlayer` when that count is zero. If the player claimed one or more boxes, `currentPlayer` stays the same, giving them another turn. This is the canonical Dots and Boxes rule.

---

## Player Colors

- Player 1: `var(--accent)` (`#6cb1ff`, the shell's global accent)
- Player 2: `var(--p2-color)` (`#ff9f5a`), defined locally in the component `<style>` tag so it doesn't leak into the shell

---

## What Is Deferred

- **Animations**: line-draw and box-claim animations (scale-in, flash) — `TODO`
- **Sound effects**: subtle click on line draw, chime on box claim — `TODO`
- **AI opponent**: single-player mode with a greedy/chain-aware bot — `TODO`. The pure `countCompletions` function is the natural hook.
- **Double-cross strategy hints**: highlight lines that would give the opponent a long chain — `TODO`
- **Asymmetric grids**: `rows ≠ cols` (e.g. 4×6) — `TODO`
- **Score persistence** across sessions — `TODO`
