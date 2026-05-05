import type { GameModule } from '../../lib/game'
import meta from './meta'

// ---------------------------------------------------------------------------
// Board constants
// ---------------------------------------------------------------------------

// Standard Hex board size for 2-player rhombus.
const BOARD_SIZE = 11

// Hex cell size in pixels (flat-to-flat width of each pointy-top hexagon).
const HEX_SIZE = 52

// Radius (in cells) for the 3-player hexagonal board.
// radius=5 → 91 cells, radius=6 → 127 cells, radius=4 → 61 cells.
// We use radius=5 (91 cells), giving a game of similar length to the 11×11 rhombus.
const HEX_BOARD_RADIUS = 5

// ---------------------------------------------------------------------------
// 2-player coordinate system (offset grid, used for rhombus board)
// ---------------------------------------------------------------------------
// col 0..N-1, row 0..N-1. Rendered as a rhombus.
// Player 0 owns TOP and BOTTOM edges. Player 1 owns LEFT and RIGHT edges.

type Cell2 = 0 | 1 | 2
type Board2 = Cell2[][]

function createBoard2(): Board2 {
  return Array.from({ length: BOARD_SIZE }, () => Array<Cell2>(BOARD_SIZE).fill(0))
}

function neighbours2(col: number, row: number): [number, number][] {
  return [
    [col + 1, row],
    [col - 1, row],
    [col, row - 1],
    [col, row + 1],
    [col + 1, row - 1],
    [col - 1, row + 1],
  ]
}

function hasWon2(board: Board2, player: 1 | 2): boolean {
  const n = BOARD_SIZE
  const visited: boolean[][] = Array.from({ length: n }, () => Array<boolean>(n).fill(false))
  const queue: [number, number][] = []

  if (player === 1) {
    for (let col = 0; col < n; col++) {
      if (board[0][col] === 1) {
        visited[0][col] = true
        queue.push([col, 0])
      }
    }
  } else {
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
    if (player === 1 && row === n - 1) return true
    if (player === 2 && col === n - 1) return true
    for (const [nc, nr] of neighbours2(col, row)) {
      if (nc < 0 || nc >= n || nr < 0 || nr >= n) continue
      if (visited[nr][nc]) continue
      if (board[nr][nc] !== player) continue
      visited[nr][nc] = true
      queue.push([nc, nr])
    }
  }
  return false
}

export function checkWinner2(board: Board2): 0 | 1 | null {
  if (hasWon2(board, 1)) return 0
  if (hasWon2(board, 2)) return 1
  return null
}

// ---------------------------------------------------------------------------
// 3-player coordinate system (axial grid, hexagonal board)
// ---------------------------------------------------------------------------
// Axial (q, r) coordinates. A cell exists when max(|q|, |r|, |q+r|) <= radius.
//
// The hexagonal board has 6 sides. Each player owns 2 opposite sides:
//   Player 0: side A (top-right)  + side D (bottom-left)   [opposite]
//   Player 1: side B (bottom-right) + side E (top-left)    [opposite]
//   Player 2: side C (bottom)     + side F (top)           [opposite]
//
// Side identification for radius R (cells on the boundary where one axial
// coordinate equals ±R):
//   Side A (top-right):    r === -R  (and q+r is 0..R)  i.e. r = -radius
//   Side B (bottom-right): q+r === R (and r is 0..R)
//   Side C (bottom):       q === -R  ... wait — let's use the standard 6-side labeling.
//
// Standard 6 sides of a pointy-top axial hexagon (the "flat" sides):
//   Side 0: r = -R  (cells: q from 0..R,  r=-R)      — top-right
//   Side 1: q+r = R (cells: r from 0..R,  q=R-r)     — right
//   Side 2: q = R   (cells: r from -R..0, q=R)       — bottom-right
//   Side 3: r = R   (cells: q from -R..0, r=R)       — bottom-left
//   Side 4: q+r = -R (cells: r from -R..0, q=-R-r)   — left
//   Side 5: q = -R  (cells: r from 0..R,  q=-R)      — top-left
//
// Owner assignment (alternating so opposite sides belong to same player):
//   Side 0 + Side 3 → Player 0  (top-right + bottom-left)
//   Side 1 + Side 4 → Player 1  (right + left)
//   Side 2 + Side 5 → Player 2  (bottom-right + top-left)

