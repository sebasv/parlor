# Sprouts — Design Document

## Starting Dot Count

**Chosen: N = 3.**

- 3 starting dots leads to games of roughly 5–9 moves, which is short enough to learn the rules quickly on a first play.
- 4 dots gives meatier games (8–14 moves) and more interesting topology. Recommended for v2 via a selector (like the Dots-and-Boxes grid selector).
- The constant `INITIAL_DOTS` in `index.ts` can be changed to 4 at any time with a one-line edit.

## Drawing UX

Players draw a curve by dragging across the SVG canvas:

1. **pointerdown** — snaps to the nearest live dot within `SNAP_RADIUS` (30 px). If no live dot is nearby, the gesture is ignored.
2. **pointermove** — appends the current SVG coordinate to `draftPoints`. A live `<polyline>` element is updated in real time so the player sees their path as they draw.
3. **pointerup** — snaps to the nearest live dot. If the endpoint is valid and the drawn path does not cross any existing curve, the move is committed.

**Tablet-first:** dots are 18 px radius and the snap ring is 30 px, making them comfortable to hit on tablet touch screens. `touch-action: none` prevents scrolling during drawing.

## No-Crossing Validation

Every consecutive segment of the new polyline is checked against every consecutive segment of every committed curve using a segment–segment intersection test (cross-product / parametric form). The algorithm runs in O(S_new × S_existing) time where S is the number of segments, which is perfectly fast for the scale of Sprouts games.

**Key detail:** a small epsilon (0.02) is used at intersection-parameter boundaries so that two curves sharing a common dot endpoint do not falsely register as crossing. The first and last points of each committed curve are exactly the dot centres, which makes the shared-endpoint case unambiguous.

## Auto-Place vs Manual Dot Placement

**Chosen: auto-place at the polyline midpoint (by index).**

The new dot is placed at `pts[Math.floor(pts.length / 2)]` — the midpoint index of the captured point array. This is fast, unambiguous, and gives a visually reasonable result without any additional interaction step.

Manual dot placement (tap somewhere on the drawn curve) was considered but rejected for v1 because:
- It requires hit-testing a curve, which is complex on SVG polylines.
- It adds an extra interaction step that could confuse new players.
- The auto-placed midpoint is geometrically fine — the rules only require the dot to lie *on* the curve.

The new auto-placed dot starts with 2 connections (one for each half of the curve it sits on).

## "I Can't Move" Pass Button

**SIMPLIFICATION — documented loudly:**

Full automatic detection of "no legal moves" in Sprouts is non-trivial. It requires checking, for every pair of live dots (and every live dot with itself), whether there exists a path connecting them that does not cross any existing curve and does not violate connection limits. This is a planar reachability problem with topological obstacles.

**For v1, we provide a "I can't move" button.** When a player clicks it:
- That player is declared to have lost.
- The opponent is declared the winner.

Players are expected to honestly determine that no legal move is available. An explanatory note is shown beneath the board. This is documented in the UI.

**TODO (v2):** implement automatic legal-move detection using a flood-fill / reachability check over the current planar subdivision.

## Connection Counting

- A dot starts with 0 connections.
- Each time a dot is used as an endpoint of a curve, its connection count increases by 1.
- A self-loop on a dot increases its connection count by 2 (one for each end of the curve, which is the same dot).
- A dot is **dead** (cannot be used) when its connection count reaches 3.
- The auto-placed new dot starts with connections = 2 (the curve was split into two halves by the dot).

## Visual Language

| Connection count | Colour | Meaning |
|---|---|---|
| 0 or 1 | Green (#4ade80) | Live — freely usable |
| 2 | Yellow (#facc15) | Warning — one slot remaining |
| 3 | Red (#ef4444) | Dead — cannot be used |

Each dot shows its connection count as a numeral in the centre (or "X" if dead). A subtle snap-ring (30 px radius, low opacity) shows the tap target for live dots.

## Player Colours

- Player 0: `--accent` (#6cb1ff, blue)
- Player 1: #ff9f5a (orange)

Committed curves are drawn in a neutral blue; the distinction is whose turn it is, not whose curves are whose (Sprouts curves are shared topology, not owned by a player).

## Deferred / TODO

- **Manual dot placement** — let the player tap on the drawn curve to choose where the new dot goes.
- **Automatic no-legal-moves detection** — flood-fill reachability check over the planar graph.
- **Undo** — single-step undo for misdraws.
- **Animated curves** — stroke-dashoffset animation when a curve is committed.
- **AI opponent** — Sprouts theory is complex; even a simple heuristic AI is non-trivial.
- **N selector** — UI control to pick 3 or 4 starting dots (analogous to Dots-and-Boxes grid selector).
- **Replay** — step through committed moves.
- **Win detection without pass** — detect automatically when no live dot pair has a connectable path.
