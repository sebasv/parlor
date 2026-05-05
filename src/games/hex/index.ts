import type { GameModule } from '../../lib/game'
import meta from './meta'

// ---------------------------------------------------------------------------
// Board constants
// ---------------------------------------------------------------------------

// Standard Hex board size. Change this constant to switch board dimensions.
// 11×11 is the classic tournament size; 9×9 is friendlier for shorter games.
const BOARD_SIZE = 11

// Hex cell size in pixels (flat-to-flat width of each pointy-top hexagon).
// At 52px the 11×11 board fits comfortably on a tablet in landscape.
const HEX_SIZE = 52

// ---------------------------------------------------------------------------
// Coordinate system
// ---------------------------------------------------------------------------
// We use offset coordinates: col 0..N-1, row 0..N-1.
// Each hex at (col, row) is drawn shifted right by row * (HEX_SIZE / 2) so
// the board forms the characteristic rhombus shape.
//
// Player assignment (documented here, also in hex-design.md):
//   Player 0 (ctx.players[0]) owns TOP and BOTTOM edges (row 0 and row N-1).
//   Player 1 (ctx.players[1]) owns LEFT and RIGHT edges (col 0 and col N-1).
// Both players try to connect their two edges with an unbroken chain of their colour.

// ---------------------------------------------------------------------------
// Pure game logic — no DOM dependencies
// ---------------------------------------------------------------------------

// 0 = empty, 1 = player 0's piece, 2 = player 1's piece
type Cell = 0 | 1 | 2
type Board = Cell[][]

function createBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array<Cell>(BOARD_SIZE).fill(0))
}

/**
 * Return the 6 neighbours of (col, row) in offset coordinates.
 * Axial neighbours for a pointy-top hex grid in offset form:
 *   E, W, NE, SW, NW, SE
 */
function neighbours(col: number, row: number): [number, number][] {
  return [
    [col + 1, row],
    [col - 1, row],
    [col, row - 1],
    [col, row + 1],
    [col + 1, row - 1],
    [col - 1, row + 1],
  ]
}

/**
 * BFS flood fill from the starting edge for the given player.
 * Player 0 (piece value 1) — check top edge (row 0) → bottom edge (row N-1).
 * Player 1 (piece value 2) — check left edge (col 0) → right edge (col N-1).
 * Returns true if the player's chain spans their two edges.
 */
function hasWon(board: Board, player: 1 | 2): boolean {
  const n = BOARD_SIZE
  const visited: boolean[][] = Array.from({ length: n }, () => Array<boolean>(n).fill(false))
  const queue: [number, number][] = []

  if (player === 1) {
    // Player 0: start from all owned cells in row 0
    for (let col = 0; col < n; col++) {
      if (board[0][col] === 1) {
        visited[0][col] = true
        queue.push([col, 0])
      }
    }
  } else {
    // Player 1: start from all owned cells in col 0
    for (let row = 0; row < n; row++) {
      if (board[row][0] === 2) {
        visited[row][0] = true
        queue.push([0, row])
      }
    }
  }

  let head = 0
  while (head < queue.length) {
    const [col, row] = queue[head++]

    // Check if we've reached the opposite edge
    if (player === 1 && row === n - 1) return true
    if (player === 2 && col === n - 1) return true

    for (const [nc, nr] of neighbours(col, row)) {
      if (nc < 0 || nc >= n || nr < 0 || nr >= n) continue
      if (visited[nr][nc]) continue
      if (board[nr][nc] !== player) continue
      visited[nr][nc] = true
      queue.push([nc, nr])
    }
  }

  return false
}

/**
 * Pure function — returns the player index (0 or 1) who has won, or null.
 * Hex cannot end in a draw, so once the board is full someone has won.
 */
export function checkWinner(board: Board): 0 | 1 | null {
  if (hasWon(board, 1)) return 0
  if (hasWon(board, 2)) return 1
  return null
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  )
}

// ---------------------------------------------------------------------------
// SVG geometry — pointy-top hexagons
// ---------------------------------------------------------------------------

