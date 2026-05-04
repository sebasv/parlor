// ---------------------------------------------------------------------------
// Pure game rules — no DOM dependencies
// ---------------------------------------------------------------------------

import {
  exitPort,
  oppositePort,
  type Port,
  portDelta,
  randomTile,
  rotateTile,
  type Tile,
} from './tiles'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const BOARD_COLS = 6
export const BOARD_ROWS = 6

/** A position on the board grid. */
export interface GridPos {
  col: number
  row: number
}

/** A pawn's position: which tile slot it's on, and which port it's at. */
export interface PawnPos {
  col: number
  row: number
  port: Port
}

export type PawnStatus = 'active' | 'eliminated'

export interface Pawn {
  playerIndex: number
  pos: PawnPos
  status: PawnStatus
}

export interface GameState {
  // board[row][col] = placed Tile, or null if empty
  board: (Tile | null)[][]
  pawns: Pawn[]
  currentPlayerIndex: number
  // Candidate tile for the current player's turn (random, awaiting placement)
  candidateTile: Tile
  candidateRotation: number // 0, 1, 2, or 3 (quarter turns CW)
  phase: 'placing' | 'done'
  winners: number[] // player indices
}

// ---------------------------------------------------------------------------
// Starting positions
// ---------------------------------------------------------------------------
// Distribute pawns around the perimeter for 2–4 players.
// Each pawn starts at a port on the outer edge of the board.
//
// The perimeter ports are the outer-facing ports of the edge tile slots.
// We assign one "side" per player for up to 4 players. Starting port is the
// middle of that side (approximately), facing inward.
//
// For 2 players: top-centre and bottom-centre
// For 3 players: top, right, bottom
// For 4 players: top, right, bottom, left

function perimeterStart(playerIndex: number, playerCount: number): PawnPos {
  // For each side: pick the tile slot and which port faces outward (the pawn
  // starts on the outer port, facing into the board).
  // We place the pawn at a mid-edge tile. Port that faces outward is the one
  // the pawn starts at; after tile placement the pawn moves inward.

  // Side assignments by player count
  const sides: Array<'top' | 'right' | 'bottom' | 'left'> =
    playerCount === 2
      ? ['top', 'bottom']
      : playerCount === 3
        ? ['top', 'right', 'bottom']
        : ['top', 'right', 'bottom', 'left']

  const side = sides[playerIndex]

  // Place near the middle of each side
  const mid = Math.floor(BOARD_COLS / 2) - 1 // 2 for a 6-wide board

  switch (side) {
    case 'top':
      // Top-edge tile: slot (col=mid, row=0), pawn on port 0 (top-left of that tile)
      return { col: mid, row: 0, port: 0 }
    case 'right':
      // Right-edge tile: slot (col=BOARD_COLS-1, row=mid), pawn on port 2 (right-top of that tile)
      return { col: BOARD_COLS - 1, row: mid, port: 2 }
    case 'bottom':
      // Bottom-edge tile: slot (col=mid+1, row=BOARD_ROWS-1), pawn on port 4
      return { col: mid + 1, row: BOARD_ROWS - 1, port: 4 }
    case 'left':
      // Left-edge tile: slot (col=0, row=mid+1), pawn on port 6
      return { col: 0, row: mid + 1, port: 6 }
  }
}

// ---------------------------------------------------------------------------
// State creation
// ---------------------------------------------------------------------------

export function createGameState(playerCount: number): GameState {
  const board: (Tile | null)[][] = Array.from({ length: BOARD_ROWS }, () =>
    Array<Tile | null>(BOARD_COLS).fill(null),
  )

  const pawns: Pawn[] = Array.from({ length: playerCount }, (_, i) => ({
    playerIndex: i,
    pos: perimeterStart(i, playerCount),
    status: 'active' as PawnStatus,
  }))

  return {
    board,
    pawns,
    currentPlayerIndex: 0,
    candidateTile: randomTile(),
    candidateRotation: 0,
    phase: 'placing',
    winners: [],
  }
}

// ---------------------------------------------------------------------------
// Tile placement slot
// ---------------------------------------------------------------------------
// The active pawn must place the tile in the slot directly in front of it.
// "In front" means the adjacent slot in the direction the pawn's port faces.

export function placementSlot(pawn: Pawn): GridPos {
  const [dc, dr] = portDelta(pawn.pos.port)
  return {
    col: pawn.pos.col + dc,
    row: pawn.pos.row + dr,
  }
}

// Is a grid position within the board?
function inBounds(col: number, row: number): boolean {
  return col >= 0 && col < BOARD_COLS && row >= 0 && row < BOARD_ROWS
}

// ---------------------------------------------------------------------------
// Path following
// ---------------------------------------------------------------------------
// After a tile is placed, advance ALL active pawns that are connected to the
// newly placed tile (their placement slot is that tile, or they chain through).
// In practice Tsuro only moves the current player's pawn, but we check all
// for chain reactions (the current pawn might push others).

