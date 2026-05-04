# Codenames Duet — Design Document

## Key Card Distribution (V1 Simplification)

The canonical Codenames Duet key card has a specific distribution across 25 tiles where:
- Player A sees 9 agents (green), 3 assassins, 13 bystanders
- Player B sees 9 agents (green), 3 assassins, 13 bystanders
- Some tiles are agent for both players, some for just one, some for neither
- Exactly 15 distinct words need to be found across both key cards
- Exactly 3 assassin positions with possible overlap

**V1 simplification:** Each player gets an independently-generated key card with ~9 agents, ~3 assassins, and ~13 neutral tiles. The roles are assigned randomly per player with no coupling between the two key cards. This means:

- Total target agents = |A_agents ∪ B_agents| — any word marked agent by either player must be found
- Assassin positions are independent, so hitting one player's assassin still loses the game
- In practice the win condition is harder than canonical because there is less overlap between agent sets, meaning more words need to be found in 9 turns

This simplification preserves the core mechanic (asymmetric information, clue-giving, assassin fear) while deferring the complexity of canonical tile distribution.

## Turn Structure

- Default: 9 turns total (matches canonical Duet)
- Turn = one pair of (spymaster gives clue, guesser taps words)
- Roles swap after each turn (guesser becomes next spymaster)
- Guesser gets `clue_number + 1` guesses per turn (the +1 is standard Codenames bonus)
- Tapping a neutral word ends the guessing phase immediately
- Tapping an assassin ends the game immediately (lose)
- Guesser can voluntarily stop early (end turn)

## Win/Lose Conditions

- **Win:** All words marked as agent by either player are revealed
- **Lose (assassin):** Any player taps a word that is an assassin on their current key card
- **Lose (timeout):** All 9 turns are used without finding all agents

## Pass-and-Play UX

1. Spymaster sees the colored key card overlay on the grid, enters clue + number
2. Tap "Done — pass to [Partner]" → pass screen covers display
3. Partner taps "Ready" → guesser view shows plain grid + clue text
4. Guesser taps words; each tap reveals the tile's color (agent/neutral/assassin)
5. Turn ends (neutral/no guesses left/voluntarily) → pass screen → next spymaster

## Word List

- ~97 common English nouns, hand-curated for children of various ages
- Words are simple, concrete, age-appropriate (animals, objects, nature, food)
- No scary, violent, or age-inappropriate content
- All uppercase for visual clarity on the grid

**Deferred:**
- Multiple themed word lists (beginner, advanced, themed categories)
- Larger word pool (200+ words)
- Custom word list entry

## Deferred for V2+

- Canonical Duet key card distribution (exact 15-agent overlap, specific assassin count)
- Animations when tiles are revealed
- Sound effects
- Undo last guess
- Cooperative score history / streaks
- Timer per turn
- Multiple word list sets (themes, difficulty levels)
- Accessibility improvements (screen reader support, keyboard navigation for grid)
- Portrait/landscape layout optimization
- Color-blind friendly mode

## Deviations from Canonical Rules

1. **Key card distribution:** Independent random assignment per player rather than coordinated Duet distribution. Makes the game slightly harder (more total agents to find, less overlap).
2. **No "infinite guesses" option:** Guesser is limited to clue_number + 1 guesses (canonical allows teams to agree to unlimited for beginner play). This could be a settings option in V2.
3. **Assassin check:** Only the current guesser's key card is checked for assassins on each tap, not both. This matches the original intent (each player's danger is their own key card's assassins).
