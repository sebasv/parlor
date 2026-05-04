# Backgammon — Design Document

## Point indexing

Points are numbered 1–24 in a fixed, absolute coordinate system:

- Point 1: bottom-right of the board (Player 0's home board, inner anchor)
- Point 24: top-right (Player 1's home board, inner anchor)

Visual layout (SVG board):

```
 13  14  15  16  17  18 | BAR | 19  20  21  22  23  24 | OFF
 ──────────────────────────────────────────────────────────
 12  11  10   9   8   7 | BAR |  6   5   4   3   2   1 | OFF
```

Top row shows points 13–24, bottom row shows points 12–1.

## Player direction conventions

- **Player 0 (white)** — moves counterclockwise, from high points toward low points (24 → 1).
  Home board: points 1–6. Bears off "below" point 1.
- **Player 1 (black)** — moves clockwise, from low points toward high points (1 → 24).
  Home board: points 19–24. Bears off "above" point 24.

## Starting position (standard Western backgammon)

| Point | Player 0 (white) | Player 1 (black) |
|-------|-----------------|-----------------|
| 24    | 2               |                 |
| 19    |                 | 5               |
| 17    |                 | 3               |
| 13    | 5               |                 |
| 12    |                 | 5               |
| 8     | 3               |                 |
| 6     | 5               |                 |
| 1     |                 | 2               |

Mirror image — player 0 and player 1 are exact mirrors of each other.

## Bar and re-entry

- Bar is a separate zone. `barCounts[player]` tracks how many checkers each player has on the bar.
- **Player 0 re-enters on points 19–24** (opponent's home board):
  - Die value `d` → enter at point `25 - d`
  - Roll 1 → point 24, roll 6 → point 19
- **Player 1 re-enters on points 1–6** (opponent's home board):
  - Die value `d` → enter at point `d`
  - Roll 1 → point 1, roll 6 → point 6
- If a player has any checker on the bar, they must re-enter all bar checkers before making any other moves.

## Bear-off zones

- Separate from the board. `bornOff[player]` tracks checkers removed.
- Displayed as a single circle with count in the bear-off column on the right side of the SVG.
- Player 0 bears off to bottom of the bear-off column (home is 1–6, off direction is below 1).
- Player 1 bears off to top of the bear-off column (home is 19–24, off direction is above 24).

## Bearing-off rules implemented

1. **Exact bear-off**: die value `d` where point `d` (for P0) or `25-d` (for P1) has a checker — removes one checker from that point.
2. **Over-bear**: die value exceeds the highest occupied home-board point — removes from the highest occupied point (only when no checker sits on a higher point, which is guaranteed since all checkers must be in home board).

## Dice UI

- Player taps "Roll dice" button → 2 dice rolled (or 4 chips if doubles).
- Dice shown as chips in a row. Active dice are bright; used/consumed dice would be dimmed (not tracked separately in v1 — chips disappear as dice are consumed since `state.dice` shrinks with each move).
- Highlighting: when a checker is selected, the die chips corresponding to moves from that checker are highlighted with the accent color.
- After each move, the consumed die is removed from `state.dice`. The chip count decreases.

## Move-input UX

1. Player taps "Roll dice".
2. Player taps a checker (or the bar if they have bar checkers) → checker is highlighted green; legal destinations are highlighted blue on the board.
3. Player taps a destination point → the move is executed, consuming one die.
4. If dice remain, player selects another checker. Repeat until all dice consumed or no legal moves remain.
5. Turn auto-passes when dice are exhausted or when `legalMoves()` returns empty after each move.

### Bar re-entry flow
- If player has checkers on the bar, only bar re-entry moves are shown.
- Player taps the bar zone (their checkers shown in the center bar area) → destinations highlighted.
- Player taps a destination point on the opponent's home board.

### Bearing-off flow
- When all 15 checkers are in the home board (or already borne off), bear-off moves are generated.
- The entire bear-off column glows as the destination.
- Player selects a checker → taps the bear-off column → checker is removed.

## Multiple-dice resolution — known relaxation

**The "must use both dice if possible" rule is NOT strictly enforced in v1.**

Standard backgammon requires that if only one die can be used, the player must use the higher-value die. It also requires using both dice if any sequence using both exists. Fully enforcing this requires enumerating all permutations of remaining dice against all checker positions — significant combinatorial complexity.

**Relaxation in v1**: the player may tap "No legal moves — pass" as long as `legalMoves()` is empty at that moment. The player could, by choosing an inferior move sequence, exhaust their options early. This is a UI convenience, not a rules engine violation at the move level.

**This is intentional and documented.** Post-v1, enforcement can be added by computing `hasAnyLegalSequence(state, allOriginalDice)` before allowing the pass.

## Forced-move detection

After each move, `legalMoves(state)` is called. If empty and dice remain:
- A "No legal moves — pass" button appears.
- The player taps it to end their turn.
- This correctly handles the "no entry possible from bar" scenario.

## What is deferred (TODO)

- **Doubling cube**: not implemented. Would add a second strategic layer.
- **AI opponent**: not implemented. Pass-and-play only.
- **Must-use-both-dice enforcement**: relaxed as documented above.
- **Animations**: checkers move instantly.
- **Sounds**: none.
- **Takebacks**: no undo.
- **Board flip per turn**: board orientation is fixed; players lean across the tablet.
- **Gammon/backgammon scoring**: winner detection only (first to bear off all 15). No score multiplier for gammon or backgammon.
- **Crawford rule, Jacoby rule**: not applicable without the doubling cube.
- **Opening roll tiebreak** (both players roll one die, higher goes first): not implemented. Player 0 always goes first.
