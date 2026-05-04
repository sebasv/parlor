/**
 * Backgammon — pure rules engine.
 *
 * Point indexing
 * --------------
 * Points are numbered 1–24 in a fixed, absolute coordinate system.
 * Point 1 is at the bottom-right of the board (player 0's inner board anchor),
 * point 24 is at the top-right (player 1's inner board anchor).
 *
 * Player 0 (white) moves counterclockwise: from high points toward point 1,
 * then bears off beyond point 1 (i.e. off the right side / "south" exit).
 * Player 1 (black) moves clockwise: from low points toward point 24,
 * then bears off beyond point 24 (i.e. off the left side / "north" exit).
 *
 * Starting position (standard Western backgammon):
 *   Player 0 (white): 2 on point 24, 5 on point 13, 3 on point 8, 5 on point 6.
 *   Player 1 (black): 2 on point 1,  5 on point 12, 3 on point 17, 5 on point 19.
 *
 * Bar and bear-off
 * ----------------
 * The bar is represented separately (barCounts[0] and barCounts[1]).
 * Bear-off counts track checkers removed from the board (bornOff[0], bornOff[1]).
 *
 * Re-entry from bar
 * -----------------
 * Player 0 re-enters on the opponent's home board (points 19–24).
 *   A die value d places the checker on point (25 - d), i.e.:
 *     roll 1 → point 24, roll 2 → point 23, ..., roll 6 → point 19.
 * Player 1 re-enters on the opponent's home board (points 1–6).
 *   A die value d places the checker on point d, i.e.:
 *     roll 1 → point 1, roll 2 → point 2, ..., roll 6 → point 6.
 *
 * Home boards (for bearing off)
 * ----------------
 * Player 0 home board: points 1–6.
 * Player 1 home board: points 19–24.
 *
 * Bearing-off rules
 * -----------------
 * A player may bear off only when all 15 checkers are in their home board or already borne off.
 * Bearing off with an exact die: remove one checker from that point.
 * Bearing off with a die value greater than the highest occupied point: remove from the
 *   highest occupied point (only if no checker is on a higher point).
 *
 * Known simplifications (v1)
 * --------------------------
 * - No doubling cube.
 * - No AI.
 * - "Must use both dice if possible" is not strictly enforced. Players may skip a die
 *   if they choose, even when a sequence using both exists. This is documented as a
 *   known relaxation — the full rule requires checking all permutations of remaining
 *   dice against all checker positions, which significantly complicates the engine.
 */

// ---------- Types ----------

export type Player = 0 | 1

/**
 * Represents the board as an array indexed 0–25 where:
 *   index 0 and 25 are unused sentinels (points are 1–24).
 *   Each slot holds [player, count] or null if empty.
 */
export type PointSlot = { player: Player; count: number } | null

/** points[i] for i in 1..24, indices 0 and 25 unused. */
export type Points = PointSlot[]

export interface GameState {
  points: Points
  /** Checkers on the bar for each player. */
  barCounts: [number, number]
  /** Checkers borne off for each player. */
  bornOff: [number, number]
  turn: Player
  /** Dice available for the current turn. After rolling: 2 or 4 values. */
  dice: number[]
  /** Whether the current player has rolled yet. */
  rolled: boolean
}

/** A single checker move. */
export type MoveKind =
  | { kind: 'reenter'; die: number; toPoint: number }
  | { kind: 'normal'; fromPoint: number; die: number; toPoint: number; hits: boolean }
  | { kind: 'bearoff'; fromPoint: number; die: number }

export type Move = MoveKind

// ---------- Direction helpers ----------

/** The point a player moves *toward* (their bearing-off side). */
export function homeDirection(player: Player): -1 | 1 {
  // Player 0 moves toward point 1 (decreasing), player 1 toward point 24 (increasing).
  return player === 0 ? -1 : 1
}

/** Points that make up a player's home board. */
export function homeBoardPoints(player: Player): number[] {
  if (player === 0) return [1, 2, 3, 4, 5, 6]
  return [19, 20, 21, 22, 23, 24]
}

/** The re-entry point for a given player and die value. */
export function reentryPoint(player: Player, die: number): number {
  // Player 0 enters opponent's home (24 down to 19): point = 25 - die
  // Player 1 enters opponent's home (1 up to 6):   point = die
  return player === 0 ? 25 - die : die
}

// ---------- State queries ----------

export function mustReenterFromBar(state: GameState, player: Player): boolean {
  return state.barCounts[player] > 0
}

/** Returns true when all 15 checkers are in home board or already borne off. */
export function canBearOff(state: GameState, player: Player): boolean {
  const home = new Set(homeBoardPoints(player))
  for (let p = 1; p <= 24; p++) {
    const slot = state.points[p]
    if (slot && slot.player === player && !home.has(p)) return false
  }
  // Also must have no checkers on the bar.
  return state.barCounts[player] === 0
}

