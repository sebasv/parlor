import type { GameModule } from '../../lib/game'
import meta from './meta'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Starting dot count. 3 gives a short (~6-move) game; 4 gives a meatier game.
// We use 3 for v1 — see sprouts-design.md for rationale.
const INITIAL_DOTS = 3

// Maximum connections a dot can have before it is "dead".
const MAX_CONNECTIONS = 3

// Snap radius in pixels: how close the pointer must be to a dot to start/end a curve.
const SNAP_RADIUS = 30

// Radius of a rendered dot in pixels (large enough for comfortable tablet tapping).
const DOT_RADIUS = 18

// Colour palette (connection count → fill colour)
const COLOR_ALIVE = '#4ade80' // 0 or 1 connections — green
const COLOR_WARN = '#facc15' // 2 connections — yellow (one slot left)
const COLOR_DEAD = '#ef4444' // 3 connections — red / dead

// Stroke colour for committed curves.
const CURVE_STROKE = '#6cb1ff'
// Stroke colour for the in-progress drag curve.
const DRAFT_STROKE = '#93c5fd'
// Stroke colour for the error flash.
const ERROR_STROKE = '#ff6b6b'

// SVG namespace
const SVG_NS = 'http://www.w3.org/2000/svg'

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

interface Point {
  x: number
  y: number
}

/** Euclidean distance between two points. */
function dist(a: Point, b: Point): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Segment–segment intersection test (exclusive of shared endpoints).
 * Returns true if segments AB and CD properly intersect.
 * Uses the cross-product / parametric approach.
 */
function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const cdx = d.x - c.x
  const cdy = d.y - c.y

  const denom = abx * cdy - aby * cdx
  if (Math.abs(denom) < 1e-10) return false // parallel or collinear

  const acx = c.x - a.x
  const acy = c.y - a.y

  const t = (acx * cdy - acy * cdx) / denom
  const u = (acx * aby - acy * abx) / denom

  // Strict interior intersection (exclude endpoints with a small epsilon so
  // curves that share a dot endpoint do not falsely trigger).
  const eps = 0.02
  return t > eps && t < 1 - eps && u > eps && u < 1 - eps
}

/**
 * Check whether a new polyline (given as an array of Points) crosses any of the
 * existing committed curves.
 *
 * The new polyline shares endpoints with existing curves at the source and
 * target dots, so we skip intersection checks for segment pairs that involve
 * the very first or very last segment of the new curve touching those dots.
 * Instead we use a small epsilon inside segmentsIntersect.
 */
function polylineCrossesExisting(newPts: Point[], existingCurves: Curve[]): boolean {
  if (newPts.length < 2) return false

  for (const curve of existingCurves) {
    const ep = curve.points
    if (ep.length < 2) continue

    for (let ni = 0; ni < newPts.length - 1; ni++) {
      const na = newPts[ni]
      const nb = newPts[ni + 1]

      for (let ei = 0; ei < ep.length - 1; ei++) {
        if (segmentsIntersect(na, nb, ep[ei], ep[ei + 1])) {
          return true
        }
      }
    }
  }

  return false
}

/**
 * Compute the midpoint of a polyline by arc-length (index midpoint fallback).
 * We pick the point at the middle index of the points array; this is fast and
 * good enough for auto-placing the new dot — see sprouts-design.md.
 */
function polylineMidpoint(pts: Point[]): Point {
  if (pts.length === 0) return { x: 0, y: 0 }
  const mid = Math.floor(pts.length / 2)
  return { x: pts[mid].x, y: pts[mid].y }
}

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------

interface Dot {
  id: number
  x: number
  y: number
  connections: number // number of curve-endpoints (or +2 for self-loops) touching this dot
}

interface Curve {
  id: number
  fromDot: number // dot id
  toDot: number // dot id (same as fromDot for a self-loop)
  points: Point[] // polyline points, includes start and end positions
}

interface GameState {
  dots: Dot[]
  curves: Curve[]
  currentPlayer: number // 0 or 1
  phase: 'playing' | 'done'
  winner: number | null // player index who made the last move (wins)
  nextId: number // auto-increment for dot/curve ids
}

// ---------------------------------------------------------------------------
// Pure game-state helpers
// ---------------------------------------------------------------------------

function createInitialState(): GameState {
  // Place N dots in a rough circle so they are evenly spaced in the canvas.
  const dots: Dot[] = []
  const cx = 300
  const cy = 270
  const r = 130

  for (let i = 0; i < INITIAL_DOTS; i++) {
    const angle = (2 * Math.PI * i) / INITIAL_DOTS - Math.PI / 2
    dots.push({
      id: i,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      connections: 0,
    })
  }

  return {
    dots,
    curves: [],
    currentPlayer: 0,
    phase: 'playing',
    winner: null,
    nextId: INITIAL_DOTS,
  }
}

