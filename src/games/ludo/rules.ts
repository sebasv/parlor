/**
 * Ludo — pure rules engine.
 *
 * Board representation
 * --------------------
 * The main track length and player entry points depend on the player count:
 *
 *   2 players: 52-square track, visual quadrant slots [0, 2] (opposite corners)
 *              entries at 0 and 26 → 26 squares apart (symmetric)
 *
 *   3 players: 39-square track, visual quadrant slots [0, 1, 2]
 *              entries at 0, 13, 26 → 13 squares apart (symmetric)
 *
 *   4 players: 52-square track, visual quadrant slots [0, 1, 2, 3]
 *              entries at 0, 13, 26, 39 → 13 squares apart (symmetric)
 *
 * The `QUAD_SLOTS` array maps logical player index (0..playerCount-1) to a
 * visual quadrant slot (0..3 for 4-quadrant boards, 0..2 for 3-leg boards).
 * The visual slot determines which home column, yard, and start square a
 * player actually uses.
 *
 * A pawn's position is one of:
 *   { zone: 'yard' }                       — not yet on the board
 *   { zone: 'track', index: 0..trackLen-1 }— on the shared main track
 *   { zone: 'home', index: 0..5 }          — on the player's 6-square home column
 *                                             (index 5 = finished square)
 *   { zone: 'finished' }                   — in the home target (all 4 = win)
 *
 * Entering the board
 * ------------------
 * A player may release a pawn from the yard onto their start square only when
 * rolling a 6. Opponent pawns on the start square are captured.
 *
 * Moving on the track
 * -------------------
 * A pawn at track index t moves to (t + dice) % trackLen.
 * The home column entry point for player p is one step before completing the loop:
 *   HOME_ENTRY[p] = (STARTS[p] + trackLen - 1) % trackLen
 * When the pawn reaches or passes HOME_ENTRY[p], it enters the home column.
 * Overshoot (home index > 5) is illegal.
 *
 * Capture
 * -------
 * Landing on a square occupied by at least one opponent pawn sends them all
 * back to their yard. (No safe squares in v1; no blocking rule.)
 *
 * Extra turn on 6
 * ---------------
 * Rolling a 6 grants an extra roll. Three consecutive 6s forfeit the turn.
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
  index: number // 0..(trackLen-1)
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
  /**
   * Total number of squares on the main outer track.
   * 52 for 2- and 4-player games (standard board).
   * 39 for 3-player games (triangular board with 3×13 squares).
   */
  trackLength: number
  /**
   * Maps logical player index (0..playerCount-1) to a visual quadrant slot
   * (0..3 for 4-quad boards, 0..2 for 3-leg boards). The slot determines
   * which start square, home column, and yard the player uses.
   *
   * 2 players: [0, 2]       — opposite corners, entries 26 apart
   * 3 players: [0, 1, 2]    — all three legs, entries 13 apart on 39-sq track
   * 4 players: [0, 1, 2, 3] — all four corners, entries 13 apart on 52-sq track
   */
  quadrantSlots: readonly number[]
  /**
   * Main-track index where each logical player's pawn enters the board.
   * Derived from quadrantSlots and trackLength; stored for convenience.
   * Length === playerCount.
   */
  starts: readonly number[]
  /**
   * The last main-track square before each logical player enters their home column.
   * home_entries[p] = (starts[p] + trackLength - 1) % trackLength
   */
  homeEntries: readonly number[]
}

export interface Move {
  pawnSlot: number // which of current player's pawns (0–3) to move
  kind: 'release' | 'advance' // 'release' = from yard to start square
}

// ---------- Constants ----------

/**
 * Per-slot start positions on the 52-square (4-player) board.
 * Slot 0 → index 0, slot 1 → index 13, slot 2 → index 26, slot 3 → index 39.
 */
const SLOT_STARTS_52: readonly number[] = [0, 13, 26, 39]

/**
 * Per-slot start positions on the 39-square (3-player) board.
 * Slot 0 → index 0, slot 1 → index 13, slot 2 → index 26.
 */
const SLOT_STARTS_39: readonly number[] = [0, 13, 26]

