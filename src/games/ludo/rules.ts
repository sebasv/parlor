/**
 * Ludo — pure rules engine.
 *
 * Board representation
 * --------------------
 * The main track has 52 squares numbered 0–51, traversed clockwise.
 * Each player enters at a different offset on the main track:
 *   Player 0 (red):    enters at track index 0,  home column offset 39
 *   Player 1 (yellow): enters at track index 13, home column offset 0
 *   Player 2 (green):  enters at track index 26, home column offset 13
 *   Player 3 (blue):   enters at track index 39, home column offset 26
 *
 * A pawn's position is one of:
 *   { zone: 'yard' }                  — not yet on the board
 *   { zone: 'track', index: 0..51 }   — on the shared 52-square main track
 *   { zone: 'home', index: 0..5 }     — on the player's 6-square home column
 *                                        (index 5 = finished)
 *   { zone: 'finished' }              — in the home target (all 4 = win)
 *
 * Entering the board
 * ------------------
 * A player may release a pawn from the yard onto their start square only when
 * rolling a 6. If the start square is occupied by 1 or more of the player's
 * own pawns, stacking is allowed. Opponent pawns on the start square are
 * captured (sent back to their yard).
 *
 * Moving on the track
 * -------------------
 * A pawn at track index t moves to (t + dice) % 52.
 * But first we check if the pawn will pass into or through the home column.
 * The home column entry point for player p is:
 *   ENTRY[p] = (STARTS[p] + 51) % 52   (one step before completing the loop)
 * When the pawn reaches or passes ENTRY[p], it enters the home column at:
 *   home index = dice - steps_to_reach_entry
 * If home index > 5, the move overshoots home and is illegal (exact roll needed).
 * Home index 5 means the pawn is finished.
 *
 * Capture
 * -------
 * Landing on a square occupied by exactly one opponent pawn sends it to its yard.
 * (No safe squares in v1; no blocking rule.)
 *
 * Extra turn on 6
 * ---------------
 * Rolling a 6 grants an extra roll. Three consecutive 6s forfeit the turn
 * (common house rule).
 *
 * Winning
 * -------
 * First player to get all 4 pawns to zone 'finished'.
 */

// ---------- Types ----------

export type PlayerIndex = 0 | 1 | 2 | 3

export interface YardPos {
  zone: 'yard'
}
export interface TrackPos {
  zone: 'track'
  index: number // 0–51
}
export interface HomePos {
  zone: 'home'
  index: number // 0–5, where 5 = finished square
}
export interface FinishedPos {
  zone: 'finished'
}

export type PawnPos = YardPos | TrackPos | HomePos | FinishedPos

export interface Pawn {
  player: PlayerIndex
  slot: number // 0–3 within the player's set
  pos: PawnPos
}

export interface GameState {
  pawns: readonly Pawn[]
  turn: PlayerIndex
  /** Rolled die value for the current sub-turn (1–6). null = need to roll. */
  dice: number | null
  /** Number of consecutive 6s rolled this turn (resets to 0 when a non-6 is rolled). */
  consecutiveSixes: number
  /** Number of active players (2–4). */
  playerCount: number
}

export interface Move {
  pawnSlot: number // which of current player's pawns (0–3) to move
  kind: 'release' | 'advance' // 'release' = from yard to start square
}

// ---------- Constants ----------

/** Main-track index where each player's pawn enters the board. */
export const STARTS: readonly number[] = [0, 13, 26, 39]

/**
 * The last main-track square before entering the home column.
 * For player p, this is STARTS[p] - 1 (mod 52).
 * After this square, the pawn turns into the home column.
 */
export const HOME_ENTRIES: readonly number[] = [51, 12, 25, 38]

// ---------- Helpers ----------

/** Steps remaining on the main track before this pawn enters its home column. */
function stepsToHomeEntry(player: PlayerIndex, trackIndex: number): number {
  const entry = HOME_ENTRIES[player]
  if (trackIndex <= entry) {
    return entry - trackIndex + 1
  }
  // Wrapped around: from trackIndex, go to 51, then wrap to 0..entry
  return 52 - trackIndex + entry + 1
}

