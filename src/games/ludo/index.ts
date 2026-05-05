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

// Colours and names indexed by star-point slot (player index 0-3).
const SLOT_COLORS = ['#ef4444', '#facc15', '#22c55e', '#3b82f6'] as const
const SLOT_NAMES = ['Red', 'Yellow', 'Green', 'Blue'] as const

// ---------------------------------------------------------------------------
// Board geometry type
// ---------------------------------------------------------------------------

/**
 * BoardGeometry captures all coordinate data needed to render one board variant
 * and convert between track positions and SVG coordinates.
 *
 * The geometry is indexed by star-point slot, which equals the player's logical
 * index for the N-pointed-star board (slot i = player i).
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
  /** Approximate cell/pawn radius scale factor (px). */
  cell: number
  /**
   * Alternating outer/inner vertices of the star polygon (2*N points), used
   * to draw the star outline. Even indices = outer tips, odd = inner valleys.
   */
  starPoints: readonly [number, number][]
}

// ---------------------------------------------------------------------------
// N-pointed star geometry builder
// ---------------------------------------------------------------------------
//
// For N players the board is an N-pointed star. Each star point belongs to one
// player and contains their yard; their home column runs inward from the tip
// toward the shared centre.
//
// Coordinate system: SVG pixels, origin top-left, y increases downward.
//
// Geometry parameters:
//   - Star centre at (CX, CY)
//   - Outer vertices at radius R_OUTER, angles theta_i = -pi/2 + 2*pi*i/N
//     (vertex 0 points straight up)
//   - Inner valleys at radius R_INNER, angles theta_i + pi/N (halfway between
//     outer vertices)
//
// Track layout:
//   L = 13 squares per arm, trackLength = N * L.
//   The track runs clockwise around the star perimeter. Each arm is split into
//   two half-legs:
//     - Going UP one side of the star point (approaching the outer tip)
//     - Going DOWN the other side (leaving the tip toward the next inner valley)
//   Half-leg A: inner valley[i] -> outer tip[i], ceil(L/2) = 7 squares
//   Half-leg B: outer tip[i] -> inner valley[i+1], floor(L/2) = 6 squares
//   Together: 7 + 6 = 13 squares per arm.
//
//   Entry square for player i: first square of half-leg A for point i.
//   Home turn-off: last square before entry of player i+1 (= last of half-leg B).
//
// Home column:
//   Runs from the outer tip of the player's point inward to the star centre.
//   6 squares, evenly spaced from tip to centre.
//
// Yard:
//   4 pawn slots arranged in a 2x2 grid near the outer tip of each point.

const STAR_CX = SVG_W / 2 // 300
const STAR_CY = SVG_H / 2 + 10 // 260
const R_OUTER = 200 // outer tip radius
const R_INNER = 100 // inner valley radius

// Squares per arm (classic Ludo).
const ARM_LEN = 13
// Half-leg lengths: approaching tip and leaving tip.
const HALF_A = 7 // inner-valley -> tip (entry side)
const HALF_B = ARM_LEN - HALF_A // tip -> next-inner-valley (exit side)

/**
 * Linearly interpolate between two points.
 */
