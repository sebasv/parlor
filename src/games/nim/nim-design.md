# Nim — Design Document

## Variant chosen

**Multi-pile normal Nim** — three piles, taker of the last token wins.

Reasoning: normal play is the canonical variant that makes the XOR (nim-sum) strategy most
naturally discoverable. Misère (last-taker loses) is confusing for casual players and obscures
the elegant pattern. One variant is shipped; the config type supports switching.

## Pile setup

Default: **3 piles of 3, 5, 7 tokens**.

These are the classic starting counts used in most Nim literature. They are asymmetric enough
to hide the winning first-move (take 1 from the 7-pile to reach a balanced XOR = 0 position),
yet small enough to fit comfortably on a tablet in a single screen.

The `NimConfig` interface accepts any `piles: readonly number[]`, so other setups (e.g. 4 piles,
larger counts) require only a config change.

## UI interaction model

**Tap to mark, then Take.**

A player taps any token in a pile. That pile becomes "selected" (blue outline), and all tokens
from the tapped one to the top of the pile are highlighted red as "marked for removal". Tapping
a lower token in the same pile re-adjusts the marked range — this lets players fine-tune how
many they want to remove in a single gesture. A **Take** button confirms; **Cancel** clears the
selection.

Why this over a stepper/counter: visual token rows make the quantity concrete and encourage
children to think about the pile size. The "tap the bottom of what you want to remove" gesture
is intuitive on tablets without requiring a number input.

Tokens in other piles are disabled (visually dimmed) while a pile is selected, reinforcing the
rule that you must take from exactly one pile per turn.

## Rules logic

Three pure functions handle all game logic, no DOM dependency:

- `legalTakes(pileCount)` — returns valid removal amounts (1 … pileCount).
- `checkWin(piles, lastPlayer, variant)` — returns winner index or null.
- `isLosingPosition(piles, variant)` — XOR analysis; ready for an AI to call.

These are re-exported from `index.ts` so a future AI module can import them without pulling in
any DOM code.

## Deferred / TODOs

- **AI opponent** — `isLosingPosition` is in place; the AI would compute the optimal pile to
  take from using the nim-sum. Wire up as a second "player" option when a solo mode is added to
  the shell.
- **Misère variant toggle** — `NimConfig.variant` already supports `'misere'`; `checkWin` and
  `isLosingPosition` both handle it. A UI toggle (settings panel or pre-game screen) is the only
  missing piece.
- **Custom pile setup** — allow players to choose pile count and starting sizes before the game
  begins. Requires a pre-game config screen.
- **Hint mode** — highlight whether the current position is winning or losing (using XOR sum)
  to teach the strategy interactively.
- **Animation** — tokens could fade/scale out when taken rather than instantly disappearing.
- **Score tracking across games** — win counter per player persisted in localStorage.

## Styling approach

Game styles are injected as a `<style id="nim-styles">` tag on mount and removed on cleanup,
keeping all Nim CSS inside `src/games/nim/` without touching the global `styles.css`. Class
names are all prefixed `nim-` to avoid collisions with the shell or other games.
