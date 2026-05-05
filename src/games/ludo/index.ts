import type { GameModule } from '../../lib/game'
import meta from './meta'
import {
  applyMove,
  type GameState,
  initialState,
  legalMoves,
  type Move,
  type Pawn,
  type PlayerIndex,
  skipTurn,
  stepsToHomeEntry,
  winner,
} from './rules'

// ---------------------------------------------------------------------------
// Shared SVG canvas constants
// ---------------------------------------------------------------------------

const SVG_W = 600
const SVG_H = 500

// ---------------------------------------------------------------------------
// Player colours and names
// ---------------------------------------------------------------------------

// Colours indexed by visual quadrant slot (0–3 for 4-quad board, 0–2 for 3-leg).
const SLOT_COLORS = ['#ef4444', '#facc15', '#22c55e', '#3b82f6'] as const
const SLOT_NAMES = ['Red', 'Yellow', 'Green', 'Blue'] as const

// ---------------------------------------------------------------------------
// Board geometry type
// ---------------------------------------------------------------------------

/**
 * BoardGeometry captures all coordinate data needed to render one board variant
 * and convert between track positions and SVG coordinates.
 *
 * The geometry is indexed by visual slot (not by logical player index). The
 * caller maps logical player → slot via GameState.quadrantSlots.
 */
interface BoardGeometry {
  /** SVG [cx, cy] for each square on the main outer track (length = trackLength). */
  mainTrack: readonly [number, number][]
  /**
   * Home column coordinates per slot: homeCol[slot][homeIdx] = [cx, cy].
   * homeIdx 0 = first step into home, 5 = finished square (centre).
   */
  homeCol: readonly (readonly [number, number][])[]
  /**
   * Yard pawn slot coordinates per slot: yard[slot][pawnSlot] = [cx, cy].
   * Each player has 4 pawns, so 4 entries per slot.
   */
  yard: readonly (readonly [number, number][])[]
  /** SVG [cx, cy] of the shared centre/finish point. */
  centre: [number, number]
  /** Whether coordinates are raw SVG pixels (true) or 15×15 grid cells (false). */
  rawPixels: boolean
  /** Cell size (only meaningful when rawPixels === false). */
  cell: number
}

// ---------------------------------------------------------------------------
// 4-quadrant (standard) board geometry — used for 2 and 4 players
// ---------------------------------------------------------------------------

// The 4-quad board renders as a 480×480 SVG grid inside a 600×500 canvas.
// Each of the 15×15 cells is CELL px wide/tall.
const BOARD_X = 60
const BOARD_Y = 10
const BOARD_SIZE = 480
const CELL = BOARD_SIZE / 15 // 32 px per cell

// Returns SVG [cx, cy] centre for 15×15 grid cell at [col, row] (0-indexed).
function cellCentre(col: number, row: number): [number, number] {
  return [BOARD_X + col * CELL + CELL / 2, BOARD_Y + row * CELL + CELL / 2]
}

// 52-square main track (clockwise).
// Entry points by slot: slot 0 → index 0, slot 1 → index 13, slot 2 → index 26, slot 3 → index 39.
const MAIN_TRACK_52: readonly [number, number][] = [
  // Slot 0 (Red) section — squares 0..12
  [6, 13],
  [6, 12],
  [6, 11],
  [6, 10],
  [6, 9],
  [6, 8],
  [6, 7],
  [5, 6],
  [4, 6],
  [3, 6],
  [2, 6],
  [1, 6],
  [0, 6],

  // Slot 1 (Yellow) section — squares 13..25
  [0, 5],
  [0, 4],
  [0, 3],
  [0, 2],
  [0, 1],
  [0, 0],
  [1, 0],
  [2, 0],
  [3, 0],
  [4, 0],
  [5, 0],
  [6, 0],
  [7, 0],

  // Slot 2 (Green) section — squares 26..38
  [8, 0],
  [8, 1],
  [8, 2],
  [8, 3],
  [8, 4],
  [8, 5],
  [8, 6],
  [9, 6],
  [10, 6],
  [11, 6],
  [12, 6],
  [13, 6],
  [14, 6],

  // Slot 3 (Blue) section — squares 39..51
  [14, 7],
  [14, 8],
  [14, 9],
  [14, 10],
  [14, 11],
  [14, 12],
  [14, 13],
  [13, 14],
  [12, 14],
  [11, 14],
  [10, 14],
  [9, 14],
  [8, 14],
] // 52 entries total