type CellKey3 = string // `${q},${r}`
type Board3 = Map<CellKey3, number> // value: 0=empty, 1=p0, 2=p1, 3=p2

function cellKey3(q: number, r: number): CellKey3 {
  return `${q},${r}`
}

function inBounds3(q: number, r: number, radius: number): boolean {
  return Math.abs(q) <= radius && Math.abs(r) <= radius && Math.abs(q + r) <= radius
}

function createBoard3(radius: number): Board3 {
  const board = new Map<CellKey3, number>()
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (inBounds3(q, r, radius)) {
        board.set(cellKey3(q, r), 0)
      }
    }
  }
  return board
}

function neighbours3(q: number, r: number): [number, number][] {
  return [
    [q + 1, r],
    [q - 1, r],
    [q, r + 1],
    [q, r - 1],
    [q + 1, r - 1],
    [q - 1, r + 1],
  ]
}

// Pre-compute border cells for each side (0-5) at given radius.
function sideCells3(side: number, radius: number): [number, number][] {
  const R = radius
  const cells: [number, number][] = []
  switch (side) {
    case 0: // r = -R, q from 0..R
      for (let q = 0; q <= R; q++) cells.push([q, -R])
      break
    case 1: // q+r = R, r from 0..R
      for (let r = 0; r <= R; r++) cells.push([R - r, r])
      break
    case 2: // q = R, r from -R..0
      for (let r = -R; r <= 0; r++) cells.push([R, r])
      break
    case 3: // r = R, q from -R..0
      for (let q = -R; q <= 0; q++) cells.push([q, R])
      break
    case 4: // q+r = -R, r from -R..0
      for (let r = -R; r <= 0; r++) cells.push([-R - r, r])
      break
    case 5: // q = -R, r from 0..R
      for (let r = 0; r <= R; r++) cells.push([-R, r])
      break
  }
  return cells
}

// Each player owns 2 sides: player i owns sides i and i+3 (opposite sides).
// Player 0: sides 0 & 3, Player 1: sides 1 & 4, Player 2: sides 2 & 5.
function playerSides3(playerIndex: number): [number, number] {
  return [playerIndex, playerIndex + 3]
}

// Returns player piece value (1-indexed, so piece = playerIndex + 1).
function hasWon3(board: Board3, playerIndex: number, radius: number): boolean {
  const piece = playerIndex + 1
  const [sideA, sideB] = playerSides3(playerIndex)
  const startCells = sideCells3(sideA, radius)
  const goalCells = new Set(sideCells3(sideB, radius).map(([q, r]) => cellKey3(q, r)))

  const visited = new Set<CellKey3>()
  const queue: [number, number][] = []

  for (const [q, r] of startCells) {
    if (board.get(cellKey3(q, r)) === piece) {
      const k = cellKey3(q, r)
      visited.add(k)
      queue.push([q, r])
    }
  }

  let head = 0
  while (head < queue.length) {
    const [q, r] = queue[head++]
    if (goalCells.has(cellKey3(q, r))) return true
    for (const [nq, nr] of neighbours3(q, r)) {
      const nk = cellKey3(nq, nr)
      if (visited.has(nk)) continue
      if (!board.has(nk)) continue
      if (board.get(nk) !== piece) continue
      visited.add(nk)
      queue.push([nq, nr])
    }
  }
  return false
}

export function checkWinner3(board: Board3, radius: number): number | null {
  for (let p = 0; p < 3; p++) {
    if (hasWon3(board, p, radius)) return p
  }
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

const R_geom = HEX_SIZE / Math.sqrt(3)
const HEX_H = R_geom * 2
const HEX_W = HEX_SIZE

function hexPoints(cx: number, cy: number): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30)
    pts.push(
      `${(cx + R_geom * Math.cos(angle)).toFixed(2)},${(cy + R_geom * Math.sin(angle)).toFixed(2)}`,
    )
  }
  return pts.join(' ')
}

