/**
 * International Draughts — pure rules engine.
 *
 * Board representation
 * --------------------
 * 10×10 board. Only dark squares are used — 50 in total. We represent the
 * board as a flat array of 50 entries indexed 0–49 in reading order (top-left
 * dark square first, row by row). Light squares are never stored.
 *
 * Player orientation
 * ------------------
 * Player 0 (light) starts at the bottom (indices 30–49) and moves upward
 * (toward index 0). Player 1 (dark) starts at the top (indices 0–19) and
 * moves downward (toward index 49).
 *
 * Dark-square coordinate mapping
 * --------------------------------
 * Row r (0–9), column c (0–9). A square is dark when (r + c) is odd.
 * Dark squares per row: columns 1,3,5,7,9 for even rows; 0,2,4,6,8 for odd rows.
 * Flat index = r * 5 + col_rank_in_row where col_rank_in_row is 0–4.
 */

// ---------- Types ----------

export type Piece = 'light-man' | 'light-king' | 'dark-man' | 'dark-king' | null

/** Immutable board: 50 dark-square slots. */
export type Board = readonly Piece[]

export type Player = 0 | 1

/** A move is either a quiet diagonal step or a capture sequence. */
export interface Move {
  /** Index of the piece being moved (0–49). */
  from: number
  /**
   * Sequence of squares visited after the starting square.
   * For a quiet step: one element. For captures: one entry per jump.
   */
  path: readonly number[]
  /** Squares of captured pieces (one per jump in a capture sequence). */
  captured: readonly number[]
}

export interface GameState {
  board: Board
  turn: Player
  /** Set during a forced multi-jump: the square the mid-jump piece is on. */
  midJump: number | null
}

// ---------- Coordinate helpers ----------

/**
 * Convert a flat dark-square index (0–49) to board row/col (0–9).
 */
export function idxToRowCol(idx: number): [number, number] {
  const row = Math.floor(idx / 5)
  const rank = idx % 5
  // Even rows: dark squares at cols 1,3,5,7,9 → col = rank*2+1
  // Odd rows:  dark squares at cols 0,2,4,6,8 → col = rank*2
  const col = row % 2 === 0 ? rank * 2 + 1 : rank * 2
  return [row, col]
}

/**
 * Convert row/col to flat dark-square index, or -1 if out of bounds / light square.
 */
export function rowColToIdx(row: number, col: number): number {
  if (row < 0 || row > 9 || col < 0 || col > 9) return -1
  // Parity check: dark squares have (row+col) odd
  if ((row + col) % 2 === 0) return -1
  const rank = row % 2 === 0 ? (col - 1) / 2 : col / 2
  return row * 5 + rank
}

/** The four diagonal directions as [dRow, dCol]. */
const DIRS: readonly [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
]

// ---------- Piece helpers ----------

function owner(piece: Piece): Player | null {
  if (piece === 'light-man' || piece === 'light-king') return 0
  if (piece === 'dark-man' || piece === 'dark-king') return 1
  return null
}

function isMan(piece: Piece): boolean {
  return piece === 'light-man' || piece === 'dark-man'
}

function promote(piece: Piece): Piece {
  if (piece === 'light-man') return 'light-king'
  if (piece === 'dark-man') return 'dark-king'
  return piece
}

// ---------- Move generation ----------

/**
 * Returns forward row directions for a man of the given player.
 * International draughts: men move forward only for quiet moves, but
 * can capture in all directions.
 */
function forwardDirs(player: Player): readonly [number, number][] {
  // Player 0 (light) moves up (decreasing row), player 1 (dark) moves down.
  return player === 0 ? DIRS.filter(([dr]) => dr < 0) : DIRS.filter(([dr]) => dr > 0)
}

/**
 * Generate all quiet (non-capture) moves for a single piece at `idx`.
 */
