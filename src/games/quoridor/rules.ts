// ---------------------------------------------------------------------------
// Quoridor — pure game logic (no DOM, no side effects)
// ---------------------------------------------------------------------------

export const BOARD_SIZE = 9 // 9×9 cells
export const WALL_GRID = 8 // 8×8 wall segment grids
export const INITIAL_WALLS = 10

// Player 0: starts bottom-center (row 8, col 4), goal = row 0
// Player 1: starts top-center (row 0, col 4), goal = row 8
export const STARTS: [Pos, Pos] = [
  { r: 8, c: 4 },
  { r: 0, c: 4 },
]
export const GOALS: [number, number] = [0, 8] // goal row for each player

export interface Pos {
  r: number
  c: number
}

/**
 * Wall placement anchor.
 * orientation 'h': horizontal wall at row-gap r, starting at column c.
 *   Occupies hWalls[r][c] and hWalls[r][c+1].
 *   Blocks movement between row r and row r+1, at columns c and c+1.
 * orientation 'v': vertical wall at column-gap c, starting at row r.
 *   Occupies vWalls[r][c] and vWalls[r+1][c].
 *   Blocks movement between column c and c+1, at rows r and r+1.
 */
export interface Wall {
  orientation: 'h' | 'v'
  r: number // anchor row  ∈ [0, 7]
  c: number // anchor col  ∈ [0, 7]
}

export type MoveAction = { kind: 'move'; pos: Pos }
export type WallAction = { kind: 'wall'; wall: Wall }
export type Action = MoveAction | WallAction

export interface GameState {
  /** hWalls[r][c]: true = segment at row-gap r, column c is occupied */
  hWalls: boolean[][]
  /** vWalls[r][c]: true = segment at row r, column-gap c is occupied */
  vWalls: boolean[][]
  pawns: [Pos, Pos]
  wallsLeft: [number, number]
  currentPlayer: 0 | 1
  phase: 'playing' | 'done'
  winnerIndex: number | null
}

// ---------------------------------------------------------------------------
// State factory
// ---------------------------------------------------------------------------

export function makeState(): GameState {
  return {
    hWalls: Array.from({ length: WALL_GRID }, () => Array(WALL_GRID).fill(false)),
    vWalls: Array.from({ length: WALL_GRID }, () => Array(WALL_GRID).fill(false)),
    pawns: [{ ...STARTS[0] }, { ...STARTS[1] }],
    wallsLeft: [INITIAL_WALLS, INITIAL_WALLS],
    currentPlayer: 0,
    phase: 'playing',
    winnerIndex: null,
  }
}

// ---------------------------------------------------------------------------
// Wall-block helpers
// ---------------------------------------------------------------------------

/** Is movement from (r,c) going south (to r+1,c) blocked by a wall? */
export function blockedSouth(state: GameState, r: number, c: number): boolean {
  if (r >= WALL_GRID) return false // already at last row-gap
  return state.hWalls[r][c]
}

/** Is movement from (r,c) going north (to r-1,c) blocked by a wall? */
export function blockedNorth(state: GameState, r: number, c: number): boolean {
  if (r === 0) return false
  return state.hWalls[r - 1][c]
}

/** Is movement from (r,c) going east (to r,c+1) blocked by a wall? */
export function blockedEast(state: GameState, r: number, c: number): boolean {
  if (c >= WALL_GRID) return false
  return state.vWalls[r][c]
}

/** Is movement from (r,c) going west (to r,c-1) blocked by a wall? */
export function blockedWest(state: GameState, r: number, c: number): boolean {
  if (c === 0) return false
  return state.vWalls[r][c - 1]
}

// ---------------------------------------------------------------------------
// BFS path check — both players must always have a path to their goal
// ---------------------------------------------------------------------------