// Offset grid centre (2-player rhombus board)
function hexCenter2(col: number, row: number): [number, number] {
  const cx = HEX_W * col + (HEX_W / 2) * row + HEX_W
  const cy = HEX_H * 0.75 * row + HEX_H / 2 + HEX_H * 0.5
  return [cx, cy]
}

// Axial grid centre (3-player hexagonal board)
function hexCenter3(q: number, r: number, originX: number, originY: number): [number, number] {
  const cx = originX + HEX_W * (q + r * 0.5)
  const cy = originY + HEX_H * 0.75 * r
  return [cx, cy]
}

// ---------------------------------------------------------------------------
// CSS styles
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
.hex-status[data-winner="2"] { color: var(--hex-p2); }

.hex-svg-wrap {
  --hex-p0: #ef4444;
  --hex-p1: #6cb1ff;
  --hex-p2: #4ade80;
  width: 100%;
  max-width: min(95vw, 90vh, 820px);
  overflow: auto;
}

.hex-svg {
  display: block;
  width: 100%;
  height: auto;
  touch-action: manipulation;
}

/* Edge border strips */
.hex-edge-p0 { fill: var(--hex-p0); opacity: 1; }
.hex-edge-p1 { fill: var(--hex-p1); opacity: 1; }
.hex-edge-p2 { fill: var(--hex-p2); opacity: 1; }

/* Player legend pills */
.hex-legend {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  justify-content: center;
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
  transition: opacity 0.15s, border-color 0.15s, background 0.15s, box-shadow 0.15s;
  color: var(--fg, #e6e6e6);
}

/* Active pill: thick border in player colour, semi-tinted background, colour glow */
.hex-legend-item[data-active='true'] {
  opacity: 1;
  border-width: 3px;
}

/* Per-player colouring — both text and border come from CSS vars set inline */
.hex-legend-item[data-player='0'] { --pill-color: var(--hex-p0); }
.hex-legend-item[data-player='1'] { --pill-color: var(--hex-p1); }
.hex-legend-item[data-player='2'] { --pill-color: var(--hex-p2); }

.hex-legend-swatch {
  width: 0.75em;
  height: 0.75em;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--pill-color);
}