/** A dot is live if it has < MAX_CONNECTIONS connections. */
function isLive(dot: Dot): boolean {
  return dot.connections < MAX_CONNECTIONS
}

/** Dot fill colour based on connection count. */
function dotColor(dot: Dot): string {
  if (dot.connections >= MAX_CONNECTIONS) return COLOR_DEAD
  if (dot.connections === 2) return COLOR_WARN
  return COLOR_ALIVE
}

// ---------------------------------------------------------------------------
// SVG helpers
// ---------------------------------------------------------------------------

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag)
}

function pointsAttr(pts: Point[]): string {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const CSS = `
.sp-root {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.5rem;
  min-height: 100%;
}

.sp-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}

.sp-status {
  font-size: 1.1rem;
  font-weight: 600;
  text-align: center;
  min-width: 16ch;
}

.sp-turn-0 { color: var(--accent); }
.sp-turn-1 { color: #ff9f5a; }

.sp-canvas-wrap {
  touch-action: none;
  cursor: crosshair;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #2a2f38;
  max-width: 100%;
}

.sp-svg {
  display: block;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}

.sp-footer {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}

.sp-hint {
  font-size: 0.8rem;
  color: var(--fg-dim);
  text-align: center;
  max-width: 420px;
  line-height: 1.4;
}

.sp-pass-note {
  font-size: 0.75rem;
  color: var(--fg-dim);
  text-align: center;
  max-width: 380px;
}

.sp-dot {
  cursor: pointer;
  transition: filter 0.1s;
}

.sp-dot-dead {
  cursor: default;
}

.sp-dot-ring {
  fill: none;
  stroke: rgba(255,255,255,0.15);
  stroke-width: 1.5;
  pointer-events: none;
}
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

    // ---- Mutable state ----
    let state = createInitialState()

    // ---- Drawing interaction state ----
    let dragActive = false
    let dragFromDot: Dot | null = null
    let draftPoints: Point[] = []
    let errorFlash = false

    // ---- Build DOM ----
    const container = document.createElement('div')
    container.className = 'sp-root'
    root.appendChild(container)

    const header = document.createElement('div')
    header.className = 'sp-header'

    const statusEl = document.createElement('div')
    statusEl.className = 'sp-status'
    header.appendChild(statusEl)
    container.appendChild(header)

    // SVG canvas
    const canvasWrap = document.createElement('div')
    canvasWrap.className = 'sp-canvas-wrap'
    container.appendChild(canvasWrap)

    const SVG_W = 600
    const SVG_H = 540

    const svg = svgEl('svg')
    svg.setAttribute('width', String(SVG_W))
    svg.setAttribute('height', String(SVG_H))
    svg.setAttribute('viewBox', `0 0 ${SVG_W} ${SVG_H}`)
    svg.classList.add('sp-svg')
    canvasWrap.appendChild(svg)

    // SVG layer order: curves → draft → dots
    const curveLayer = svgEl('g')
    curveLayer.setAttribute('id', 'sp-curves')
    svg.appendChild(curveLayer)

    const draftLayer = svgEl('g')
    draftLayer.setAttribute('id', 'sp-draft')
    svg.appendChild(draftLayer)

    const dotLayer = svgEl('g')
    dotLayer.setAttribute('id', 'sp-dots')
    svg.appendChild(dotLayer)

    // Draft polyline element (reused during drag)
    const draftPolyline = svgEl('polyline')
    draftPolyline.setAttribute('fill', 'none')
    draftPolyline.setAttribute('stroke', DRAFT_STROKE)
    draftPolyline.setAttribute('stroke-width', '2.5')
    draftPolyline.setAttribute('stroke-linecap', 'round')
    draftPolyline.setAttribute('stroke-linejoin', 'round')
    draftPolyline.setAttribute('stroke-dasharray', '6 4')
    draftLayer.appendChild(draftPolyline)

    // Footer buttons
    const footer = document.createElement('div')
    footer.className = 'sp-footer'

    const passBtn = document.createElement('button')
    passBtn.type = 'button'
    passBtn.textContent = "I can't move"

    const newGameBtn = document.createElement('button')
    newGameBtn.type = 'button'
    newGameBtn.textContent = 'New game'

    const exitBtn = document.createElement('button')
    exitBtn.type = 'button'
    exitBtn.textContent = 'Back to menu'

    footer.appendChild(passBtn)
    footer.appendChild(newGameBtn)
    footer.appendChild(exitBtn)
    container.appendChild(footer)

    const hintEl = document.createElement('div')
    hintEl.className = 'sp-hint'
    hintEl.textContent =
      'Drag from one dot to another (or back to itself) to draw a curve. A dot dies at 3 connections.'
    container.appendChild(hintEl)

    const passNoteEl = document.createElement('div')
    passNoteEl.className = 'sp-pass-note'
    passNoteEl.textContent = 'Use "I can\'t move" if you have no legal move — that player loses.'
    container.appendChild(passNoteEl)

    // ---- SVG pointer-event helpers ----

    /** Convert a PointerEvent to SVG coordinates. */
    function toSvgPoint(e: PointerEvent): Point {
      const rect = svg.getBoundingClientRect()
      const scaleX = SVG_W / rect.width
      const scaleY = SVG_H / rect.height
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      }
    }

    /** Find the nearest live dot within SNAP_RADIUS, or null. */
    function nearestLiveDot(p: Point): Dot | null {
      let best: Dot | null = null
      let bestD = SNAP_RADIUS + 1
      for (const dot of state.dots) {
        if (!isLive(dot)) continue
        const d = dist(p, dot)
        if (d < bestD) {
          bestD = d
          best = dot
        }
      }
      return best
    }

    /** Find nearest dot (including dead) within SNAP_RADIUS — used for end snapping. */
    function nearestLiveDotForEnd(p: Point): Dot | null {
      return nearestLiveDot(p)
    }

    // ---- Full render ----

    function renderAll(): void {
      // Clear layers
      curveLayer.innerHTML = ''
      dotLayer.innerHTML = ''

      // Draw committed curves
      for (const curve of state.curves) {
        const poly = svgEl('polyline')
        poly.setAttribute('points', pointsAttr(curve.points))
        poly.setAttribute('fill', 'none')
        poly.setAttribute('stroke', errorFlash ? ERROR_STROKE : CURVE_STROKE)
        poly.setAttribute('stroke-width', '2.5')
        poly.setAttribute('stroke-linecap', 'round')
        poly.setAttribute('stroke-linejoin', 'round')
        curveLayer.appendChild(poly)
      }

      // Draw dots
      for (const dot of state.dots) {
        const dead = !isLive(dot)

        // Snap ring hint (subtle outer ring for live dots)
        if (!dead) {
          const ring = svgEl('circle')
          ring.setAttribute('cx', String(dot.x))
          ring.setAttribute('cy', String(dot.y))
          ring.setAttribute('r', String(SNAP_RADIUS))
          ring.classList.add('sp-dot-ring')
          dotLayer.appendChild(ring)
        }

        // Main dot circle
        const circle = svgEl('circle')
        circle.setAttribute('cx', String(dot.x))
        circle.setAttribute('cy', String(dot.y))
        circle.setAttribute('r', String(DOT_RADIUS))
        circle.setAttribute('fill', dotColor(dot))
        circle.setAttribute('stroke', 'rgba(0,0,0,0.35)')
        circle.setAttribute('stroke-width', '2')
        circle.classList.add(dead ? 'sp-dot-dead' : 'sp-dot')
        circle.setAttribute('data-dot-id', String(dot.id))
        dotLayer.appendChild(circle)

        // Connection count label
        const label = svgEl('text')
        label.setAttribute('x', String(dot.x))
        label.setAttribute('y', String(dot.y + 5))
        label.setAttribute('text-anchor', 'middle')
        label.setAttribute('fill', '#0f1115')
        label.setAttribute('font-size', '13')
        label.setAttribute('font-weight', '700')
        label.setAttribute('pointer-events', 'none')
        label.textContent = dead ? 'X' : String(dot.connections)
        dotLayer.appendChild(label)
      }

      // Update status line
      if (state.phase === 'done' && state.winner !== null) {
        statusEl.textContent = `${ctx.players[state.winner]} wins!`
        statusEl.className = 'sp-status'
        passBtn.disabled = true
      } else {
        const p = state.currentPlayer
        statusEl.textContent = `${ctx.players[p]}'s turn`
        statusEl.className = `sp-status sp-turn-${p}`
        passBtn.disabled = false
      }
    }

    // ---- Commit a curve ----

    function commitCurve(fromDot: Dot, toDot: Dot, pts: Point[]): void {
      const curveId = state.nextId++

      // Connection deltas. A self-loop uses 2 connections on the same dot.
      const isSelfLoop = fromDot.id === toDot.id
      fromDot.connections += isSelfLoop ? 2 : 1
      if (!isSelfLoop) toDot.connections += 1

      // Build the committed curve. Replace first and last point with exact dot centres
      // so the polyline is anchored to the dots, not wherever the finger lifted.
      const committed: Point[] = [
        { x: fromDot.x, y: fromDot.y },
        ...pts.slice(1, pts.length - 1),
        { x: toDot.x, y: toDot.y },
      ]

      state.curves.push({ id: curveId, fromDot: fromDot.id, toDot: toDot.id, points: committed })

      // Auto-place new dot at the polyline midpoint.
      const mid = polylineMidpoint(committed)
      const newDot: Dot = {
        id: state.nextId++,
        x: mid.x,
        y: mid.y,
        connections: 2, // it sits between two segments of the curve
      }
      state.dots.push(newDot)

      // Switch player
      state.currentPlayer = 1 - state.currentPlayer
    }

    // ---- Pointer events ----

    function onPointerDown(e: PointerEvent): void {
      if (state.phase !== 'playing') return
      e.preventDefault()
      svg.setPointerCapture(e.pointerId)

      const p = toSvgPoint(e)
      const dot = nearestLiveDot(p)
      if (!dot) return

      dragActive = true
      dragFromDot = dot
      draftPoints = [{ x: dot.x, y: dot.y }]
      draftPolyline.setAttribute('points', pointsAttr(draftPoints))
    }

    function onPointerMove(e: PointerEvent): void {
      if (!dragActive) return
      e.preventDefault()

      const p = toSvgPoint(e)
      draftPoints.push(p)

      // Downsample: keep every 4th point to avoid massive arrays, but always
      // keep first and append current.
      if (draftPoints.length > 200) {
        const first = draftPoints[0]
        const sampled = draftPoints.filter((_, i) => i % 2 === 0)
        draftPoints = [first, ...sampled.slice(1)]
      }

      draftPolyline.setAttribute('points', pointsAttr(draftPoints))
    }

    function onPointerUp(e: PointerEvent): void {
      if (!dragActive || !dragFromDot) return
      dragActive = false
      e.preventDefault()

      const p = toSvgPoint(e)
      const toDot = nearestLiveDotForEnd(p)

      // Replace the last draft point with the exact pointer-up position before
      // checking; we'll snap to the dot if valid.
      draftPoints[draftPoints.length - 1] = p

      let valid = false

      if (toDot) {
        // Must have enough connection slots:
        // - Self-loop: from-dot needs at least 2 free slots (i.e. ≤1 existing connections)
        // - Normal: each endpoint needs at least 1 free slot
        const isSelfLoop = toDot.id === dragFromDot.id
        const fromFree = MAX_CONNECTIONS - dragFromDot.connections
        const toFree = MAX_CONNECTIONS - toDot.connections

        const connectionOk = isSelfLoop ? fromFree >= 2 : fromFree >= 1 && toFree >= 1

        if (connectionOk && draftPoints.length >= 2) {
          // Snap endpoint to the dot centre
          draftPoints[draftPoints.length - 1] = { x: toDot.x, y: toDot.y }
          draftPoints[0] = { x: dragFromDot.x, y: dragFromDot.y }

          // Intersection check
          if (!polylineCrossesExisting(draftPoints, state.curves)) {
            valid = true
            commitCurve(dragFromDot, toDot, draftPoints)
          }
        }
      }

      // Clear draft line
      draftPoints = []
      draftPolyline.setAttribute('points', '')
      dragFromDot = null

      if (!valid && toDot !== null) {
        // Brief error flash to signal invalid move
        errorFlash = true
        renderAll()
        setTimeout(() => {
          errorFlash = false
          renderAll()
        }, 400)
      } else {
        renderAll()
      }
    }

    function onPointerCancel(): void {
      dragActive = false
      dragFromDot = null
      draftPoints = []
      draftPolyline.setAttribute('points', '')
    }

    svg.addEventListener('pointerdown', onPointerDown)
    svg.addEventListener('pointermove', onPointerMove)
    svg.addEventListener('pointerup', onPointerUp)
    svg.addEventListener('pointercancel', onPointerCancel)

    // ---- Pass button: current player declares they cannot move and loses ----
    function handlePass(): void {
      if (state.phase !== 'playing') return
      // The player who passes loses; the other player wins.
      state.winner = 1 - state.currentPlayer
      state.phase = 'done'
      renderAll()
    }

    function handleNewGame(): void {
      state = createInitialState()
      dragActive = false
      dragFromDot = null
      draftPoints = []
      draftPolyline.setAttribute('points', '')
      errorFlash = false
      renderAll()
    }

    passBtn.addEventListener('click', handlePass)
    newGameBtn.addEventListener('click', handleNewGame)
    exitBtn.addEventListener('click', ctx.onExit)

    // Initial render
    renderAll()

    // Cleanup
    return () => {
      svg.removeEventListener('pointerdown', onPointerDown)
      svg.removeEventListener('pointermove', onPointerMove)
      svg.removeEventListener('pointerup', onPointerUp)
      svg.removeEventListener('pointercancel', onPointerCancel)
      passBtn.removeEventListener('click', handlePass)
      newGameBtn.removeEventListener('click', handleNewGame)
      exitBtn.removeEventListener('click', ctx.onExit)
      container.remove()
      styleEl.remove()
    }
  },
}

export default game
