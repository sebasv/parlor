# Set — Design Document

## Shape Rendering

Cards are rendered with inline SVG. The three shapes used are **circle**, **square**, and **triangle** — a deliberate simplification from the canonical oval / diamond / squiggle to keep the SVG manageable. This is documented here so the canonical shapes can be added later without changing game logic.

The three shadings:
- **solid** — shape filled with the card colour at full opacity.
- **striped** — shape clipped against a repeating horizontal-stripe pattern (`<pattern>` element with thin filled rectangles), stroke also drawn.
- **open** — shape drawn as stroke only, no fill.

## Card Layout

Twelve cards are shown in a responsive CSS grid. Each card shows 1, 2, or 3 copies of the shape, stacked vertically inside the card. Card size is large (`min(18vw, 110px)` wide) to make tap targets generous on a tablet.

## Concurrent Local-Multiplayer Claim UX

Single tablet, multiple players. Claim flow:

1. **Claim buttons** — one large coloured button per player, arranged around the card grid (below the grid for players 1–3, above for players 4–6 when > 3 players). The button shows the player name.
2. **Slap to claim** — when a player taps their claim button the game enters **selection mode** for that player:
   - All other claim buttons are immediately disabled.
   - A banner names who is selecting and counts down **10 seconds**.
   - The player taps exactly 3 cards. Selected cards get a highlight border.
   - A **Confirm** and **Cancel** button appear once 3 cards are chosen.
   - Auto-cancel fires after 10 s with no penalty (same as manual cancel).
3. **Validation** — on Confirm:
   - Valid set → +1 point, the 3 cards are removed and replaced from the deck (or extra cards dealt — see below), selection mode ends.
   - Invalid set → −1 point (score can go below 0), selection mode ends. A brief "Not a set!" message is shown. No skip-a-turn — the penalty is the point loss and the embarrassment.
4. All claim buttons re-enable after selection mode ends.

## Deal-3-Extra Rule

After every successful claim the table refills to 12 cards from the deck. If, after refilling, no valid set exists among the visible cards, 3 more cards are added (up to 15, then 18, etc.) and a notice "No set — dealing 3 more" is shown. This repeats until a set exists or the deck is empty. When the deck is empty and no valid set remains among the visible cards, the game ends.

## Penalty Choice

Invalid claim → **−1 point**. No cooldown / skip-a-turn: keeping all players actively engaged is more important than discouraging bad guesses on a family tablet game.

## Claim Timeout

10 seconds. Auto-cancel (no penalty). The 10 s countdown is visible to all players so nobody is left waiting in silence.

## Scoring Display

A score strip is shown above the card grid, one badge per player, coloured with the player's accent colour.

## End-Game Condition

The game ends when the deck is exhausted **and** no valid set exists among the remaining face-up cards. A winner screen shows the final scores and a "New game" button.

## Deferred / TODO

- **Hint button** — highlight one valid set (already has `findAnySet` helper).
- **Card replacement animation** — fade-in / fly-in for new cards.
- **Sound effects** — success / fail / claim buzzer.
- **True simultaneous race** — right now only one player can be in selection mode at a time; a future version could let two players race and award to whoever confirms first.
- **Canonical shapes** — oval / diamond / squiggle SVG paths to match physical Set cards.
- **Accessibility** — keyboard navigation, ARIA roles for card selection.