.hex-legend-item[data-active='true'] {
  border-color: var(--pill-color);
  background: color-mix(in srgb, var(--pill-color) 18%, var(--bg-elev, #1a1d24));
  box-shadow: 0 0 8px 2px color-mix(in srgb, var(--pill-color) 40%, transparent);
  color: var(--pill-color);
}

@keyframes hex-pulse {
  0%, 100% { box-shadow: 0 0 4px 1px color-mix(in srgb, var(--pill-color) 30%, transparent); }
  50%       { box-shadow: 0 0 10px 4px color-mix(in srgb, var(--pill-color) 60%, transparent); }
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

.hex-cell[data-player="1"] { fill: var(--hex-p0); cursor: default; }
.hex-cell[data-player="2"] { fill: var(--hex-p1); cursor: default; }
.hex-cell[data-player="3"] { fill: var(--hex-p2); cursor: default; }

.hex-cell[data-player="1"]:hover { fill: var(--hex-p0); }
.hex-cell[data-player="2"]:hover { fill: var(--hex-p1); }
.hex-cell[data-player="3"]:hover { fill: var(--hex-p2); }

.hex-cell[data-winner="true"][data-player="1"] {
  fill: #ff8080;
  filter: drop-shadow(0 0 6px #ef4444);
}
.hex-cell[data-winner="true"][data-player="2"] {
  fill: #9ecfff;
  filter: drop-shadow(0 0 6px #6cb1ff);
}
.hex-cell[data-winner="true"][data-player="3"] {
  fill: #86efac;
  filter: drop-shadow(0 0 6px #4ade80);
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

    const is3Player = ctx.players.length === 3
    const numPlayers = is3Player ? 3 : 2

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    // 2-player state
    let board2 = createBoard2()

    // 3-player state
    const radius3 = HEX_BOARD_RADIUS
    let board3 = createBoard3(radius3)

    let currentPlayer = 0
    let gameOver = false

    // -------------------------------------------------------------------------
    // Build skeleton DOM
    // -------------------------------------------------------------------------

    const wrapper = document.createElement('div')
    wrapper.className = 'hex-root'

    const statusEl = document.createElement('div')
    statusEl.className = 'hex-status'

    // Legend pills
    const legendEl = document.createElement('div')
    legendEl.className = 'hex-legend'

    const legendItems: HTMLSpanElement[] = []
    const edgeLabels2 = ['top & bottom', 'left & right']
    const edgeLabels3 = ['sides A+D', 'sides B+E', 'sides C+F']

    for (let i = 0; i < numPlayers; i++) {
      const item = document.createElement('span')
      item.className = 'hex-legend-item'
      item.setAttribute('data-player', String(i))
      const edgeLabel = is3Player ? edgeLabels3[i] : edgeLabels2[i]
      const swatch = document.createElement('span')
      swatch.className = 'hex-legend-swatch'
      swatch.setAttribute('aria-hidden', 'true')
      item.appendChild(swatch)
      item.appendChild(document.createTextNode(`${ctx.players[i]} — ${edgeLabel}`))
      legendEl.appendChild(item)
      legendItems.push(item)
    }

    // SVG wrapper
    const svgWrap = document.createElement('div')
    svgWrap.className = 'hex-svg-wrap'

    const svgNS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(svgNS, 'svg')
    svg.setAttribute('aria-label', 'Hex board')
    svg.setAttribute('role', 'img')
    svg.setAttribute('class', 'hex-svg')

    const edgeGroup = document.createElementNS(svgNS, 'g')
    svg.appendChild(edgeGroup)
    const cellGroup = document.createElementNS(svgNS, 'g')
    svg.appendChild(cellGroup)

    // Cell element map (3-player uses CellKey3 → element, 2-player uses row/col array)
    const cellEls2: SVGPolygonElement[][] = []
    const cellEls3 = new Map<CellKey3, SVGPolygonElement>()

    // -------------------------------------------------------------------------
    // Edge strip helper (shared for both modes)
    // -------------------------------------------------------------------------

    function makeEdgeStrip2(
      positions: [number, number][],
      direction: 'top' | 'bottom' | 'left' | 'right',
      playerIdx: number,
    ): void {
      const edgeR = R_geom * 0.65
      for (const [col, row] of positions) {
        const [cx, cy] = hexCenter2(col, row)
        let pts = ''
        if (direction === 'top') {
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
        poly.setAttribute('class', `hex-edge-p${playerIdx}`)
        edgeGroup.appendChild(poly)
      }
    }

    // Edge strip for the hexagonal board (3-player). Draw a small triangle cap
    // on the outward face of each border hex, in the owning player's colour.
    function makeEdgeStrip3(
      cells: [number, number][],
      faceAngleDeg: number,
      playerIdx: number,
      originX: number,
      originY: number,
    ): void {
      const edgeR = R_geom * 0.65
      const offDist = edgeR * 0.7
      // The outward normal angle for this side
      const ang = (Math.PI / 180) * faceAngleDeg
      // The two face vertices flank the normal by ±30°
      const a1 = (Math.PI / 180) * (faceAngleDeg - 30)
      const a2 = (Math.PI / 180) * (faceAngleDeg + 30)
      for (const [q, r] of cells) {
        const [cx, cy] = hexCenter3(q, r, originX, originY)
        const va = { x: cx + edgeR * Math.cos(a1), y: cy + edgeR * Math.sin(a1) }
        const vb = { x: cx + edgeR * Math.cos(a2), y: cy + edgeR * Math.sin(a2) }
        const oa = { x: va.x + offDist * Math.cos(ang), y: va.y + offDist * Math.sin(ang) }
        const ob = { x: vb.x + offDist * Math.cos(ang), y: vb.y + offDist * Math.sin(ang) }
        const pts = `${va.x.toFixed(1)},${va.y.toFixed(1)} ${vb.x.toFixed(1)},${vb.y.toFixed(1)} ${ob.x.toFixed(1)},${ob.y.toFixed(1)} ${oa.x.toFixed(1)},${oa.y.toFixed(1)}`
        const poly = document.createElementNS(svgNS, 'polygon')
        poly.setAttribute('points', pts)
        poly.setAttribute('class', `hex-edge-p${playerIdx}`)
        edgeGroup.appendChild(poly)
      }
    }

    // -------------------------------------------------------------------------
    // Build board for 2-player (rhombus)
    // -------------------------------------------------------------------------

    function build2PlayerBoard(): void {
      const n = BOARD_SIZE
      const [lastCx, lastCy] = hexCenter2(n - 1, n - 1)
      const svgW = Math.ceil(lastCx + HEX_W + HEX_W * 0.5)
      const svgH = Math.ceil(lastCy + HEX_H * 0.5 + HEX_H * 0.25)
      svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`)

      const topEdge: [number, number][] = Array.from({ length: n }, (_, col) => [col, 0])
      const bottomEdge: [number, number][] = Array.from({ length: n }, (_, col) => [col, n - 1])
      const leftEdge: [number, number][] = Array.from({ length: n }, (_, row) => [0, row])
      const rightEdge: [number, number][] = Array.from({ length: n }, (_, row) => [n - 1, row])

      makeEdgeStrip2(topEdge, 'top', 0)
      makeEdgeStrip2(bottomEdge, 'bottom', 0)
      makeEdgeStrip2(leftEdge, 'left', 1)
      makeEdgeStrip2(rightEdge, 'right', 1)

      for (let row = 0; row < n; row++) {
        cellEls2.push([])
        for (let col = 0; col < n; col++) {
          const [cx, cy] = hexCenter2(col, row)
          const poly = document.createElementNS(svgNS, 'polygon')
          poly.setAttribute('points', hexPoints(cx, cy))
          poly.setAttribute('class', 'hex-cell')
          poly.setAttribute('data-player', '0')
          poly.setAttribute('data-col', String(col))
          poly.setAttribute('data-row', String(row))
          poly.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}`)
          poly.setAttribute('role', 'button')
          poly.setAttribute('tabindex', '0')
          poly.addEventListener('click', () => handleCellClick2(col, row))
          poly.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleCellClick2(col, row)
            }
          })
          cellEls2[row].push(poly)
          cellGroup.appendChild(poly)
        }
      }
    }

    // -------------------------------------------------------------------------
    // Build board for 3-player (hexagonal)
    // -------------------------------------------------------------------------

    function build3PlayerBoard(): void {
      const R = radius3
      // Compute origin so the board is centred in the SVG.
      // The board spans from q+r = -R to R in both axes.
      // The extreme pixel positions:
      //   q: -R..R, r: -R..R
      // We need enough margin for edge strips (~edgeR*0.7 extra).
      const margin = R_geom * 1.8
      const originX = HEX_W * R + margin
      const originY = HEX_H * 0.75 * R + R_geom + margin

      // Compute SVG size
      // rightmost cell: q=R, r=0 → cx = originX + HEX_W*R
      // bottommost: r=R, q=0 → cy = originY + HEX_H*0.75*R
      const svgW = Math.ceil(originX + HEX_W * R + margin)
      const svgH = Math.ceil(originY + HEX_H * 0.75 * R + margin)
      svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`)

      // Side face outward angles for pointy-top hex axial layout.
      // Side 0 (r=-R, top-right): outward normal points "top-right" ≈ -60°
      // Side 1 (q+r=R, right): outward normal → 0°
      // Side 2 (q=R, bottom-right): outward normal → 60°
      // Side 3 (r=R, bottom-left): outward normal → 120° (i.e. 180-60)
      // Side 4 (q+r=-R, left): outward normal → 180°
      // Side 5 (q=-R, top-left): outward normal → 240° (= -120°)
      const sideOutwardAngles = [-60, 0, 60, 120, 180, 240]

      // Owner: side i belongs to player (i % 3)
      for (let s = 0; s < 6; s++) {
        const owner = s % 3
        const cells = sideCells3(s, R)
        makeEdgeStrip3(cells, sideOutwardAngles[s], owner, originX, originY)
      }

      // Build hex cells
      for (let q = -R; q <= R; q++) {
        for (let r = -R; r <= R; r++) {
          if (!inBounds3(q, r, R)) continue
          const [cx, cy] = hexCenter3(q, r, originX, originY)
          const poly = document.createElementNS(svgNS, 'polygon')
          poly.setAttribute('points', hexPoints(cx, cy))
          poly.setAttribute('class', 'hex-cell')
          poly.setAttribute('data-player', '0')
          poly.setAttribute('data-q', String(q))
          poly.setAttribute('data-r', String(r))
          poly.setAttribute('aria-label', `q=${q} r=${r}`)
          poly.setAttribute('role', 'button')
          poly.setAttribute('tabindex', '0')
          poly.addEventListener('click', () => handleCellClick3(q, r))
          poly.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleCellClick3(q, r)
            }
          })
          cellEls3.set(cellKey3(q, r), poly)
          cellGroup.appendChild(poly)
        }
      }
    }

    if (is3Player) {
      build3PlayerBoard()
    } else {
      build2PlayerBoard()
    }

    // Action buttons
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
    svgWrap.appendChild(svg)
    wrapper.appendChild(actionsEl)
    root.appendChild(wrapper)

    // -------------------------------------------------------------------------
    // Win path — BFS to collect winning cells for 2-player
    // -------------------------------------------------------------------------

    function findWinningCells2(player: 0 | 1): Set<string> | null {
      const piece: 1 | 2 = player === 0 ? 1 : 2
      const nb = BOARD_SIZE
      const prev = new Map<string, string | null>()
      const queue: [number, number][] = []

      if (piece === 1) {
        for (let col = 0; col < nb; col++) {
          if (board2[0][col] === 1) {
            const key = `${col},0`
            prev.set(key, null)
            queue.push([col, 0])
          }
        }
      } else {
        for (let row = 0; row < nb; row++) {
          if (board2[row][0] === 2) {
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
        for (const [nc, nr] of neighbours2(col, row)) {
          if (nc < 0 || nc >= nb || nr < 0 || nr >= nb) continue
          const nkey = `${nc},${nr}`
          if (prev.has(nkey)) continue
          if (board2[nr][nc] !== piece) continue
          prev.set(nkey, `${col},${row}`)
          queue.push([nc, nr])
        }
      }

      if (!goalKey) return null
      const path = new Set<string>()
      let cur: string | null = goalKey
      while (cur !== null) {
        path.add(cur)
        cur = prev.get(cur) ?? null
      }
      return path
    }

    // BFS to collect winning cells for 3-player
    function findWinningCells3(playerIdx: number): Set<string> | null {
      const piece = playerIdx + 1
      const [sideA, sideB] = playerSides3(playerIdx)
      const startCells = sideCells3(sideA, radius3)
      const goalCells = new Set(sideCells3(sideB, radius3).map(([q, r]) => cellKey3(q, r)))

      const prev = new Map<string, string | null>()
      const queue: [number, number][] = []

      for (const [q, r] of startCells) {
        const k = cellKey3(q, r)
        if (board3.get(k) === piece) {
          prev.set(k, null)
          queue.push([q, r])
        }
      }

      let goalKey: string | null = null
      let head = 0
      while (head < queue.length) {
        const [q, r] = queue[head++]
        const k = cellKey3(q, r)
        if (goalCells.has(k)) {
          goalKey = k
          break
        }
        for (const [nq, nr] of neighbours3(q, r)) {
          const nk = cellKey3(nq, nr)
          if (prev.has(nk)) continue
          if (!board3.has(nk)) continue
          if (board3.get(nk) !== piece) continue
          prev.set(nk, k)
          queue.push([nq, nr])
        }
      }

      if (!goalKey) return null
      const path = new Set<string>()
      let cur: string | null = goalKey
      while (cur !== null) {
        path.add(cur)
        cur = prev.get(cur) ?? null
      }
      return path
    }

    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------

    function render(winningCells: Set<string> | null = null): void {
      const winner = is3Player ? checkWinner3(board3, radius3) : checkWinner2(board2)

      statusEl.removeAttribute('data-winner')
      if (winner !== null) {
        const name = escapeHtml(ctx.players[winner])
        statusEl.textContent = `${name} wins!`
        statusEl.setAttribute('data-winner', String(winner))
      } else {
        const name = escapeHtml(ctx.players[currentPlayer])
        statusEl.textContent = `${name}'s turn`
      }

      // Update legend pills
      for (let i = 0; i < legendItems.length; i++) {
        const active = winner === null && currentPlayer === i
        legendItems[i].setAttribute('data-active', active ? 'true' : 'false')
      }

      svg.setAttribute('class', `hex-svg${gameOver ? ' hex-gameover' : ''}`)

      if (is3Player) {
        for (const [key, poly] of cellEls3) {
          const piece = board3.get(key) ?? 0
          poly.setAttribute('data-player', String(piece))
          poly.setAttribute('data-winner', winningCells?.has(key) ? 'true' : 'false')
          if (gameOver) {
            poly.removeAttribute('tabindex')
          } else if (piece === 0) {
            poly.setAttribute('tabindex', '0')
          } else {
            poly.removeAttribute('tabindex')
          }
        }
      } else {
        const n = BOARD_SIZE
        for (let row = 0; row < n; row++) {
          for (let col = 0; col < n; col++) {
            const poly = cellEls2[row][col]
            const piece = board2[row][col]
            poly.setAttribute('data-player', String(piece))
            const key = `${col},${row}`
            poly.setAttribute('data-winner', winningCells?.has(key) ? 'true' : 'false')
            if (gameOver) {
              poly.removeAttribute('tabindex')
            } else if (piece === 0) {
              poly.setAttribute('tabindex', '0')
            } else {
              poly.removeAttribute('tabindex')
            }
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // Game logic
    // -------------------------------------------------------------------------

    function handleCellClick2(col: number, row: number): void {
      if (gameOver) return
      if (board2[row][col] !== 0) return

      const next = board2.map((r) => r.slice() as Cell2[])
      next[row][col] = (currentPlayer + 1) as 1 | 2
      board2 = next

      const winner = checkWinner2(board2)
      if (winner !== null) {
        gameOver = true
        const winPath = findWinningCells2(winner)
        render(winPath)
        return
      }

      currentPlayer = currentPlayer === 0 ? 1 : 0
      render()
    }

    function handleCellClick3(q: number, r: number): void {
      if (gameOver) return
      const key = cellKey3(q, r)
      if ((board3.get(key) ?? 0) !== 0) return

      board3 = new Map(board3)
      board3.set(key, currentPlayer + 1)

      const winner = checkWinner3(board3, radius3)
      if (winner !== null) {
        gameOver = true
        const winPath = findWinningCells3(winner)
        render(winPath)
        return
      }

      currentPlayer = (currentPlayer + 1) % 3
      render()
    }

    function startNewGame(): void {
      if (is3Player) {
        board3 = createBoard3(radius3)
      } else {
        board2 = createBoard2()
      }
      currentPlayer = 0
      gameOver = false
      render()
    }

    newGameBtn.addEventListener('click', startNewGame)
    exitBtn.addEventListener('click', ctx.onExit)

    render()

    return () => {
      wrapper.remove()
      styleEl.remove()
    }
  },
}

export default game

export type { Board2 as Board }
// Re-export for testing
export { checkWinner2 as checkWinner }