// For a pointy-top hex with circumradius R:
//   width  (flat-to-flat) = R * sqrt(3)
//   height (tip-to-tip)   = R * 2
// We define HEX_SIZE as flat-to-flat width, so R = HEX_SIZE / sqrt(3).
const R = HEX_SIZE / Math.sqrt(3)
const HEX_H = R * 2 // tip-to-tip height
const HEX_W = HEX_SIZE // flat-to-flat width (= sqrt(3) * R)

/** Six corner points of a pointy-top hexagon centred at (cx, cy). */
function hexPoints(cx: number, cy: number): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30) // pointy-top: first corner at -30°
    pts.push(`${(cx + R * Math.cos(angle)).toFixed(2)},${(cy + R * Math.sin(angle)).toFixed(2)}`)
  }
  return pts.join(' ')
}

/** Centre coordinates of hex at offset (col, row). */
function hexCenter(col: number, row: number): [number, number] {
  const cx = HEX_W * col + (HEX_W / 2) * row + HEX_W
  const cy = HEX_H * 0.75 * row + HEX_H / 2 + HEX_H * 0.5
  return [cx, cy]
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const CSS = `
.hex-root {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
  padding: 0.75rem 0.5rem;
}

.hex-status {
  font-size: 1.1rem;
  font-weight: 600;
  min-height: 1.6em;
  text-align: center;
  color: var(--fg);
}

.hex-status[data-winner="0"] { color: var(--hex-p0); }
.hex-status[data-winner="1"] { color: var(--hex-p1); }

.hex-svg-wrap {
  --hex-p0: #ef4444;
  --hex-p1: #6cb1ff;
  width: 100%;
  max-width: min(95vw, 90vh, 780px);
}

.hex-svg {
  display: block;
  width: 100%;
  height: auto;
  touch-action: manipulation;
}

/* Edge border strips — thick and saturated so they read from across the room */
.hex-edge-top    { fill: var(--hex-p0); opacity: 1; }
.hex-edge-bottom { fill: var(--hex-p0); opacity: 1; }
.hex-edge-left   { fill: var(--hex-p1); opacity: 1; }
.hex-edge-right  { fill: var(--hex-p1); opacity: 1; }

/* Player legend pills with active-player highlighting */
.hex-legend {
  display: flex;
  gap: 0.75rem;
  font-size: 0.9rem;
}

.hex-legend-item {
  display: flex;
  align-items: center;
  gap: 0.5em;
  padding: 0.35em 0.75em;
  border-radius: 999px;
  border: 2px solid transparent;
  background: var(--bg-elev, #1a1d24);
  opacity: 0.45;
  transition: opacity 0.15s, border-color 0.15s, background 0.15s;
}

.hex-legend-item[data-active='true'] {
  opacity: 1;
  border-color: currentColor;
}

.hex-legend-item[data-player='0'] { color: var(--hex-p0); }
.hex-legend-item[data-player='1'] { color: var(--hex-p1); }

.hex-legend-item[data-active='true'][data-player='0'] {
  background: color-mix(in srgb, var(--hex-p0) 15%, var(--bg-elev, #1a1d24));
}

.hex-legend-item[data-active='true'][data-player='1'] {
  background: color-mix(in srgb, var(--hex-p1) 15%, var(--bg-elev, #1a1d24));
}

@keyframes hex-pulse {
  0%, 100% { box-shadow: 0 0 0 0 currentColor; }
  50%       { box-shadow: 0 0 0 4px transparent; }
}

.hex-legend-item[data-active='true'] {
  animation: hex-pulse 1.5s ease-in-out infinite;
}

/* Hex cells */
.hex-cell {
  fill: #1e2330;
  stroke: #2e3650;
  stroke-width: 2;
  cursor: pointer;
  transition: fill 0.08s;
}

.hex-cell:hover { fill: #252c42; }

.hex-cell[data-player="1"] {
  fill: var(--hex-p0);
  cursor: default;
}

.hex-cell[data-player="2"] {
  fill: var(--hex-p1);
  cursor: default;
}

.hex-cell[data-player="1"]:hover { fill: var(--hex-p0); }
.hex-cell[data-player="2"]:hover { fill: var(--hex-p1); }

.hex-cell[data-winner="true"][data-player="1"] {
  fill: #ff8080;
  filter: drop-shadow(0 0 6px #ef4444);
}

.hex-cell[data-winner="true"][data-player="2"] {
  fill: #9ecfff;
  filter: drop-shadow(0 0 6px #6cb1ff);
}

.hex-gameover .hex-cell[data-player="0"] {
  cursor: default;
}

.hex-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}

.hex-btn {
  padding: 0.55em 1.2em;
  border-radius: 8px;
  border: 1px solid transparent;
  background: var(--bg-elev, #1a1d24);
  color: var(--fg, #e6e6e6);
  font: inherit;
  cursor: pointer;
  font-size: 0.95rem;
}
.hex-btn:hover { border-color: var(--accent, #6cb1ff); }
`

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

const game: GameModule = {
  ...meta,

  mount(root, ctx) {
    const styleEl = document.createElement('style')
    styleEl.textContent = CSS
    document.head.appendChild(styleEl)

    // State
    let board = createBoard()
    let currentPlayer: 0 | 1 = 0
    let gameOver = false

    // Build skeleton DOM
    const wrapper = document.createElement('div')
    wrapper.className = 'hex-root'

    const statusEl = document.createElement('div')
    statusEl.className = 'hex-status'

    // Player legend pills — highlight the active player
    const legendEl = document.createElement('div')
    legendEl.className = 'hex-legend'

    const legendItems: HTMLSpanElement[] = []
    for (const [i, label] of [
      [0, `${escapeHtml(ctx.players[0])} — top &amp; bottom`],
      [1, `${escapeHtml(ctx.players[1])} — left &amp; right`],
    ] as [number, string][]) {
      const item = document.createElement('span')
      item.className = 'hex-legend-item'
      item.setAttribute('data-player', String(i))
      item.innerHTML = label
      legendEl.appendChild(item)
      legendItems.push(item)
    }

    // SVG wrapper (allows horizontal scroll on small screens)
    const svgWrap = document.createElement('div')
    svgWrap.className = 'hex-svg-wrap'

    // Compute SVG dimensions
    const n = BOARD_SIZE
    // The rightmost cell centre + padding
    const [lastCx, lastCy] = hexCenter(n - 1, n - 1)
    const svgW = Math.ceil(lastCx + HEX_W + HEX_W * 0.5)
    const svgH = Math.ceil(lastCy + HEX_H * 0.5 + HEX_H * 0.25)

    const svgNS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(svgNS, 'svg')
    svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`)
    svg.setAttribute('aria-label', 'Hex board')
    svg.setAttribute('role', 'img')
    svg.setAttribute('class', 'hex-svg')

    // Draw edge highlight strips before cells so cells render on top.
    // We draw thin parallelograms along each border.
    const edgeGroup = document.createElementNS(svgNS, 'g')
    svg.appendChild(edgeGroup)

    function makeEdgeStrip(
      positions: [number, number][],
      direction: 'top' | 'bottom' | 'left' | 'right',
    ): void {
      // Wider strip so it reads clearly from a distance
      const edgeR = R * 0.65
      for (const [col, row] of positions) {
        const [cx, cy] = hexCenter(col, row)
        // Draw a narrow parallelogram cap on the relevant face of the hex.
        let pts = ''
        if (direction === 'top') {
          // Upper two vertices of the pointy-top hex + extended outward
          const a = {
            x: cx + edgeR * Math.cos((Math.PI / 180) * -30),
            y: cy + edgeR * Math.sin((Math.PI / 180) * -30),
          }
          const b = {
            x: cx + edgeR * Math.cos((Math.PI / 180) * -90),
            y: cy + edgeR * Math.sin((Math.PI / 180) * -90),
          }
          const offY = -edgeR * 0.7
          pts = `${a.x.toFixed(1)},${a.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)} ${b.x.toFixed(1)},${(b.y + offY).toFixed(1)} ${a.x.toFixed(1)},${(a.y + offY).toFixed(1)}`
        } else if (direction === 'bottom') {
          const a = {
            x: cx + edgeR * Math.cos((Math.PI / 180) * 90),
            y: cy + edgeR * Math.sin((Math.PI / 180) * 90),
          }
          const b = {
            x: cx + edgeR * Math.cos((Math.PI / 180) * 150),
            y: cy + edgeR * Math.sin((Math.PI / 180) * 150),
          }
          const offY = edgeR * 0.7
          pts = `${a.x.toFixed(1)},${a.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)} ${b.x.toFixed(1)},${(b.y + offY).toFixed(1)} ${a.x.toFixed(1)},${(a.y + offY).toFixed(1)}`
        } else if (direction === 'left') {
          const a = {
            x: cx + edgeR * Math.cos((Math.PI / 180) * 150),
            y: cy + edgeR * Math.sin((Math.PI / 180) * 150),
          }
          const b = {
            x: cx + edgeR * Math.cos((Math.PI / 180) * 210),
            y: cy + edgeR * Math.sin((Math.PI / 180) * 210),
          }
          const offX = -edgeR * 0.7
          pts = `${a.x.toFixed(1)},${a.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)} ${(b.x + offX).toFixed(1)},${b.y.toFixed(1)} ${(a.x + offX).toFixed(1)},${a.y.toFixed(1)}`
        } else {
          const a = {
            x: cx + edgeR * Math.cos((Math.PI / 180) * -30),
            y: cy + edgeR * Math.sin((Math.PI / 180) * -30),
          }
          const b = {
            x: cx + edgeR * Math.cos((Math.PI / 180) * 30),
            y: cy + edgeR * Math.sin((Math.PI / 180) * 30),
          }
          const offX = edgeR * 0.7
          pts = `${a.x.toFixed(1)},${a.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)} ${(b.x + offX).toFixed(1)},${b.y.toFixed(1)} ${(a.x + offX).toFixed(1)},${a.y.toFixed(1)}`
        }
        const poly = document.createElementNS(svgNS, 'polygon')
        poly.setAttribute('points', pts)
        poly.setAttribute('class', `hex-edge-${direction}`)
        edgeGroup.appendChild(poly)
      }
    }

    // Build edge position lists
    const topEdge: [number, number][] = Array.from({ length: n }, (_, col) => [col, 0])
    const bottomEdge: [number, number][] = Array.from({ length: n }, (_, col) => [col, n - 1])
    const leftEdge: [number, number][] = Array.from({ length: n }, (_, row) => [0, row])
    const rightEdge: [number, number][] = Array.from({ length: n }, (_, row) => [n - 1, row])

    makeEdgeStrip(topEdge, 'top')
    makeEdgeStrip(bottomEdge, 'bottom')
    makeEdgeStrip(leftEdge, 'left')
    makeEdgeStrip(rightEdge, 'right')

    // Build hex cell polygons
    const cellEls: SVGPolygonElement[][] = Array.from({ length: n }, () =>
      Array<SVGPolygonElement>(n),
    )

    const cellGroup = document.createElementNS(svgNS, 'g')
    svg.appendChild(cellGroup)

    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const [cx, cy] = hexCenter(col, row)
        const poly = document.createElementNS(svgNS, 'polygon')
        poly.setAttribute('points', hexPoints(cx, cy))
        poly.setAttribute('class', 'hex-cell')
        poly.setAttribute('data-player', '0')
        poly.setAttribute('data-col', String(col))
        poly.setAttribute('data-row', String(row))
        poly.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}`)
        poly.setAttribute('role', 'button')
        poly.setAttribute('tabindex', '0')
        poly.addEventListener('click', () => handleCellClick(col, row))
        poly.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleCellClick(col, row)
          }
        })
        cellEls[row][col] = poly
        cellGroup.appendChild(poly)
      }
    }

    svgWrap.appendChild(svg)

    const actionsEl = document.createElement('div')
    actionsEl.className = 'hex-actions'

    const newGameBtn = document.createElement('button')
    newGameBtn.type = 'button'
    newGameBtn.className = 'hex-btn'
    newGameBtn.textContent = 'New game'

    const exitBtn = document.createElement('button')
    exitBtn.type = 'button'
    exitBtn.className = 'hex-btn'
    exitBtn.textContent = 'Back to menu'

    actionsEl.appendChild(newGameBtn)
    actionsEl.appendChild(exitBtn)

    wrapper.appendChild(statusEl)
    wrapper.appendChild(legendEl)
    wrapper.appendChild(svgWrap)
    wrapper.appendChild(actionsEl)
    root.appendChild(wrapper)

    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------

    function render(winningCells: Set<string> | null = null): void {
      // Status line
      const winner = checkWinner(board)
      statusEl.removeAttribute('data-winner')
      if (winner !== null) {
        const name = escapeHtml(ctx.players[winner])
        statusEl.innerHTML = `${name} wins!`
        statusEl.setAttribute('data-winner', String(winner))
      } else {
        const name = escapeHtml(ctx.players[currentPlayer])
        statusEl.textContent = `${name}'s turn`
      }

      // Update legend pills: active player is highlighted, inactive is dimmed
      for (let i = 0; i < legendItems.length; i++) {
        legendItems[i].setAttribute(
          'data-active',
          winner === null && currentPlayer === i ? 'true' : 'false',
        )
      }

      // Cell colours
      svg.setAttribute('class', `hex-svg${gameOver ? ' hex-gameover' : ''}`)
      for (let row = 0; row < n; row++) {
        for (let col = 0; col < n; col++) {
          const poly = cellEls[row][col]
          const player = board[row][col]
          poly.setAttribute('data-player', String(player))
          const key = `${col},${row}`
          poly.setAttribute('data-winner', winningCells?.has(key) ? 'true' : 'false')
          if (gameOver) {
            poly.removeAttribute('tabindex')
          } else if (player === 0) {
            poly.setAttribute('tabindex', '0')
          } else {
            poly.removeAttribute('tabindex')
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // Win path — BFS to collect winning cells for highlight
    // -------------------------------------------------------------------------

    function findWinningCells(player: 0 | 1): Set<string> | null {
      const piece: 1 | 2 = player === 0 ? 1 : 2
      const nb = BOARD_SIZE

      // Track which cell we came from for path reconstruction
      const prev = new Map<string, string | null>()
      const queue: [number, number][] = []

      if (piece === 1) {
        for (let col = 0; col < nb; col++) {
          if (board[0][col] === 1) {
            const key = `${col},0`
            prev.set(key, null)
            queue.push([col, 0])
          }
        }
      } else {
        for (let row = 0; row < nb; row++) {
          if (board[row][0] === 2) {
            const key = `0,${row}`
            prev.set(key, null)
            queue.push([0, row])
          }
        }
      }

      let goalKey: string | null = null
      let head = 0
      while (head < queue.length) {
        const [col, row] = queue[head++]

        if ((piece === 1 && row === nb - 1) || (piece === 2 && col === nb - 1)) {
          goalKey = `${col},${row}`
          break
        }

        for (const [nc, nr] of neighbours(col, row)) {
          if (nc < 0 || nc >= nb || nr < 0 || nr >= nb) continue
          const nkey = `${nc},${nr}`
          if (prev.has(nkey)) continue
          if (board[nr][nc] !== piece) continue
          prev.set(nkey, `${col},${row}`)
          queue.push([nc, nr])
        }
      }

      if (!goalKey) return null

      // Trace path back
      const path = new Set<string>()
      let cur: string | null = goalKey
      while (cur !== null) {
        path.add(cur)
        cur = prev.get(cur) ?? null
      }
      return path
    }

    // -------------------------------------------------------------------------
    // Game logic
    // -------------------------------------------------------------------------

    function handleCellClick(col: number, row: number): void {
      if (gameOver) return
      if (board[row][col] !== 0) return

      const next = board.map((r) => r.slice() as Cell[])
      next[row][col] = currentPlayer === 0 ? 1 : 2
      board = next

      const winner = checkWinner(board)
      if (winner !== null) {
        gameOver = true
        const winPath = findWinningCells(winner)
        render(winPath)
        return
      }

      currentPlayer = currentPlayer === 0 ? 1 : 0
      render()
    }

    function startNewGame(): void {
      board = createBoard()
      currentPlayer = 0
      gameOver = false
      render()
    }

    newGameBtn.addEventListener('click', startNewGame)
    exitBtn.addEventListener('click', ctx.onExit)

    // Initial render
    render()

    // Cleanup
    return () => {
      wrapper.remove()
      styleEl.remove()
    }
  },
}

export default game