// Home columns (6 squares per slot, index 0 = first step, 5 = finished).
const HOME_COL_52: readonly (readonly [number, number][])[] = [
  // Slot 0 (Red): col 7, rows 13 → 8
  [
    [7, 13],
    [7, 12],
    [7, 11],
    [7, 10],
    [7, 9],
    [7, 8],
  ],
  // Slot 1 (Yellow): row 7, cols 1 → 6
  [
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 7],
    [6, 7],
  ],
  // Slot 2 (Green): col 7, rows 1 → 6
  [
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
    [7, 6],
  ],
  // Slot 3 (Blue): row 7, cols 13 → 8
  [
    [13, 7],
    [12, 7],
    [11, 7],
    [10, 7],
    [9, 7],
    [8, 7],
  ],
]

// Yard pawn slots (4 per player, in their 6×6 corner area).
const YARD_52: readonly (readonly [number, number][])[] = [
  // Slot 0 (Red): bottom-left corner
  [
    [2, 11],
    [4, 11],
    [2, 13],
    [4, 13],
  ],
  // Slot 1 (Yellow): top-left corner
  [
    [2, 1],
    [4, 1],
    [2, 3],
    [4, 3],
  ],
  // Slot 2 (Green): top-right corner
  [
    [10, 1],
    [12, 1],
    [10, 3],
    [12, 3],
  ],
  // Slot 3 (Blue): bottom-right corner
  [
    [10, 11],
    [12, 11],
    [10, 13],
    [12, 13],
  ],
]

function make4QuadGeometry(): BoardGeometry {
  return {
    mainTrack: MAIN_TRACK_52.map(([c, r]) => cellCentre(c, r)),
    homeCol: HOME_COL_52.map((col) => col.map(([c, r]) => cellCentre(c, r))),
    yard: YARD_52.map((slots) => slots.map(([c, r]) => cellCentre(c, r))),
    centre: cellCentre(7, 7),
    rawPixels: true,
    cell: CELL,
  }
}

// ---------------------------------------------------------------------------
// 3-leg triangular board geometry — used for 3 players
// ---------------------------------------------------------------------------
//
// The triangular board is rendered as raw SVG pixel coordinates within the
// same 600×500 canvas. It has three legs, each with 13 track squares, forming
// a 39-square outer track. Entries are 13 squares apart — perfectly symmetric.
//
// Triangle vertices (visual corners where yards sit):
//   V0 (slot 0, Red):    bottom centre  — track entry at index 0
//   V1 (slot 1, Yellow): top left       — track entry at index 13
//   V2 (slot 2, Green):  top right      — track entry at index 26
//
// The track runs clockwise: V0→V1→V2→V0 (bottom→top-left→top-right→bottom).
// Each leg is divided into 14 equal segments; the 13 intermediate points (not
// the vertex corners, which are reserved for yard areas) form the track.
//
// Home columns extend from each entry point inward toward the shared centre.
// The centre of the triangle is the shared finish area.

// Compute pixel coordinates for the 3-leg board.
// Triangle vertices in SVG space.
const TRI_CX = SVG_W / 2 // 300 — horizontal centre of the canvas
const TRI_CY = SVG_H / 2 + 10 // 260 — slightly below canvas midpoint

// Use circumradius that leaves enough margin for yard areas.
const TRI_R = 185

// Equilateral triangle vertices (pointing upward, clockwise from bottom).
// Angle 90° = bottom vertex; 210° = top-left; 330° = top-right (all in standard math angles).
// In SVG y increases downward, so we negate the sin component.
function triVertex(angleDeg: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180
  return [TRI_CX + TRI_R * Math.cos(a), TRI_CY - TRI_R * Math.sin(a)]
}

// V0 = bottom (270° from top = -90° from right = 90° below)
// To get bottom-centre pointing down: angle = -90° (270°)
// V0 bottom, V1 top-left, V2 top-right — clockwise in SVG (y-down)
const TRI_V0 = triVertex(-90) // bottom centre
const TRI_V1 = triVertex(-90 + 120) // top-left (30°)
const TRI_V2 = triVertex(-90 + 240) // top-right (150°)

// Centre of the triangle (centroid).
const TRI_CENTRE: [number, number] = [
  (TRI_V0[0] + TRI_V1[0] + TRI_V2[0]) / 3,
  (TRI_V0[1] + TRI_V1[1] + TRI_V2[1]) / 3,
]

/**
 * Linearly interpolate between two points.
 * t=0 → a, t=1 → b.
 */