/**
 * Legacy constants kept for backward-compatibility with the render layer.
 * Render layer should prefer GameState.starts / GameState.homeEntries.
 */
export const STARTS: readonly number[] = SLOT_STARTS_52
export const HOME_ENTRIES: readonly number[] = [51, 12, 25, 38]

// ---------- Geometry builders ----------

function buildGeometry(
  quadrantSlots: readonly number[],
  trackLength: number,
  slotStarts: readonly number[],
): { starts: readonly number[]; homeEntries: readonly number[] } {
  const starts = quadrantSlots.map((slot) => slotStarts[slot])
  const homeEntries = starts.map((s) => (s + trackLength - 1) % trackLength)
  return { starts, homeEntries }
}

// ---------- Helpers ----------

/** Steps remaining on the main track before this pawn enters its home column. */
export function stepsToHomeEntry(
  player: PlayerIndex,
  trackIndex: number,
  state: GameState,
): number {
  const entry = state.homeEntries[player]
  const trackLen = state.trackLength
  if (trackIndex <= entry) {
    return entry - trackIndex + 1
  }
  // Wrapped around: from trackIndex, go to trackLen-1, then wrap to 0..entry
  return trackLen - trackIndex + entry + 1
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
    const stepsToEntry = stepsToHomeEntry(player, pos.index, state)

    if (dice < stepsToEntry) {
      // Stays on the track
      moves.push({ pawnSlot: pawn.slot, kind: 'advance' })
    } else if (dice === stepsToEntry) {
      // Enters home column at index 0
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
 *  - Captures when landing on an opponent pawn
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
    const startTrack = state.starts[player]
    // Capture any opponent on start square
    captureOpponentsAt(newPawns, player, startTrack)
    pawn.pos = { zone: 'track', index: startTrack }
  } else {
    // Advance
    const pos = pawn.pos

    if (pos.zone === 'home') {
      const newHomeIdx = pos.index + dice
      if (newHomeIdx >= 5) {
        pawn.pos = { zone: 'finished' }
      } else {
        pawn.pos = { zone: 'home', index: newHomeIdx }
      }
    } else if (pos.zone === 'track') {
      const stepsToEntry = stepsToHomeEntry(player, pos.index, state)

      if (dice < stepsToEntry) {
        const newTrack = (pos.index + dice) % state.trackLength
        // Capture opponents
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

/** Send any opponent pawns at trackIndex back to their yards. */
function captureOpponentsAt(pawns: Pawn[], player: PlayerIndex, trackIndex: number): void {
  for (const p of pawns) {
    if (p.player !== player && p.pos.zone === 'track' && (p.pos as TrackPos).index === trackIndex) {
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

export function initialState(playerCount: 2 | 3 | 4): GameState {
  let quadrantSlots: readonly number[]
  let trackLength: number
  let slotStarts: readonly number[]

  if (playerCount === 2) {
    // Opposite corners on the standard 52-square board: entries 26 apart.
    quadrantSlots = [0, 2]
    trackLength = 52
    slotStarts = SLOT_STARTS_52
  } else if (playerCount === 3) {
    // Three equally spaced legs on the 39-square triangular board: entries 13 apart.
    quadrantSlots = [0, 1, 2]
    trackLength = 39
    slotStarts = SLOT_STARTS_39
  } else {
    // Standard 4-player board: all four corners, entries 13 apart.
    quadrantSlots = [0, 1, 2, 3]
    trackLength = 52
    slotStarts = SLOT_STARTS_52
  }

  const { starts, homeEntries } = buildGeometry(quadrantSlots, trackLength, slotStarts)

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
    trackLength,
    quadrantSlots,
    starts,
    homeEntries,
  }
}

// ---------- Skip-turn helper ----------

/**
 * Advance to next player when the current player has no legal moves.
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
 * at least one opponent pawn.
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
  state: GameState,
): number | null {
  const stepsToEntry = stepsToHomeEntry(player, currentTrackIndex, state)
  if (dice < stepsToEntry) {
    return (currentTrackIndex + dice) % state.trackLength
  }
  return null
}

// Re-export helpers for render layer
export { ownCountAt, playerPawns }