/** All pawns of a given player. */
function playerPawns(state: GameState, player: PlayerIndex): Pawn[] {
  return state.pawns.filter((p) => p.player === player)
}

/** Pawns from other players currently at a given track index. */
function opponentsAt(state: GameState, player: PlayerIndex, trackIndex: number): Pawn[] {
  return state.pawns.filter(
    (p) =>
      p.player !== player && p.pos.zone === 'track' && (p.pos as TrackPos).index === trackIndex,
  )
}

/** Count of player's own pawns at a given track index. */
function ownCountAt(state: GameState, player: PlayerIndex, trackIndex: number): number {
  return state.pawns.filter(
    (p) =>
      p.player === player && p.pos.zone === 'track' && (p.pos as TrackPos).index === trackIndex,
  ).length
}

// ---------- Move generation ----------

/**
 * All legal moves for the current player given the rolled die.
 * Returns an empty array if there are no legal moves (turn should be passed).
 */
export function legalMoves(state: GameState): Move[] {
  if (state.dice === null) return []
  const dice = state.dice
  const player = state.turn
  const pawns = playerPawns(state, player)
  const moves: Move[] = []

  for (const pawn of pawns) {
    const { pos } = pawn

    if (pos.zone === 'yard') {
      // Can only release with a 6
      if (dice === 6) {
        moves.push({ pawnSlot: pawn.slot, kind: 'release' })
      }
      continue
    }

    if (pos.zone === 'finished') continue

    if (pos.zone === 'home') {
      const newHomeIdx = pos.index + dice
      // Must land exactly on index 5 to finish, or land on 0–4
      if (newHomeIdx <= 5) {
        moves.push({ pawnSlot: pawn.slot, kind: 'advance' })
      }
      continue
    }

    // zone === 'track'
    const stepsToEntry = stepsToHomeEntry(player, pos.index)

    if (dice < stepsToEntry) {
      // Stays on the track
      const newTrack = (pos.index + dice) % 52
      // Cannot land on own pawns if 2+ already there? No — stacking allowed in this v1
      // Just check it's not completely blocked (stacking is always allowed)
      void newTrack
      moves.push({ pawnSlot: pawn.slot, kind: 'advance' })
    } else if (dice === stepsToEntry) {
      // Enters home column at index 0... actually "entry" here means
      // the pawn steps onto home index 0.
      // stepsToEntry counts steps to reach HOME_ENTRIES[player] and then +1 to enter
      // Re-check: stepsToEntry already accounts for landing on index 0 of home.
      moves.push({ pawnSlot: pawn.slot, kind: 'advance' })
    } else {
      // dice > stepsToEntry: would enter home column past index 0
      const homeIdx = dice - stepsToEntry
      if (homeIdx <= 5) {
        moves.push({ pawnSlot: pawn.slot, kind: 'advance' })
      }
      // else overshoots — illegal, no move for this pawn
    }
  }

  return moves
}

// ---------- Apply move ----------

/**
 * Apply a move and return the new state.
 * This handles:
 *  - Releasing a pawn from yard to start square (capturing any lone opponent)
 *  - Advancing a pawn along the track or into the home column
 *  - Captures when landing on a lone opponent pawn
 *  - Transitioning turn (extra turn on 6, capped at 3 consecutive 6s)
 */