function hasPath(state: GameState, start: Pos, goalRow: number): boolean {
  const visited = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(false))
  const queue: Pos[] = [start]
  visited[start.r][start.c] = true

  while (queue.length > 0) {
    const cur = queue.shift()
    if (!cur) break
    if (cur.r === goalRow) return true

    // North
    if (cur.r > 0 && !blockedNorth(state, cur.r, cur.c) && !visited[cur.r - 1][cur.c]) {
      visited[cur.r - 1][cur.c] = true
      queue.push({ r: cur.r - 1, c: cur.c })
    }
    // South
    if (
      cur.r < BOARD_SIZE - 1 &&
      !blockedSouth(state, cur.r, cur.c) &&
      !visited[cur.r + 1][cur.c]
    ) {
      visited[cur.r + 1][cur.c] = true
      queue.push({ r: cur.r + 1, c: cur.c })
    }
    // West
    if (cur.c > 0 && !blockedWest(state, cur.r, cur.c) && !visited[cur.r][cur.c - 1]) {
      visited[cur.r][cur.c - 1] = true
      queue.push({ r: cur.r, c: cur.c - 1 })
    }
    // East
    if (cur.c < BOARD_SIZE - 1 && !blockedEast(state, cur.r, cur.c) && !visited[cur.r][cur.c + 1]) {
      visited[cur.r][cur.c + 1] = true
      queue.push({ r: cur.r, c: cur.c + 1 })
    }
  }

  return false
}

/** Returns true if both pawns still have a path to their goal in this state. */
function bothHavePath(state: GameState): boolean {
  return hasPath(state, state.pawns[0], GOALS[0]) && hasPath(state, state.pawns[1], GOALS[1])
}

// ---------------------------------------------------------------------------
// Wall placement legality
// ---------------------------------------------------------------------------

/**
 * Returns true if the wall can legally be placed (no overlap, no crossing,
 * both players retain a path).
 * Does NOT mutate state.
 */
export function canPlaceWall(state: GameState, wall: Wall): boolean {
  const { orientation, r, c } = wall

  if (r < 0 || r > WALL_GRID - 1 || c < 0 || c > WALL_GRID - 1) return false
  if (state.wallsLeft[state.currentPlayer] === 0) return false

  if (orientation === 'h') {
    // Occupies hWalls[r][c] and hWalls[r][c+1]
    if (c > WALL_GRID - 2) return false // second segment out of bounds
    if (state.hWalls[r][c] || state.hWalls[r][c + 1]) return false
    // Cross-check: a vertical wall at (r, c) would occupy vWalls[r][c] and vWalls[r+1][c].
    // A horizontal wall at anchor (r, c) shares center point (r+1, c+1) with vertical wall at (r, c).
    // Crossing occurs when vWalls[r][c] AND vWalls[r+1][c] are both set (a full vertical wall at col-gap c).
    if (state.vWalls[r][c] && state.vWalls[r + 1][c]) return false
  } else {
    // Occupies vWalls[r][c] and vWalls[r+1][c]
    if (r > WALL_GRID - 2) return false // second segment out of bounds
    if (state.vWalls[r][c] || state.vWalls[r + 1][c]) return false
    // Cross-check: horizontal wall at (r, c) would occupy hWalls[r][c] and hWalls[r][c+1].
    if (state.hWalls[r][c] && state.hWalls[r][c + 1]) return false
  }

  // Path check: temporarily mutate, check, revert
  if (orientation === 'h') {
    state.hWalls[r][c] = true
    state.hWalls[r][c + 1] = true
  } else {
    state.vWalls[r][c] = true
    state.vWalls[r + 1][c] = true
  }

  const ok = bothHavePath(state)

  if (orientation === 'h') {
    state.hWalls[r][c] = false
    state.hWalls[r][c + 1] = false
  } else {
    state.vWalls[r][c] = false
    state.vWalls[r + 1][c] = false
  }

  return ok
}

// ---------------------------------------------------------------------------
// Pawn move legality
// ---------------------------------------------------------------------------

/** All legal pawn destinations for the current player. */
export function legalMoves(state: GameState): Pos[] {
  const me = state.currentPlayer
  const myPos = state.pawns[me]
  const oppPos = state.pawns[1 - me]
  const destinations: Pos[] = []

  const dirs: Array<{ dr: number; dc: number }> = [
    { dr: -1, dc: 0 }, // north
    { dr: 1, dc: 0 }, // south
    { dr: 0, dc: -1 }, // west
    { dr: 0, dc: 1 }, // east
  ]

  for (const { dr, dc } of dirs) {
    const nr = myPos.r + dr
    const nc = myPos.c + dc
    if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue

    // Check wall blocking from myPos toward (nr, nc)
    if (!canStepTo(state, myPos.r, myPos.c, dr, dc)) continue

    if (nr === oppPos.r && nc === oppPos.c) {
      // Adjacent to opponent — try jump
      addJumpMoves(state, myPos, oppPos, dr, dc, destinations)
    } else {
      destinations.push({ r: nr, c: nc })
    }
  }

  return destinations
}