function lerp2(a: [number, number], b: [number, number], t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

/**
 * Place a point on the star perimeter at angle `angleDeg` and radius `r`,
 * relative to the star centre.
 */
function polarPt(angleDeg: number, r: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180
  return [STAR_CX + r * Math.cos(a), STAR_CY + r * Math.sin(a)]
}

/**
 * Build the N-pointed star board geometry for `playerCount` players.
 */
function makeStarGeometry(playerCount: number): BoardGeometry {
  const N = playerCount

  // Angular step between outer vertices (degrees).
  const stepDeg = 360 / N

  // Outer tip and inner valley positions.
  // Outer vertex i at angle: -90 + i * stepDeg (so i=0 points upward).
  // Inner valley i (between tip i and tip i+1) at: -90 + (i + 0.5) * stepDeg.
  const outerTips: [number, number][] = []
  const innerValleys: [number, number][] = []
  for (let i = 0; i < N; i++) {
    outerTips.push(polarPt(-90 + i * stepDeg, R_OUTER))
    innerValleys.push(polarPt(-90 + (i + 0.5) * stepDeg, R_INNER))
  }

  const centre: [number, number] = [STAR_CX, STAR_CY]

  // Star polygon outline (2*N alternating outer/inner vertices, clockwise).
  const starPoints: [number, number][] = []
  for (let i = 0; i < N; i++) {
    starPoints.push(outerTips[i])
    starPoints.push(innerValleys[i])
  }

  // Build main track (N * ARM_LEN squares, clockwise).
  // For each arm i:
  //   Half-leg A (HALF_A squares): inner valley[i-1] -> outer tip[i]
  //     Square j (0-indexed): lerp at (j+1)/(HALF_A+1) from valley to tip
  //     These are entry squares approaching the player's tip from the left.
  //   Half-leg B (HALF_B squares): outer tip[i] -> inner valley[i]
  //     Square j (0-indexed): lerp at (j+1)/(HALF_B+1) from tip to next valley
  //     These are exit squares leaving the tip to the right.
  //
  // Arm 0 starts at track index 0 (player 0's entry).
  // The left valley for arm i is innerValleys[(i - 1 + N) % N].
  const mainTrack: [number, number][] = []
  for (let i = 0; i < N; i++) {
    const leftValley = innerValleys[(i - 1 + N) % N]
    const tip = outerTips[i]
    const rightValley = innerValleys[i]

    // Half-leg A: left valley -> tip (HALF_A squares, indices 1..HALF_A)
    for (let j = 0; j < HALF_A; j++) {
      mainTrack.push(lerp2(leftValley, tip, (j + 1) / (HALF_A + 1)))
    }
    // Half-leg B: tip -> right valley (HALF_B squares, indices 1..HALF_B)
    for (let j = 0; j < HALF_B; j++) {
      mainTrack.push(lerp2(tip, rightValley, (j + 1) / (HALF_B + 1)))
    }
  }

  // Build home columns (one per slot).
  // Home column runs from the outer tip of player i's point inward to the centre.
  // 6 squares, placed at lerp fractions 1/7..6/7 from tip to centre.
  const homeCol: [number, number][][] = []
  for (let i = 0; i < N; i++) {
    const tip = outerTips[i]
    const col: [number, number][] = []
    for (let step = 1; step <= 6; step++) {
      col.push(lerp2(tip, centre, step / 7))
    }
    homeCol.push(col)
  }

  // Build yards (4 pawn positions per slot, near the outer tip).
  // Arrange 2x2 grid around a point slightly inward from the tip.
  const yard: [number, number][][] = []
  for (let i = 0; i < N; i++) {
    const tip = outerTips[i]
    // Yard centre is between the tip and the centre, fairly close to the tip.
    const yardCentre = lerp2(tip, centre, 0.22)
    // Perpendicular offset: rotate the tip-to-centre direction by 90 deg.
    const dx = centre[0] - tip[0]
    const dy = centre[1] - tip[1]
    const len = Math.sqrt(dx * dx + dy * dy)
    // Unit perpendicular (rotated 90deg clockwise)
    const px = dy / len
    const py = -dx / len
    // Unit forward (toward centre)
    const fx = dx / len
    const fy = dy / len
    const off = 14 // px offset between pawns
    yard.push([
      [yardCentre[0] - px * off - fx * off, yardCentre[1] - py * off - fy * off],
      [yardCentre[0] + px * off - fx * off, yardCentre[1] + py * off - fy * off],
      [yardCentre[0] - px * off + fx * off, yardCentre[1] - py * off + fy * off],
      [yardCentre[0] + px * off + fx * off, yardCentre[1] + py * off + fy * off],
    ])
  }

  // Approximate cell size: R_OUTER / 10 gives a reasonable pawn radius.
  const cell = R_OUTER / 10

  return {
    mainTrack,
    homeCol,
    yard,
    centre,
    cell,
    starPoints,
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
  const geo = makeStarGeometry(playerCount)
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
// Star board SVG builder
// ---------------------------------------------------------------------------

function buildStarBoardSVG(geo: BoardGeometry, playerCount: number): SVGSVGElement {
  const svg = svgEl('svg', {
    viewBox: `0 0 ${SVG_W} ${SVG_H}`,
    role: 'img',
    'aria-label': `Ludo board — ${playerCount} players`,
  })

  // Background
  svg.appendChild(svgEl('rect', { x: 0, y: 0, width: SVG_W, height: SVG_H, fill: '#1a1d24' }))

  const { starPoints, mainTrack, homeCol, yard, centre } = geo
  const N = playerCount
  const centre2: [number, number] = centre

  // Draw star polygon -- a subtle cream fill to show the play area.
  svg.appendChild(
    svgEl('polygon', {
      points: starPoints.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
      fill: '#e8e0d0',
      stroke: '#555',
      'stroke-width': 2,
    }),
  )

  // Tinted fill for each player's star point (outer tip triangle).
  // The point for player i spans from outerTip[i] to innerValley[i-1] and innerValley[i].
  // starPoints layout: [outerTip0, innerValley0, outerTip1, innerValley1, ...]
  for (let i = 0; i < N; i++) {
    const tip = starPoints[i * 2] as [number, number]
    const leftValley = starPoints[(i * 2 - 1 + starPoints.length) % starPoints.length] as [
      number,
      number,
    ]
    const rightValley = starPoints[i * 2 + 1] as [number, number]
    const color = SLOT_COLORS[i] ?? '#888'
    svg.appendChild(
      svgEl('polygon', {
        points: [tip, leftValley, rightValley]
          .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
          .join(' '),
        fill: color,
        opacity: 0.18,
      }),
    )
  }

  // Track square backgrounds
  const sqSize = 20
  for (const [x, y] of mainTrack) {
    svg.appendChild(
      svgEl('rect', {
        x: x - sqSize / 2,
        y: y - sqSize / 2,
        width: sqSize,
        height: sqSize,
        fill: '#fff',
        stroke: '#bbb',
        'stroke-width': 0.5,
        rx: 3,
      }),
    )
  }

  // Home column strips and squares (one per player).
  for (let i = 0; i < N; i++) {
    const color = SLOT_COLORS[i] ?? '#888'
    // Draw a coloured strip from tip toward centre.
    const tip = starPoints[i * 2] as [number, number]
    const nearCentre = lerp2(tip, centre2, 0.88)
    svg.appendChild(
      svgEl('line', {
        x1: tip[0].toFixed(1),
        y1: tip[1].toFixed(1),
        x2: nearCentre[0].toFixed(1),
        y2: nearCentre[1].toFixed(1),
        stroke: color,
        'stroke-width': 22,
        opacity: 0.32,
        'stroke-linecap': 'round',
      }),
    )
    // Home column squares on top of the strip.
    for (const [hx, hy] of homeCol[i]) {
      svg.appendChild(
        svgEl('rect', {
          x: hx - 9,
          y: hy - 9,
          width: 18,
          height: 18,
          fill: '#fff',
          stroke: '#bbb',
          'stroke-width': 0.5,
          rx: 2,
          opacity: 0.7,
        }),
      )
    }
  }

  // Yard areas (circle per player near the outer tip).
  for (let i = 0; i < N; i++) {
    const color = SLOT_COLORS[i] ?? '#888'
    const tip = starPoints[i * 2] as [number, number]
    const yardCentre = lerp2(tip, centre2, 0.22)
    svg.appendChild(
      svgEl('circle', {
        cx: yardCentre[0].toFixed(1),
        cy: yardCentre[1].toFixed(1),
        r: 30,
        fill: color,
        opacity: 0.25,
        stroke: color,
        'stroke-width': 2,
      }),
    )
    for (const [yx, yy] of yard[i]) {
      svg.appendChild(
        svgEl('circle', {
          cx: yx.toFixed(1),
          cy: yy.toFixed(1),
          r: 9,
          fill: '#fff',
          stroke: color,
          'stroke-width': 1.5,
          opacity: 0.6,
        }),
      )
    }
  }

  // Shared centre finish area.
  svg.appendChild(
    svgEl('circle', {
      cx: centre2[0],
      cy: centre2[1],
      r: 20,
      fill: '#888',
      opacity: 0.55,
    }),
  )

  // Start square highlights (entry square = first square of each arm).
  for (let i = 0; i < N; i++) {
    const color = SLOT_COLORS[i] ?? '#888'
    const [sx, sy] = mainTrack[i * ARM_LEN]
    svg.appendChild(
      svgEl('rect', {
        x: sx - sqSize / 2 + 1,
        y: sy - sqSize / 2 + 1,
        width: sqSize - 2,
        height: sqSize - 2,
        fill: color,
        opacity: 0.55,
        rx: 3,
      }),
    )
  }

  return svg
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
  padding: 0.3em 0.75em;
  border-radius: 999px;
  border: 2px solid transparent;
  background: transparent;
  opacity: 0.4;
  transition: opacity 0.15s, border-color 0.15s, background 0.15s;
}
.ludo-player-row.active {
  opacity: 1;
  font-weight: 700;
  border-color: var(--ludo-row-color, var(--accent));
  background: color-mix(in srgb, var(--ludo-row-color, var(--accent)) 12%, transparent);
}
@keyframes ludo-pulse {
  0%, 100% { box-shadow: 0 0 0 0 var(--ludo-row-color, var(--accent)); }
  50%       { box-shadow: 0 0 0 4px transparent; }
}
.ludo-player-row.active {
  animation: ludo-pulse 1.5s ease-in-out infinite;
}

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

// Unicode die faces (U+2680..U+2685)
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

    let boardSVG: SVGSVGElement = buildStarBoardSVG(geo, state.playerCount)
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

    function playerName(p: number): string {
      return ctx.players[p] ?? SLOT_NAMES[state.quadrantSlots[p]] ?? `Player ${p + 1}`
    }

    function playerColor(p: number): string {
      return SLOT_COLORS[state.quadrantSlots[p]] ?? '#888'
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
        // Single hop: yard -> start square
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
        row.style.setProperty('--ludo-row-color', playerColor(p))

        const dot = document.createElement('div')
        dot.className = 'ludo-player-dot'
        dot.style.background = playerColor(p)

        row.appendChild(dot)
        row.appendChild(
          document.createTextNode(
            `${playerName(p)} (${SLOT_NAMES[state.quadrantSlots[p]] ?? `P${p + 1}`})`,
          ),
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
        statusEl.textContent = `${name}: no moves -- skipping`
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

      // Detect capture: find opponent at the final waypoint.
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
      boardSVG = buildStarBoardSVG(geo, state.playerCount)
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