/** The highest occupied home point for a player (for over-bear rule). */
function highestOccupiedHomePoint(state: GameState, player: Player): number | null {
  const home = homeBoardPoints(player)
  // "Highest" means highest point number regardless of direction.
  // For player 0 home (1–6): highest = 6 direction.
  // For player 1 home (19–24): highest = 24 direction.
  // We want the point *farthest from bearing off* (i.e. highest for P0, highest for P1).
  // Actually, for the over-bear rule we need the highest point that has checkers,
  // meaning the point with the largest number in the home range.
  const sorted = [...home].sort((a, b) => b - a)
  for (const p of sorted) {
    const slot = state.points[p]
    if (slot && slot.player === player) return p
  }
  return null
}

// ---------- Die indexing ----------

/**
 * Find the index of the first unused die matching `value` in the dice array.
 * Returns -1 if not found.
 */
function findDieIndex(dice: number[], value: number): number {
  return dice.indexOf(value)
}

// ---------- Legal move generation ----------

/**
 * Returns all legal moves for the current player given the current state.
 * Each move represents consuming exactly one die.
 */
export function legalMoves(state: GameState): Move[] {
  const { turn, dice, rolled } = state
  if (!rolled || dice.length === 0) return []

  const moves: Move[] = []
  const uniqueDice = [...new Set(dice)]

  if (mustReenterFromBar(state, turn)) {
    // Must re-enter before any other move.
    for (const die of uniqueDice) {
      const toPoint = reentryPoint(turn, die)
      const slot = state.points[toPoint]
      if (slot === null || slot.player === turn || slot.count === 1) {
        moves.push({ kind: 'reenter', die, toPoint })
      }
    }
    return moves
  }

  if (canBearOff(state, turn)) {
    // Generate bear-off moves.
    const home = homeBoardPoints(turn)
    for (const die of uniqueDice) {
      // Exact bear-off: point exists and has checker.
      const exactPoint = turn === 0 ? die : 25 - die
      if (home.includes(exactPoint)) {
        const slot = state.points[exactPoint]
        if (slot && slot.player === turn) {
          moves.push({ kind: 'bearoff', fromPoint: exactPoint, die })
        }
      }

      // Over-bear: die value exceeds highest occupied point.
      // For player 0: home is 1–6. "Exact point" for die d is point d.
      // Over-bear applies when d > highest occupied home point.
      // For player 1: "exact point" for die d is 25 - d.
      // Over-bear applies when d > (24 - lowestOccupied + 1)... let's think differently.
      // Player 0 bears off toward point 0 (below 1). Home = 1–6.
      //   exact die d hits point d. Over-bear if no checker at points d..6 but checkers at 1..d-1.
      //   Simplified: over-bear with die d from the highest occupied point if d > highestOccupied.
      // Player 1 bears off toward point 25 (above 24). Home = 19–24.
      //   exact die d hits point 25-d. Over-bear if d > (24 - lowestOccupied + 1).
      //   Simplified: over-bear with die d from the highest occupied if 25-d < lowestOccupied.
      // Unified: over-bear from the "outermost" occupied point when the die overshoots.

      const highest = highestOccupiedHomePoint(state, turn)
      if (highest === null) continue

      // For player 0: points 1–6. Exact hit is at point `die`. Over-bear if die > highest.
      // For player 1: points 19–24. Exact hit is at 25 - die. Over-bear if (25 - die) < lowest occupied.
      if (turn === 0) {
        // Over-bear: die > highest occupied (and no checker at exact point, which is < die)
        if (die > highest) {
          const slot = state.points[highest]
          if (slot && slot.player === turn) {
            const alreadyAdded = moves.some(
              (m) => m.kind === 'bearoff' && m.fromPoint === highest && m.die === die,
            )
            if (!alreadyAdded) moves.push({ kind: 'bearoff', fromPoint: highest, die })
          }
        }
      } else {
        // Player 1: "highest" in range 19–24. Over-bear if 25 - die < (lowest occupied).
        // Find lowest occupied home point for player 1.
        const lowestOccupied = Math.min(
          ...home.filter((p) => {
            const s = state.points[p]
            return s !== null && s.player === turn
          }),
        )
        if (!Number.isFinite(lowestOccupied)) continue
        if (25 - die < lowestOccupied) {
          // Over-bear from highest (= highest numbered, which for player 1 home means closer to 24)
          const slot = state.points[highest]
          if (slot && slot.player === turn) {
            const alreadyAdded = moves.some(
              (m) => m.kind === 'bearoff' && m.fromPoint === highest && m.die === die,
            )
            if (!alreadyAdded) moves.push({ kind: 'bearoff', fromPoint: highest, die })
          }
        }
      }
    }

    // Also allow normal moves within home board if any exist.
    for (const die of uniqueDice) {
      for (const fromPoint of home) {
        const slot = state.points[fromPoint]
        if (!slot || slot.player !== turn) continue
        const toPoint = fromPoint + die * homeDirection(turn)
        if (toPoint < 1 || toPoint > 24) continue // would be off board, handled by bear-off
        if (!home.includes(toPoint)) continue // would move out of home — not useful but legal in theory
        const dest = state.points[toPoint]
        if (dest === null || dest.player === turn || dest.count === 1) {
          moves.push({
            kind: 'normal',
            fromPoint,
            die,
            toPoint,
            hits: dest !== null && dest.player !== turn,
          })
        }
      }
    }

    return deduplicateMoves(moves)
  }

  // Normal moves.
  for (const die of uniqueDice) {
    for (let fromPoint = 1; fromPoint <= 24; fromPoint++) {
      const slot = state.points[fromPoint]
      if (!slot || slot.player !== turn) continue

      const toPoint = fromPoint + die * homeDirection(turn)
      if (toPoint < 1 || toPoint > 24) continue // would bear off but not in bear-off phase

      const dest = state.points[toPoint]
      if (dest === null || dest.player === turn || dest.count === 1) {
        moves.push({
          kind: 'normal',
          fromPoint,
          die,
          toPoint,
          hits: dest !== null && dest.player !== turn,
        })
      }
    }
  }

  return deduplicateMoves(moves)
}

