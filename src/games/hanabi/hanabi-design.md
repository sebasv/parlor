# Hanabi — Design Decisions

## Scope

v1 implements the canonical 5-suit Hanabi for 2–5 players in pass-and-play mode.
No rainbow/sixth suit. No AI agents. No animations or sounds.

## Deck & Shuffle

50-card multiset: 5 suits × (three 1s, two 2s, two 3s, two 4s, one 5).
Shuffled with Fisher-Yates using `Math.random`. Hand size: 5 cards for 2–3 players,
4 cards for 4–5 players (per canonical rules).

## Clue Representation

Each card slot carries a `CardKnowledge` record `{ suit: Suit | null, rank: Rank | null }`.
Receiving a colour clue sets `suit` on every matching slot. Receiving a number clue sets
`rank`. Multiple clues accumulate: a slot can end up knowing both suit and rank.

Clue tags are rendered below each card back: a coloured dot/pill for a known suit, a
grey pill for a known number. Unclued slots show a grey `?`.

Zero-clue enforcement: the clue picker only enables suit/number options that match at
least one card in the target's hand. Giving a clue that touches zero cards is therefore
impossible in the UI, consistent with canonical rules.

## Pass-and-Play UX

Critical invariant: the active player must never see their own cards face-up.

When it is Player A's turn:
- A's hand is rendered face-down (card backs with clue tags).
- All other players' hands are rendered face-up with suit colour and number visible.

After A acts, a full-screen pass screen appears before re-rendering:
  "Pass to <next player>. Tap Ready when only they can see."
The next player taps Ready, which dismisses the overlay and re-renders from their
perspective (their hand face-down, everyone else face-up).

## Score-on-Fizzle Rule

When all three fuse tokens are spent the game ends and the score equals the current
sum of fireworks tops (not zero). This is the canonical "tournament" rule and matches
the spirit of the game — the team's partial progress is still recognized.

Completing a 5 rewards one clue token (if not already at 8), per canonical rules.

## End-of-Deck Handling

When the deck becomes empty, each remaining player (including the one who drew the
last card) gets exactly one final turn. `finalTurnsRemaining` counts down from
`playerCount` and the game ends when it reaches 0.

## What Is Deferred

- Rainbow/sixth suit variant
- AI / hint agents
- Replay viewer
- Animations (card draw, play success/fail)
- Sound effects
- Undo / take-back
- More nuanced clue display (e.g. highlighting which cards a clue touched in history)
- Accessibility improvements (ARIA live regions for state changes)