function advancePawn(pawn: Pawn, board: (Tile | null)[][]): PawnPos {
  let { col, row, port } = pawn.pos

  // Follow path through tiles until we either:
  // 1. Exit into an empty slot (pawn stops there)
  // 2. Exit off the board (pawn is eliminated — return out-of-bounds pos)
  // 3. Exit a tile on the edge that leads off-board

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const [dc, dr] = portDelta(port)
    const nextCol = col + dc
    const nextRow = row + dr

    // If the port leads off the board, the pawn falls off
    if (!inBounds(nextCol, nextRow)) {
      return { col: -1, row: -1, port: 0 } // sentinel for eliminated
    }

    const nextTile = board[nextRow][nextCol]
    if (nextTile === null) {
      // Pawn stops here — sits on the port facing into this empty slot
      // The pawn actually sits at the border between the current tile and the empty slot.
      // We model the pawn as being on its current tile's exit port.
      return { col, row, port }
    }

    // Enter the next tile via the opposite port
    const entryPort = oppositePort(port)
    const exitP = exitPort(nextTile, entryPort)

    // Pawn is now on the next tile, at the exit port
    col = nextCol
    row = nextRow
    port = exitP
  }
}

// Is the given pawn position off the board?
export function isEliminated(pos: PawnPos): boolean {
  return pos.col === -1
}

// ---------------------------------------------------------------------------
// Place tile and advance pawns
// ---------------------------------------------------------------------------

export function placeTile(state: GameState, slot: GridPos, tileWithRotation: Tile): GameState {
  const { col, row } = slot
  if (!inBounds(col, row)) return state
  if (state.board[row][col] !== null) return state // slot occupied

  // Place the tile on the board (deep clone board)
  const newBoard = state.board.map((r) => r.slice())
  newBoard[row][col] = tileWithRotation

  // Advance all active pawns (current player first, then others)
  const currentIdx = state.currentPlayerIndex
  const ordered = [
    currentIdx,
    ...state.pawns.map((p) => p.playerIndex).filter((i) => i !== currentIdx),
  ]

  const newPawns = state.pawns.map((p) => ({ ...p }))

  for (const idx of ordered) {
    const pawn = newPawns[idx]
    if (pawn.status !== 'active') continue

    // Only advance pawns that are touching the newly placed tile
    // (i.e. their current position faces into the newly placed slot)
    const [dc, dr] = portDelta(pawn.pos.port)
    const facingCol = pawn.pos.col + dc
    const facingRow = pawn.pos.row + dr

    if (facingCol === col && facingRow === row) {
      const newPos = advancePawn(pawn, newBoard)
      if (isEliminated(newPos)) {
        pawn.status = 'eliminated'
      } else {
        pawn.pos = newPos
      }
    }
  }

  // Check collisions: if two active pawns are on the same tile+port, both lose
  const posKeys = new Map<string, number[]>()
  for (const pawn of newPawns) {
    if (pawn.status !== 'active') continue
    const key = `${pawn.pos.col},${pawn.pos.row},${pawn.pos.port}`
    const existing = posKeys.get(key)
    if (existing) {
      existing.push(pawn.playerIndex)
    } else {
      posKeys.set(key, [pawn.playerIndex])
    }
  }
  for (const [, indices] of posKeys) {
    if (indices.length > 1) {
      for (const idx of indices) {
        newPawns[idx].status = 'eliminated'
      }
    }
  }

  // Determine if game is over
  const activePawns = newPawns.filter((p) => p.status === 'active')
  let phase: 'placing' | 'done' = state.phase
  let winners: number[] = state.winners

  if (activePawns.length <= 1) {
    phase = 'done'
    winners = activePawns.map((p) => p.playerIndex)
    if (winners.length === 0) {
      // Everyone lost simultaneously — all remaining get credit as 'winners' of sorts
      // Actually in canonical Tsuro this is a shared loss. We report no winner.
      winners = []
    }
  }

  // Advance to the next active player
  let nextPlayer = currentIdx
  if (phase === 'placing') {
    const total = state.pawns.length
    for (let i = 1; i <= total; i++) {
      const candidate = (currentIdx + i) % total
      if (newPawns[candidate].status === 'active') {
        nextPlayer = candidate
        break
      }
    }
  }

  // TODO: Replace with deck draw from the 35-tile canonical deck
  return {
    board: newBoard,
    pawns: newPawns,
    currentPlayerIndex: nextPlayer,
    candidateTile: phase === 'placing' ? randomTile() : state.candidateTile,
    candidateRotation: 0,
    phase,
    winners,
  }
}

// ---------------------------------------------------------------------------
// Rotation helper
// ---------------------------------------------------------------------------

export function rotateCandidateTile(state: GameState): GameState {
  return {
    ...state,
    candidateRotation: (state.candidateRotation + 1) % 4,
  }
}

export function getRotatedCandidate(state: GameState): Tile {
  return rotateTile(state.candidateTile, state.candidateRotation)
}