function lerp2(a: [number, number], b: [number, number], t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

/**
 * Build the 39-square clockwise main track for the triangular board.
 *
 * Each leg runs from one vertex to the next (clockwise).
 * The leg is divided into 14 equal steps; we use intermediate points 1..13
 * (not the vertex itself, which is the yard area boundary).
 *
 * Leg 0: V0 → V1 (13 squares, indices 0..12)
 * Leg 1: V1 → V2 (13 squares, indices 13..25)
 * Leg 2: V2 → V0 (13 squares, indices 26..38)
 *
 * Index 0 is player 0's entry, index 13 is player 1's, index 26 is player 2's.
 */
function buildTriangleTrack(): [number, number][] {
  const legs: [[number, number], [number, number]][] = [
    [TRI_V0, TRI_V1],
    [TRI_V1, TRI_V2],
    [TRI_V2, TRI_V0],
  ]
  const track: [number, number][] = []
  for (const [from, to] of legs) {
    for (let i = 0; i < 13; i++) {
      // Divide leg into 14 segments; square i sits at position (i+1)/14 from 'from'
      // We offset inward slightly from the outer edge so squares sit just inside
      const t = (i + 1) / 14
      track.push(lerp2(from, to, t))
    }
  }
  return track
}

/**
 * Build the 6-step home column for each slot on the triangular board.
 * The column runs from the entry point (track index 0/13/26) toward the centre.
 * homeCol[slot][0] = first square inside home, [5] = finished (near centre).
 *
 * The entry square is track[slot*13]. The column then heads straight to the centre.
 */
function buildTriangleHomeCols(track: [number, number][]): [number, number][][] {
  const homeCols: [number, number][][] = []
  for (let slot = 0; slot < 3; slot++) {
    const entryPt = track[slot * 13] // entry square on main track
    const col: [number, number][] = []
    for (let step = 1; step <= 6; step++) {
      // Step 0 would be the entry itself (on main track), step 6 = near centre
      col.push(lerp2(entryPt, TRI_CENTRE, step / 6))
    }
    homeCols.push(col)
  }
  return homeCols
}

/**
 * Build 4 yard pawn positions per slot on the triangular board.
 * Yards are placed in the corner area near each vertex, offset inward.
 */
function buildTriangleYards(): [number, number][][] {
  const vertices = [TRI_V0, TRI_V1, TRI_V2]
  const yards: [number, number][][] = []
  for (const vertex of vertices) {
    // Shift the vertex toward the centroid for the yard centre, then spread 4 pawns.
    const yardCentre = lerp2(vertex, TRI_CENTRE, 0.18)
    // Two rows × two columns around the yard centre, offset by ~18px.
    const off = 18
    yards.push([
      [yardCentre[0] - off, yardCentre[1] - off],
      [yardCentre[0] + off, yardCentre[1] - off],
      [yardCentre[0] - off, yardCentre[1] + off],
      [yardCentre[0] + off, yardCentre[1] + off],
    ])
  }
  return yards
}

function make3LegGeometry(): BoardGeometry {
  const track = buildTriangleTrack()
  const homeCols = buildTriangleHomeCols(track)
  const yards = buildTriangleYards()
  return {
    mainTrack: track,
    homeCol: homeCols,
    yard: yards,
    centre: TRI_CENTRE,
    rawPixels: true,
    cell: 16, // approximate "cell" size for pawn radius scaling
  }
}

// ---------------------------------------------------------------------------
// Geometry cache (built once per player count)
// ---------------------------------------------------------------------------

let cachedGeometry: { playerCount: number; geo: BoardGeometry } | null = null

function getGeometry(playerCount: number): BoardGeometry {
  if (cachedGeometry && cachedGeometry.playerCount === playerCount) {
    return cachedGeometry.geo
  }
  const geo = playerCount === 3 ? make3LegGeometry() : make4QuadGeometry()
  cachedGeometry = { playerCount, geo }
  return geo
}

// ---------------------------------------------------------------------------
// SVG helpers
// ---------------------------------------------------------------------------

const NS = 'http://www.w3.org/2000/svg'

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
  return el
}

// ---------------------------------------------------------------------------
// 4-quadrant board SVG builder
// ---------------------------------------------------------------------------

