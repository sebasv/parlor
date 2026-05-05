# Ludo — Design Choices & Simplifications

## Board Model

The board is a 15×15 grid, matching the traditional Ludo board topology.

- **Main track**: 52 squares, numbered 0–51 clockwise. Hard-coded as `MAIN_TRACK` in `index.ts`.
- **Pawn position**: `{ zone: 'yard' | 'track' | 'home' | 'finished', index?: number }`.
- **Home columns**: 6 squares (index 0–5) per player. Index 5 is the "finished" square.

## Player Entry Points

Each player's pawn enters the main track at a different offset:

| Player | Colour | Main-track entry | Home entry (last track sq before home col) |
|--------|--------|-----------------|-------------------------------------------|
| 0      | Red    | 0               | 51                                         |
| 1      | Yellow | 13              | 12                                         |
| 2      | Green  | 26              | 25                                         |
| 3      | Blue   | 39              | 38                                         |

After `HOME_ENTRIES[p]`, the pawn turns into the player's home column.

## Rules Implemented

- Roll d6 to move; must roll **6** to release a pawn from yard onto start square.
- Landing on a lone opponent pawn sends it back to its yard (capture).
- Exact roll required to enter the final home square (index 5). Overshoot = illegal.
- Rolling a 6 grants an extra roll (bonus turn).
- Three consecutive 6s forfeit the turn (state tracked via `consecutiveSixes`).
- First player to have all 4 pawns in `zone: 'finished'` wins.

## Simplifications (v1)

- **No safe squares**: Any square on the main track can be a capture square.
- **No blocking**: Two pawns of the same colour on the same square do not form an unpassable block. Stacking is silently allowed.
- **No stacks for capture**: The current implementation captures *all* opponent pawns on a square when landing. Standard rules only capture lone pawns; stacks of 2+ form a block. TODO: implement block/stack rule properly.
- **No global home-column uniqueness**: Multiple own pawns can occupy the same home-column square. Standard rules forbid this. TODO.
- **No computer opponent**: All players are human (hot-seat).

## TODO

- Implement blocking: 2+ same-colour pawns on a square form an impassable block; opponents cannot land or pass through.
- Implement safe squares (highlighted squares where capture is not allowed).
- Add animation for pawn movement.
- Computer / AI opponent.
- Persistent game state (local storage).

## UI Architecture

- Pure SVG board rendered once; pawn positions are re-rendered on every state change.
- State lives in a single `GameState` object (from `rules.ts`).
- Roll button → sets `state.dice`; clicking a selectable pawn calls `applyMove`.
- No framework dependencies; vanilla DOM + SVG.