export function applyMove(state: GameState, move: Move): GameState {
  if (state.dice === null) return state

  const dice = state.dice
  const player = state.turn
  const newPawns = state.pawns.map((p) => ({ ...p, pos: { ...p.pos } as PawnPos }))

  const pawnIdx = newPawns.findIndex((p) => p.player === player && p.slot === move.pawnSlot)
  if (pawnIdx === -1) return state
  const pawn = newPawns[pawnIdx]

  if (move.kind === 'release') {
    // Move from yard to start square
    const startTrack = STARTS[player]
    // Capture any lone opponent on start square
    captureOpponentsAt(newPawns, player, startTrack)
    pawn.pos = { zone: 'track', index: startTrack }
  } else {
    // Advance
    const pos = pawn.pos

    if (pos.zone === 'home') {
      const newHomeIdx = pos.index + dice
      if (newHomeIdx === 5 || newHomeIdx > 4) {
        pawn.pos = { zone: 'finished' }
      } else {
        pawn.pos = { zone: 'home', index: newHomeIdx }
      }
    } else if (pos.zone === 'track') {
      const stepsToEntry = stepsToHomeEntry(player, pos.index)

      if (dice < stepsToEntry) {
        const newTrack = (pos.index + dice) % 52
        // Capture lone opponents
        captureOpponentsAt(newPawns, player, newTrack)
        pawn.pos = { zone: 'track', index: newTrack }
      } else {
        const homeIdx = dice - stepsToEntry
        if (homeIdx >= 5) {
          pawn.pos = { zone: 'finished' }
        } else {
          pawn.pos = { zone: 'home', index: homeIdx }
        }
      }
    }
  }

  // Determine next turn
  const extraTurn = dice === 6 && state.consecutiveSixes < 2
  const nextTurn = extraTurn ? player : nextActivePlayer(state.playerCount, player)
  const nextSixes = extraTurn ? state.consecutiveSixes + 1 : 0

  return {
    ...state,
    pawns: newPawns,
    turn: nextTurn,
    dice: null,
    consecutiveSixes: nextSixes,
  }
}

/** Send any lone opponent pawns at trackIndex back to their yards. */
function captureOpponentsAt(pawns: Pawn[], player: PlayerIndex, trackIndex: number): void {
  for (const p of pawns) {
    if (p.player !== player && p.pos.zone === 'track' && (p.pos as TrackPos).index === trackIndex) {
      // Only capture if no own pawn already there creates a "block" — v1 skips block rule
      p.pos = { zone: 'yard' }
    }
  }
}

function nextActivePlayer(playerCount: number, current: PlayerIndex): PlayerIndex {
  return ((current + 1) % playerCount) as PlayerIndex
}

// ---------- Winner ----------

/**
 * Returns the index of the winning player (0–3) if all 4 of their pawns are
 * finished, otherwise null.
 */
export function winner(state: GameState): PlayerIndex | null {
  for (let p = 0; p < state.playerCount; p++) {
    const pawns = playerPawns(state, p as PlayerIndex)
    if (pawns.length === 4 && pawns.every((pawn) => pawn.pos.zone === 'finished')) {
      return p as PlayerIndex
    }
  }
  return null
}

// ---------- Initial state ----------

export function initialState(playerCount: number): GameState {
  const pawns: Pawn[] = []
  for (let player = 0; player < playerCount; player++) {
    for (let slot = 0; slot < 4; slot++) {
      pawns.push({
        player: player as PlayerIndex,
        slot,
        pos: { zone: 'yard' },
      })
    }
  }
  return {
    pawns,
    turn: 0,
    dice: null,
    consecutiveSixes: 0,
    playerCount,
  }
}

// ---------- Skip-turn helper ----------

/**
 * Advance to next player when the current player has no legal moves
 * (no pawns to release and no pawns on board, or no useful dice value).
 */
export function skipTurn(state: GameState): GameState {
  const nextTurn = nextActivePlayer(state.playerCount, state.turn)
  return {
    ...state,
    turn: nextTurn,
    dice: null,
    consecutiveSixes: 0,
  }
}

// ---------- Capture check helper (for render) ----------

/**
 * Given a player and a track index, returns true if landing there would capture
 * at least one opponent pawn. Used by the renderer to highlight captures.
 */
export function wouldCapture(state: GameState, player: PlayerIndex, trackIndex: number): boolean {
  return opponentsAt(state, player, trackIndex).length > 0
}

/**
 * Returns the track index a pawn would land on after rolling dice,
 * or null if the move doesn't stay on the track (e.g. enters home column).
 */
export function landingTrackIndex(
  player: PlayerIndex,
  currentTrackIndex: number,
  dice: number,
): number | null {
  const stepsToEntry = stepsToHomeEntry(player, currentTrackIndex)
  if (dice < stepsToEntry) {
    return (currentTrackIndex + dice) % 52
  }
  return null
}

// Re-export helper for render layer
export { ownCountAt, playerPawns, stepsToHomeEntry }