function quietMovesForPiece(board: Board, idx: number): Move[] {
  const piece = board[idx]
  if (piece === null) return []
  const player = owner(piece)
  if (player === null) return []

  const [row, col] = idxToRowCol(idx)
  const moves: Move[] = []

  if (isMan(piece)) {
    for (const [dr, dc] of forwardDirs(player)) {
      const dest = rowColToIdx(row + dr, col + dc)
      if (dest !== -1 && board[dest] === null) {
        moves.push({ from: idx, path: [dest], captured: [] })
      }
    }
  } else {
    // Flying king: slide any number of squares in each diagonal direction
    for (const [dr, dc] of DIRS) {
      let r = row + dr
      let c = col + dc
      while (true) {
        const dest = rowColToIdx(r, c)
        if (dest === -1 || board[dest] !== null) break
        moves.push({ from: idx, path: [dest], captured: [] })
        r += dr
        c += dc
      }
    }
  }

  return moves
}

/**
 * Recursively enumerate all capture sequences starting from `idx`.
 * `visited` tracks squares of already-captured pieces in this sequence to
 * prevent capturing the same piece twice.
 */
function captureSequences(
  board: Board,
  idx: number,
  piece: Piece,
  player: Player,
  pathSoFar: number[],
  capturedSoFar: number[],
): Move[] {
  const [row, col] = idxToRowCol(idx)
  const results: Move[] = []
  let foundFurther = false

  for (const [dr, dc] of DIRS) {
    if (isMan(piece)) {
      // Man: jump exactly one square over enemy, land one square beyond
      const adjIdx = rowColToIdx(row + dr, col + dc)
      if (adjIdx === -1) continue
      const adjPiece = board[adjIdx]
      if (adjPiece === null || owner(adjPiece) === player) continue
      if (capturedSoFar.includes(adjIdx)) continue // already jumped this piece

      const landIdx = rowColToIdx(row + 2 * dr, col + 2 * dc)
      if (landIdx === -1) continue
      // Landing square must be empty, unless it's our own starting square
      // (allowed in some circular sequences — safe to allow)
      if (board[landIdx] !== null && landIdx !== pathSoFar[0]) continue

      // Tentatively capture: recurse with adjPiece removed and piece at landIdx
      const newBoard = board.slice() as Piece[]
      newBoard[idx] = null
      newBoard[adjIdx] = null
      newBoard[landIdx] = piece

      const furtherMoves = captureSequences(
        newBoard,
        landIdx,
        piece,
        player,
        [...pathSoFar, landIdx],
        [...capturedSoFar, adjIdx],
      )

      if (furtherMoves.length > 0) {
        foundFurther = true
        results.push(...furtherMoves)
      } else {
        // This is a terminal landing — but we continue the loop to find all
        // terminal landings. We'll collect this landing below.
        foundFurther = false // might be overwritten by a later direction
        // Store as a complete move (we'll add it after the loop if not overridden)
      }

      if (furtherMoves.length === 0) {
        // Terminal: record this landing
        results.push({
          from: pathSoFar.length === 0 ? idx : /* origin */ -1, // replaced below
          path: [...pathSoFar, landIdx],
          captured: [...capturedSoFar, adjIdx],
        })
      }
    } else {
      // Flying king: slide over enemy, land anywhere beyond
      let r = row + dr
      let c = col + dc
      let enemyIdx = -1

      while (true) {
        const curIdx = rowColToIdx(r, c)
        if (curIdx === -1) break
        const curPiece = board[curIdx]

        if (curPiece !== null) {
          if (owner(curPiece) === player) break // own piece blocks
          if (capturedSoFar.includes(curIdx)) break // already captured in this sequence
          if (enemyIdx !== -1) break // second enemy blocks further sliding
          enemyIdx = curIdx
          r += dr
          c += dc
          continue
        }

        if (enemyIdx !== -1) {
          // Can land here (empty square beyond captured piece)
          const landIdx = rowColToIdx(r, c)
          if (landIdx === -1) break

          const newBoard = board.slice() as Piece[]
          newBoard[idx] = null
          newBoard[enemyIdx] = null
          newBoard[landIdx] = piece

          const furtherMoves = captureSequences(
            newBoard,
            landIdx,
            piece,
            player,
            [...pathSoFar, landIdx],
            [...capturedSoFar, enemyIdx],
          )

          if (furtherMoves.length > 0) {
            foundFurther = true
            results.push(...furtherMoves)
          } else {
            results.push({
              from: -1,
              path: [...pathSoFar, landIdx],
              captured: [...capturedSoFar, enemyIdx],
            })
          }
        }

        r += dr
        c += dc
      }
    }
  }

  void foundFurther // used implicitly by whether results collected
  return results
}