function build4QuadBoardSVG(activeSlots: readonly number[]): SVGSVGElement {
  const svg = svgEl('svg', {
    viewBox: `0 0 ${SVG_W} ${SVG_H}`,
    role: 'img',
    'aria-label': 'Ludo board',
  })

  // Background
  svg.appendChild(svgEl('rect', { x: 0, y: 0, width: SVG_W, height: SVG_H, fill: '#1a1d24' }))

  // Board base
  svg.appendChild(
    svgEl('rect', {
      x: BOARD_X,
      y: BOARD_Y,
      width: BOARD_SIZE,
      height: BOARD_SIZE,
      fill: '#e8e0d0',
      stroke: '#555',
      'stroke-width': 2,
      rx: 4,
    }),
  )

  // 15×15 grid lines
  for (let row = 0; row < 15; row++) {
    for (let col = 0; col < 15; col++) {
      svg.appendChild(
        svgEl('rect', {
          x: BOARD_X + col * CELL,
          y: BOARD_Y + row * CELL,
          width: CELL,
          height: CELL,
          fill: 'none',
          stroke: '#bbb',
          'stroke-width': 0.5,
        }),
      )
    }
  }

  // Yard corner boxes (6×6 each)
  const YARD_BOXES = [
    { col: 0, row: 9, slot: 0 }, // Red — bottom-left
    { col: 0, row: 0, slot: 1 }, // Yellow — top-left
    { col: 9, row: 0, slot: 2 }, // Green — top-right
    { col: 9, row: 9, slot: 3 }, // Blue — bottom-right
  ]
  for (const { col, row, slot } of YARD_BOXES) {
    const active = activeSlots.includes(slot)
    svg.appendChild(
      svgEl('rect', {
        x: BOARD_X + col * CELL,
        y: BOARD_Y + row * CELL,
        width: CELL * 6,
        height: CELL * 6,
        fill: SLOT_COLORS[slot],
        opacity: active ? 0.25 : 0.06,
        stroke: SLOT_COLORS[slot],
        'stroke-width': 2,
      }),
    )
  }

  // Home column strips
  const HOME_STRIPS = [
    { col: 7, row: 8, w: 1, h: 6, slot: 0 }, // Red: col 7, rows 8..13
    { col: 1, row: 7, w: 6, h: 1, slot: 1 }, // Yellow: row 7, cols 1..6
    { col: 7, row: 1, w: 1, h: 6, slot: 2 }, // Green: col 7, rows 1..6
    { col: 8, row: 7, w: 6, h: 1, slot: 3 }, // Blue: row 7, cols 8..13
  ]
  for (const { col, row, w, h, slot } of HOME_STRIPS) {
    const active = activeSlots.includes(slot)
    svg.appendChild(
      svgEl('rect', {
        x: BOARD_X + col * CELL,
        y: BOARD_Y + row * CELL,
        width: CELL * w,
        height: CELL * h,
        fill: SLOT_COLORS[slot],
        opacity: active ? 0.35 : 0.08,
      }),
    )
  }

  // Centre hexagonal finish area
  const cx7 = BOARD_X + 7 * CELL
  const cy7 = BOARD_Y + 7 * CELL
  svg.appendChild(
    svgEl('polygon', {
      points: [
        `${cx7},${cy7 - CELL}`,
        `${cx7 + CELL},${cy7 - CELL}`,
        `${cx7 + 2 * CELL},${cy7}`,
        `${cx7 + CELL},${cy7 + CELL}`,
        `${cx7},${cy7 + CELL}`,
        `${cx7 - CELL},${cy7}`,
      ].join(' '),
      fill: '#888',
      opacity: 0.5,
    }),
  )

  // Start square highlights (one per active slot)
  for (const slot of activeSlots) {
    const [cx, cy] = MAIN_TRACK_52[slot * 13]
    svg.appendChild(
      svgEl('rect', {
        x: BOARD_X + cx * CELL + 1,
        y: BOARD_Y + cy * CELL + 1,
        width: CELL - 2,
        height: CELL - 2,
        fill: SLOT_COLORS[slot],
        opacity: 0.5,
        rx: 3,
      }),
    )
  }

  return svg
}

// ---------------------------------------------------------------------------
// 3-leg triangular board SVG builder
// ---------------------------------------------------------------------------