/**
 * Returns true if moving one step in direction (dr, dc) from (r, c) is not
 * blocked by a wall.
 */
function canStepTo(state: GameState, r: number, c: number, dr: number, dc: number): boolean {
  if (dr === -1) return !blockedNorth(state, r, c)
  if (dr === 1) return !blockedSouth(state, r, c)
  if (dc === -1) return !blockedWest(state, r, c)
  if (dc === 1) return !blockedEast(state, r, c)
  return false
}

/**
 * Computes jump destinations when myPos is adjacent to oppPos in direction (dr, dc).
 * Straight jump: jump to the cell beyond oppPos if the path is clear and the cell is empty.
 * Side-step (diagonal) jump: if straight jump is blocked by a wall or board edge,
 * allow stepping to perpendicular adjacent squares of oppPos.
 *
 * NOTE: Side-step (diagonal jump) IS implemented for the primary perpendicular directions.
 * See quoridor-design.md for full details.
 */
function addJumpMoves(
  state: GameState,
  myPos: Pos,
  oppPos: Pos,
  dr: number,
  dc: number,
  destinations: Pos[],
): void {
  const beyondR = oppPos.r + dr
  const beyondC = oppPos.c + dc
  const beyondInBounds =
    beyondR >= 0 && beyondR < BOARD_SIZE && beyondC >= 0 && beyondC < BOARD_SIZE

  const straightClear = beyondInBounds && canStepTo(state, oppPos.r, oppPos.c, dr, dc)

  if (straightClear) {
    destinations.push({ r: beyondR, c: beyondC })
  } else {
    // Side-step: try perpendicular directions from oppPos
    const perps =
      dr !== 0
        ? [
            { dr: 0, dc: -1 },
            { dr: 0, dc: 1 },
          ]
        : [
            { dr: -1, dc: 0 },
            { dr: 1, dc: 0 },
          ]

    for (const p of perps) {
      const pr = oppPos.r + p.dr
      const pc = oppPos.c + p.dc
      if (pr < 0 || pr >= BOARD_SIZE || pc < 0 || pc >= BOARD_SIZE) continue
      // Don't land on own pawn (shouldn't happen) or back on myself
      if (pr === myPos.r && pc === myPos.c) continue
      if (canStepTo(state, oppPos.r, oppPos.c, p.dr, p.dc)) {
        destinations.push({ r: pr, c: pc })
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Apply action
// ---------------------------------------------------------------------------

/** Returns a new state after applying the action. Pure — does not mutate the input state. */
export function applyAction(state: GameState, action: Action): GameState {
  // Deep clone
  const next: GameState = {
    hWalls: state.hWalls.map((row) => [...row]),
    vWalls: state.vWalls.map((row) => [...row]),
    pawns: [{ ...state.pawns[0] }, { ...state.pawns[1] }],
    wallsLeft: [...state.wallsLeft] as [number, number],
    currentPlayer: state.currentPlayer,
    phase: state.phase,
    winnerIndex: state.winnerIndex,
  }

  if (action.kind === 'move') {
    next.pawns[next.currentPlayer] = { ...action.pos }
  } else {
    const { orientation, r, c } = action.wall
    if (orientation === 'h') {
      next.hWalls[r][c] = true
      next.hWalls[r][c + 1] = true
    } else {
      next.vWalls[r][c] = true
      next.vWalls[r + 1][c] = true
    }
    next.wallsLeft[next.currentPlayer]--
  }

  // Check winner
  const w = winner(next)
  if (w !== null) {
    next.phase = 'done'
    next.winnerIndex = w
  } else {
    next.currentPlayer = next.currentPlayer === 0 ? 1 : 0
  }

  return next
}

// ---------------------------------------------------------------------------
// Winner
// ---------------------------------------------------------------------------

/** Returns the winning player index, or null if the game is still in progress. */
export function winner(state: GameState): number | null {
  if (state.pawns[0].r === GOALS[0]) return 0
  if (state.pawns[1].r === GOALS[1]) return 1
  return null
}