function deduplicateMoves(moves: Move[]): Move[] {
  const seen = new Set<string>()
  return moves.filter((m) => {
    const key = JSON.stringify(m)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ---------- Apply move ----------

/**
 * Apply a single move (consuming one die) and return the new state.
 * If dice are exhausted after this move, turn passes to the other player
 * (with rolled = false).
 */
export function applyMove(state: GameState, move: Move): GameState {
  const points = state.points.map((s) => (s ? { ...s } : null)) as Points
  const barCounts: [number, number] = [...state.barCounts] as [number, number]
  const bornOff: [number, number] = [...state.bornOff] as [number, number]
  const turn = state.turn
  const opponent = (1 - turn) as Player

  // Remove the used die.
  const diceAfter = [...state.dice]
  const dieIdx = findDieIndex(diceAfter, move.die)
  if (dieIdx !== -1) diceAfter.splice(dieIdx, 1)

  switch (move.kind) {
    case 'reenter': {
      barCounts[turn]--
      const dest = points[move.toPoint]
      if (dest && dest.player === opponent) {
        // Hit the blot.
        barCounts[opponent]++
        points[move.toPoint] = { player: turn, count: 1 }
      } else if (dest && dest.player === turn) {
        dest.count++
      } else {
        points[move.toPoint] = { player: turn, count: 1 }
      }
      break
    }
    case 'normal': {
      // Remove from source.
      const src = points[move.fromPoint]
      if (src) {
        src.count--
        if (src.count === 0) points[move.fromPoint] = null
      }
      // Place at destination.
      const dest = points[move.toPoint]
      if (dest && dest.player === opponent) {
        // Hit the blot.
        barCounts[opponent]++
        points[move.toPoint] = { player: turn, count: 1 }
      } else if (dest && dest.player === turn) {
        dest.count++
      } else {
        points[move.toPoint] = { player: turn, count: 1 }
      }
      break
    }
    case 'bearoff': {
      const src = points[move.fromPoint]
      if (src) {
        src.count--
        if (src.count === 0) points[move.fromPoint] = null
      }
      bornOff[turn]++
      break
    }
  }

  // After consuming the die, check if turn should pass.
  // Turn passes when dice are exhausted OR no legal moves remain with remaining dice.
  const newState: GameState = {
    points,
    barCounts,
    bornOff,
    turn,
    dice: diceAfter,
    rolled: true,
  }

  if (diceAfter.length === 0) {
    return endTurn(newState)
  }

  // Check if there are any legal moves left with remaining dice.
  const remaining = legalMoves(newState)
  if (remaining.length === 0) {
    return endTurn(newState)
  }

  return newState
}

function endTurn(state: GameState): GameState {
  return {
    ...state,
    turn: (1 - state.turn) as Player,
    dice: [],
    rolled: false,
  }
}

// ---------- Winner ----------

export function winner(state: GameState): Player | null {
  if (state.bornOff[0] === 15) return 0
  if (state.bornOff[1] === 15) return 1
  return null
}

// ---------- Dice ----------

export function rollDice(): number[] {
  const d1 = Math.floor(Math.random() * 6) + 1
  const d2 = Math.floor(Math.random() * 6) + 1
  if (d1 === d2) return [d1, d1, d1, d1]
  return [d1, d2]
}

// ---------- Initial state ----------

export function initialState(): GameState {
  const points: Points = Array(26).fill(null)

  function place(point: number, player: Player, count: number) {
    points[point] = { player, count }
  }

  // Player 0 (white): 2 on 24, 5 on 13, 3 on 8, 5 on 6
  place(24, 0, 2)
  place(13, 0, 5)
  place(8, 0, 3)
  place(6, 0, 5)

  // Player 1 (black): 2 on 1, 5 on 12, 3 on 17, 5 on 19
  place(1, 1, 2)
  place(12, 1, 5)
  place(17, 1, 3)
  place(19, 1, 5)

  return {
    points,
    barCounts: [0, 0],
    bornOff: [0, 0],
    turn: 0,
    dice: [],
    rolled: false,
  }
}