function build3LegBoardSVG(geo: BoardGeometry): SVGSVGElement {
  const svg = svgEl('svg', {
    viewBox: `0 0 ${SVG_W} ${SVG_H}`,
    role: 'img',
    'aria-label': 'Ludo board — 3 players',
  })

  // Background
  svg.appendChild(svgEl('rect', { x: 0, y: 0, width: SVG_W, height: SVG_H, fill: '#1a1d24' }))

  const track = geo.mainTrack
  const [cx, cy] = geo.centre

  // Board polygon background (the triangle, slightly inset from vertex areas)
  // Use a hexagonal fill that covers the play area.
  const vertices = [TRI_V0, TRI_V1, TRI_V2]
  svg.appendChild(
    svgEl('polygon', {
      points: vertices.map(([x, y]) => `${x},${y}`).join(' '),
      fill: '#e8e0d0',
      stroke: '#555',
      'stroke-width': 2,
    }),
  )

  // Track square backgrounds
  for (const [x, y] of track) {
    svg.appendChild(
      svgEl('rect', {
        x: x - 11,
        y: y - 11,
        width: 22,
        height: 22,
        fill: '#fff',
        stroke: '#bbb',
        'stroke-width': 0.5,
        rx: 2,
      }),
    )
  }

  // Home column strips — coloured rectangles from entry toward centre
  for (let slot = 0; slot < 3; slot++) {
    const entryPt = track[slot * 13]
    // Draw a coloured strip from entry to near-centre
    const nearCentre = lerp2(entryPt, geo.centre as [number, number], 0.92)
    svg.appendChild(
      svgEl('line', {
        x1: entryPt[0],
        y1: entryPt[1],
        x2: nearCentre[0],
        y2: nearCentre[1],
        stroke: SLOT_COLORS[slot],
        'stroke-width': 20,
        opacity: 0.35,
        'stroke-linecap': 'round',
      }),
    )
    // Home column square backgrounds on top of the strip
    const homeCols = geo.homeCol[slot]
    for (const [hx, hy] of homeCols) {
      svg.appendChild(
        svgEl('rect', {
          x: hx - 10,
          y: hy - 10,
          width: 20,
          height: 20,
          fill: '#fff',
          stroke: '#bbb',
          'stroke-width': 0.5,
          rx: 2,
          opacity: 0.6,
        }),
      )
    }
  }

  // Yard corner areas (circles near each vertex)
  for (let slot = 0; slot < 3; slot++) {
    const vertex = vertices[slot]
    const yardCentre = lerp2(vertex, geo.centre as [number, number], 0.18)
    svg.appendChild(
      svgEl('circle', {
        cx: yardCentre[0],
        cy: yardCentre[1],
        r: 34,
        fill: SLOT_COLORS[slot],
        opacity: 0.25,
        stroke: SLOT_COLORS[slot],
        'stroke-width': 2,
      }),
    )
    // 4 small yard slots
    for (const [yx, yy] of geo.yard[slot]) {
      svg.appendChild(
        svgEl('circle', {
          cx: yx,
          cy: yy,
          r: 10,
          fill: '#fff',
          stroke: SLOT_COLORS[slot],
          'stroke-width': 1.5,
          opacity: 0.6,
        }),
      )
    }
  }

  // Shared centre finish area
  svg.appendChild(
    svgEl('circle', {
      cx,
      cy,
      r: 22,
      fill: '#888',
      opacity: 0.5,
    }),
  )

  // Start square highlights on the track
  for (let slot = 0; slot < 3; slot++) {
    const [sx, sy] = track[slot * 13]
    svg.appendChild(
      svgEl('rect', {
        x: sx - 10,
        y: sy - 10,
        width: 20,
        height: 20,
        fill: SLOT_COLORS[slot],
        opacity: 0.5,
        rx: 3,
      }),
    )
  }

  return svg
}

// ---------------------------------------------------------------------------
// Board SVG builder dispatcher
// ---------------------------------------------------------------------------

function buildBoardSVG(
  playerCount: number,
  geo: BoardGeometry,
  activeSlots: readonly number[],
): SVGSVGElement {
  if (playerCount === 3) {
    return build3LegBoardSVG(geo)
  }
  return build4QuadBoardSVG(activeSlots)
}

// ---------------------------------------------------------------------------
// Pawn coordinate lookup
// ---------------------------------------------------------------------------