/**
 * All capture moves available for piece at `idx`.
 * Returns Move[] with correct `from` field.
 */
function captureMovesForPiece(board: Board, idx: number): Move[] {
  const piece = board[idx]
  if (piece === null) return []
  const player = owner(piece)
  if (player === null) return []

  const raw = captureSequences(board, idx, piece, player, [], [])
  return raw.map((m) => ({ ...m, from: idx }))
}

/**
 * All legal moves for `player` from `state`.
 * Enforces mandatory capture: if any capture is available, only captures returned.
 * Maximum-capture rule: only the sequences with the most captures returned.
 *
 * If `state.midJump` is set, only further captures from that square are returned.
 */
export function legalMoves(state: GameState): Move[] {
  const { board, turn, midJump } = state

  if (midJump !== null) {
    // Mid-jump: only further captures from this square
    const moves = captureMovesForPiece(board, midJump)
    return moves.map((m) => ({ ...m, from: midJump }))
  }

  // Collect all pieces belonging to current player
  const myIndices: number[] = []
  for (let i = 0; i < 50; i++) {
    if (owner(board[i]) === turn) myIndices.push(i)
  }

  // Try captures first
  const allCaptures: Move[] = []
  for (const idx of myIndices) {
    allCaptures.push(...captureMovesForPiece(board, idx))
  }

  if (allCaptures.length > 0) {
    // Enforce maximum-capture rule
    const maxLen = Math.max(...allCaptures.map((m) => m.captured.length))
    return allCaptures.filter((m) => m.captured.length === maxLen)
  }

  // No captures: quiet moves
  const quiets: Move[] = []
  for (const idx of myIndices) {
    quiets.push(...quietMovesForPiece(board, idx))
  }
  return quiets
}

// ---------- Apply move ----------

/**
 * Apply a single-step move (first jump in a capture sequence, or a quiet move).
 * Returns the new state. If this is an intermediate jump in a multi-jump,
 * `midJump` is set on the returned state.
 *
 * `move` here is always a single step (path.length === 1 per call for captures
 * during multi-jump UI flow; for quiet moves path.length === 1 always).
 *
 * For the full game loop we apply one jump at a time.
 */
export function applyMove(state: GameState, move: Move): GameState {
  const newBoard = state.board.slice() as Piece[]
  const piece = newBoard[move.from]

  // Remove piece from source
  newBoard[move.from] = null

  // Remove all captured pieces
  for (const cap of move.captured) {
    newBoard[cap] = null
  }

  // Place piece at destination (last element of path)
  const dest = move.path[move.path.length - 1]
  const destRow = idxToRowCol(dest)[0]

  // Promotion: man reaching back rank at end of *complete* turn
  // (midJump = null means it's the end of turn OR a quiet move)
  // For multi-jump: we only promote if ending there, not mid-sequence.
  // Since we pass the full move (all captures at once), dest is the final square.
  const promoted =
    isMan(piece) && ((owner(piece) === 0 && destRow === 0) || (owner(piece) === 1 && destRow === 9))

  newBoard[dest] = promoted ? promote(piece) : piece

  return {
    board: newBoard,
    turn: state.turn === 0 ? 1 : 0,
    midJump: null,
  }
}

// ---------- Winner ----------

/**
 * Returns the winning player index if the current player has no legal moves,
 * otherwise null.
 */
export function winner(state: GameState): Player | null {
  if (legalMoves(state).length === 0) {
    // Current player cannot move: opponent wins
    return state.turn === 0 ? 1 : 0
  }
  return null
}

// ---------- Initial state ----------

export function initialBoard(): Board {
  const board: Piece[] = Array(50).fill(null)
  // Player 1 (dark) occupies indices 0–19 (top 4 rows)
  for (let i = 0; i < 20; i++) board[i] = 'dark-man'
  // Player 0 (light) occupies indices 30–49 (bottom 4 rows)
  for (let i = 30; i < 50; i++) board[i] = 'light-man'
  return board
}

export function initialState(): GameState {
  return {
    board: initialBoard(),
    turn: 0, // Light (player 0) moves first
    midJump: null,
  }
}