function pawnCoords(
  pawn: Pawn,
  geo: BoardGeometry,
  quadrantSlots: readonly number[],
): [number, number] {
  const slot = quadrantSlots[pawn.player]
  const { pos } = pawn
  if (pos.zone === 'yard') {
    return geo.yard[slot][pawn.slot] as [number, number]
  }
  if (pos.zone === 'track') {
    return geo.mainTrack[pos.index] as [number, number]
  }
  if (pos.zone === 'home') {
    return geo.homeCol[slot][pos.index] as [number, number]
  }
  // finished
  return geo.centre
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const CSS = `
.ludo-root {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 1rem;
  padding: 0.5rem;
  user-select: none;
}

.ludo-board-wrap {
  flex: 1 1 auto;
  min-width: 0;
  max-width: min(75vw, 700px);
  position: relative;
}

.ludo-board-wrap svg {
  display: block;
  width: 100%;
  height: auto;
}

.ludo-pawn { cursor: default; }
.ludo-pawn.selectable { cursor: pointer; }
.ludo-pawn.selectable circle { stroke: #fff; stroke-width: 3; }
.ludo-pawn.selected circle  { stroke: #fff; stroke-width: 3; filter: brightness(1.4); }

.ludo-sidebar {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 140px;
}

.ludo-status {
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--fg, #e6e6e6);
}

.ludo-players { display: flex; flex-direction: column; gap: 0.4rem; }

.ludo-player-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--fg, #e6e6e6);
  opacity: 0.5;
}
.ludo-player-row.active { opacity: 1; font-weight: 700; }

.ludo-player-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ludo-dice-area {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
}

.ludo-dice-display {
  font-size: 2rem;
  min-height: 2.4rem;
  line-height: 1;
}

.ludo-btn {
  padding: 0.5em 1em;
  border-radius: 8px;
  border: 1px solid transparent;
  background: var(--bg-elev, #1a1d24);
  color: var(--fg, #e6e6e6);
  font: inherit;
  cursor: pointer;
  font-size: 0.9rem;
}
.ludo-btn:hover:not(:disabled) { border-color: var(--accent, #6cb1ff); }
.ludo-btn:disabled { opacity: 0.4; cursor: default; }

.ludo-actions { display: flex; flex-direction: column; gap: 0.5rem; }

@media (max-width: 640px) {
  .ludo-root { flex-direction: column; align-items: center; }
}
`

// Unicode die faces ⚀–⚅ (U+2680..U+2685)
const DIE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

function rollD6(): number {
  return Math.floor(Math.random() * 6) + 1
}

// ---------------------------------------------------------------------------
// GameModule
// ---------------------------------------------------------------------------

const game: GameModule = {
  ...meta,

  mount(root, ctx) {
    const styleEl = document.createElement('style')
    styleEl.textContent = CSS
    document.head.appendChild(styleEl)

    // State
    let state: GameState = initialState(ctx.players.length as 2 | 3 | 4)
    let geo: BoardGeometry = getGeometry(state.playerCount)

    // DOM skeleton
    const wrapper = document.createElement('div')
    wrapper.className = 'ludo-root'

    const boardWrap = document.createElement('div')
    boardWrap.className = 'ludo-board-wrap'

    let boardSVG: SVGSVGElement = buildBoardSVG(state.playerCount, geo, state.quadrantSlots)
    boardWrap.appendChild(boardSVG)

    let pawnGroup = document.createElementNS(NS, 'g')
    boardSVG.appendChild(pawnGroup)

    const sidebar = document.createElement('div')
    sidebar.className = 'ludo-sidebar'

    const statusEl = document.createElement('div')
    statusEl.className = 'ludo-status'

    const playersEl = document.createElement('div')
    playersEl.className = 'ludo-players'

    const diceArea = document.createElement('div')
    diceArea.className = 'ludo-dice-area'

    const diceDisplay = document.createElement('div')
    diceDisplay.className = 'ludo-dice-display'

    const rollBtn = document.createElement('button')
    rollBtn.className = 'ludo-btn'
    rollBtn.type = 'button'
    rollBtn.textContent = 'Roll'

    diceArea.appendChild(diceDisplay)
    diceArea.appendChild(rollBtn)

    const actionsEl = document.createElement('div')
    actionsEl.className = 'ludo-actions'

    const newGameBtn = document.createElement('button')
    newGameBtn.className = 'ludo-btn'
    newGameBtn.type = 'button'
    newGameBtn.textContent = 'New game'

    const exitBtn = document.createElement('button')
    exitBtn.className = 'ludo-btn'
    exitBtn.type = 'button'
    exitBtn.textContent = 'Back to menu'

    actionsEl.appendChild(newGameBtn)
    actionsEl.appendChild(exitBtn)

    sidebar.appendChild(statusEl)
    sidebar.appendChild(playersEl)
    sidebar.appendChild(diceArea)
    sidebar.appendChild(actionsEl)

    wrapper.appendChild(boardWrap)
    wrapper.appendChild(sidebar)
    root.appendChild(wrapper)

    // ---- Helpers ----

    function slotName(slot: number): string {
      return SLOT_NAMES[slot] ?? `Slot ${slot}`
    }

    function playerName(p: number): string {
      return ctx.players[p] ?? SLOT_NAMES[state.quadrantSlots[p]] ?? `Player ${p + 1}`
    }

    function playerColor(p: number): string {
      return SLOT_COLORS[state.quadrantSlots[p]]
    }

    // ---- Animation helpers ----

    let animating = false

    /**
     * Compute the list of SVG [cx, cy] positions a pawn travels through
     * during a move, one entry per step (not counting the start position).
     */
    function moveWaypoints(pawn: Pawn, move: Move, dice: number): [number, number][] {
      const waypoints: [number, number][] = []
      const slot = state.quadrantSlots[pawn.player]

      if (move.kind === 'release') {
        // Single hop: yard → start square
        const startTrack = state.starts[pawn.player]
        waypoints.push(geo.mainTrack[startTrack] as [number, number])
        return waypoints
      }

      const { pos } = pawn

      if (pos.zone === 'home') {
        // Hop along home column
        const startIdx = pos.index
        for (let step = 1; step <= dice; step++) {
          const homeIdx = startIdx + step
          if (homeIdx >= geo.homeCol[slot].length) {
            waypoints.push(geo.centre)
            break
          }
          waypoints.push(geo.homeCol[slot][homeIdx] as [number, number])
        }
        return waypoints
      }

      if (pos.zone === 'track') {
        const stepsLeft = stepsToHomeEntry(pawn.player, pos.index, state)
        for (let step = 1; step <= dice; step++) {
          if (step < stepsLeft) {
            // Still on main track
            const trackIdx = (pos.index + step) % state.trackLength
            waypoints.push(geo.mainTrack[trackIdx] as [number, number])
          } else {
            // Entering home column
            const homeIdx = step - stepsLeft
            if (homeIdx >= geo.homeCol[slot].length) {
              waypoints.push(geo.centre)
              break
            }
            waypoints.push(geo.homeCol[slot][homeIdx] as [number, number])
          }
        }
        return waypoints
      }

      return waypoints
    }

    /**
     * Animate a pawn hopping through waypoints (~80ms per hop), then call onDone.
     */
    function animatePawnHop(
      startCx: number,
      startCy: number,
      waypoints: [number, number][],
      color: string,
      onDone: () => void,
    ): void {
      if (waypoints.length === 0) {
        onDone()
        return
      }

      const circle = document.createElementNS(NS, 'circle')
      circle.setAttribute('cx', String(startCx))
      circle.setAttribute('cy', String(startCy))
      circle.setAttribute('r', String(geo.cell * 0.38))
      circle.setAttribute('fill', color)
      circle.setAttribute('stroke', '#fff')
      circle.setAttribute('stroke-width', '2')
      circle.setAttribute('pointer-events', 'none')
      pawnGroup.appendChild(circle)

      const HOP_MS = 80
      let hopIndex = 0

      function nextHop(): void {
        if (hopIndex >= waypoints.length) {
          circle.remove()
          onDone()
          return
        }
        const [tx, ty] = waypoints[hopIndex]
        hopIndex++

        const fromX = Number(circle.getAttribute('cx'))
        const fromY = Number(circle.getAttribute('cy'))
        const dx = tx - fromX
        const dy = ty - fromY
        const startTime = performance.now()

        function tick(now: number): void {
          const t = Math.min(1, (now - startTime) / HOP_MS)
          circle.setAttribute('cx', String(fromX + dx * t))
          circle.setAttribute('cy', String(fromY + dy * t))
          if (t < 1) {
            requestAnimationFrame(tick)
          } else {
            nextHop()
          }
        }
        requestAnimationFrame(tick)
      }

      nextHop()
    }

    /**
     * Animate a captured pawn flying back to its yard slot (250ms ease-out).
     */
    function animateCapturedPawn(
      fromCx: number,
      fromCy: number,
      toCx: number,
      toCy: number,
      color: string,
      onDone: () => void,
    ): void {
      const circle = document.createElementNS(NS, 'circle')
      circle.setAttribute('cx', String(fromCx))
      circle.setAttribute('cy', String(fromCy))
      circle.setAttribute('r', String(geo.cell * 0.35))
      circle.setAttribute('fill', color)
      circle.setAttribute('stroke', '#333')
      circle.setAttribute('stroke-width', '1.5')
      circle.setAttribute('pointer-events', 'none')
      pawnGroup.appendChild(circle)

      const DURATION = 250
      const startTime = performance.now()
      const dx = toCx - fromCx
      const dy = toCy - fromCy

      function tick(now: number): void {
        const t = Math.min(1, (now - startTime) / DURATION)
        const eased = 1 - (1 - t) * (1 - t)
        circle.setAttribute('cx', String(fromCx + dx * eased))
        circle.setAttribute('cy', String(fromCy + dy * eased))
        if (t < 1) {
          requestAnimationFrame(tick)
        } else {
          circle.remove()
          onDone()
        }
      }
      requestAnimationFrame(tick)
    }

    // ---- Render ----

    function renderPlayers(): void {
      playersEl.innerHTML = ''
      for (let p = 0; p < state.playerCount; p++) {
        const row = document.createElement('div')
        row.className = `ludo-player-row${p === state.turn ? ' active' : ''}`

        const dot = document.createElement('div')
        dot.className = 'ludo-player-dot'
        dot.style.background = playerColor(p)

        row.appendChild(dot)
        row.appendChild(
          document.createTextNode(`${playerName(p)} (${slotName(state.quadrantSlots[p])})`),
        )
        playersEl.appendChild(row)
      }
    }

    function renderStatus(w: PlayerIndex | null): void {
      if (w !== null) {
        statusEl.textContent = `${playerName(w)} wins!`
        return
      }
      const name = playerName(state.turn)
      if (state.dice === null) {
        statusEl.textContent = `${name}: roll the die`
      } else if (legalMoves(state).length === 0) {
        statusEl.textContent = `${name}: no moves — skipping`
      } else {
        statusEl.textContent = `${name}: choose a pawn`
      }
    }

    function renderDice(): void {
      diceDisplay.textContent = state.dice !== null ? DIE_FACES[state.dice] : ''
    }

    function renderPawns(w: PlayerIndex | null): void {
      pawnGroup.innerHTML = ''

      const moves = state.dice !== null ? legalMoves(state) : []
      const movableSlots = new Set(moves.map((m) => `${state.turn},${m.pawnSlot}`))

      for (const pawn of state.pawns) {
        const [cx, cy] = pawnCoords(pawn, geo, state.quadrantSlots)
        const key = `${pawn.player},${pawn.slot}`
        const isSelectable = w === null && movableSlots.has(key)
        const color = playerColor(pawn.player)

        const g = document.createElementNS(NS, 'g')
        g.setAttribute('class', `ludo-pawn${isSelectable ? ' selectable' : ''}`)

        const circle = document.createElementNS(NS, 'circle')
        circle.setAttribute('cx', String(cx))
        circle.setAttribute('cy', String(cy))
        circle.setAttribute('r', String(geo.cell * 0.35))
        circle.setAttribute('fill', color)
        circle.setAttribute('stroke', '#333')
        circle.setAttribute('stroke-width', '1.5')

        const text = document.createElementNS(NS, 'text')
        text.setAttribute('x', String(cx))
        text.setAttribute('y', String(cy + 4))
        text.setAttribute('text-anchor', 'middle')
        text.setAttribute('font-size', '9')
        text.setAttribute('fill', '#000')
        text.setAttribute('pointer-events', 'none')
        text.textContent = String(pawn.slot + 1)

        g.appendChild(circle)
        g.appendChild(text)

        if (isSelectable) {
          g.addEventListener('click', () => handlePawnClick(pawn.player as PlayerIndex, pawn.slot))
        }

        pawnGroup.appendChild(g)
      }
    }

    function render(): void {
      const w = winner(state)
      renderPlayers()
      renderStatus(w)
      renderDice()
      renderPawns(w)
      rollBtn.disabled = state.dice !== null || w !== null || animating
    }

    // ---- Interaction ----

    function handleRoll(): void {
      if (state.dice !== null || winner(state) !== null) return

      const rolled = rollD6()

      // Three consecutive 6s: show the roll then forfeit turn.
      if (rolled === 6 && state.consecutiveSixes >= 2) {
        state = { ...state, dice: rolled }
        render()
        setTimeout(() => {
          state = skipTurn(state)
          render()
        }, 700)
        return
      }

      state = { ...state, dice: rolled }

      // Auto-skip when no legal moves exist.
      if (legalMoves(state).length === 0) {
        render()
        setTimeout(() => {
          state = skipTurn(state)
          render()
        }, 800)
        return
      }

      render()
    }

    function handlePawnClick(player: PlayerIndex, slot: number): void {
      if (state.dice === null || player !== state.turn || winner(state) !== null) return
      if (animating) return

      const move: Move | undefined = legalMoves(state).find((m) => m.pawnSlot === slot)
      if (!move) return

      const movingPawn = state.pawns.find((p) => p.player === player && p.slot === slot)
      if (!movingPawn) return

      const dice = state.dice
      const waypoints = moveWaypoints(movingPawn, move, dice)
      const [startCx, startCy] = pawnCoords(movingPawn, geo, state.quadrantSlots)
      const color = playerColor(player)

      // Detect capture: find lone opponent at the final waypoint.
      let capturedPawn: Pawn | null = null
      let capturedYardCoord: [number, number] | null = null
      if (move.kind === 'advance' && movingPawn.pos.zone === 'track' && waypoints.length > 0) {
        const finalWaypoint = waypoints[waypoints.length - 1]
        for (const opponent of state.pawns) {
          if (opponent.player === player) continue
          if (opponent.pos.zone !== 'track') continue
          const [opCx, opCy] = pawnCoords(opponent, geo, state.quadrantSlots)
          if (Math.abs(opCx - finalWaypoint[0]) < 1 && Math.abs(opCy - finalWaypoint[1]) < 1) {
            capturedPawn = opponent
            const opSlot = state.quadrantSlots[opponent.player]
            capturedYardCoord = geo.yard[opSlot][opponent.slot] as [number, number]
            break
          }
        }
      }

      animating = true
      rollBtn.disabled = true

      animatePawnHop(startCx, startCy, waypoints, color, () => {
        if (capturedPawn && capturedYardCoord) {
          const finalWaypoint = waypoints[waypoints.length - 1]
          const capturedColor = playerColor(capturedPawn.player)
          state = applyMove(state, move)
          render()
          animateCapturedPawn(
            finalWaypoint[0],
            finalWaypoint[1],
            capturedYardCoord[0],
            capturedYardCoord[1],
            capturedColor,
            () => {
              animating = false
              render()
            },
          )
        } else {
          state = applyMove(state, move)
          animating = false
          render()
        }
      })
    }

    function startNewGame(): void {
      // Rebuild board SVG on new game in case player count changes between sessions.
      state = initialState(ctx.players.length as 2 | 3 | 4)
      geo = getGeometry(state.playerCount)

      const oldSVG = boardSVG
      boardSVG = buildBoardSVG(state.playerCount, geo, state.quadrantSlots)
      pawnGroup = document.createElementNS(NS, 'g')
      boardSVG.appendChild(pawnGroup)
      boardWrap.replaceChild(boardSVG, oldSVG)

      render()
    }

    rollBtn.addEventListener('click', handleRoll)
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
