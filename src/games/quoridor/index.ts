import { confirmDestructive } from '../../lib/confirm'
import type { GameModule } from '../../lib/game'
import meta from './meta'
import {
  type Action,
  applyAction,
  BOARD_SIZE,
  canPlaceWall,
  type GameState,
  legalMoves,
  makeState,
  type Pos,
  WALL_GRID,
  type Wall,
} from './rules'

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const CELL = 56 // cell size in px
const GAP = 8 // wall gap in px
const MARGIN = 28 // outer margin in px
const PAWN_R = 18 // pawn circle radius
const WALL_THICK = 6 // visual wall thickness

// Total SVG side: MARGIN + 9 cells + 8 gaps + MARGIN
const SVG_SIZE = MARGIN * 2 + BOARD_SIZE * CELL + WALL_GRID * GAP

// Center of cell (r, c)
function cellX(c: number): number {
  return MARGIN + c * (CELL + GAP) + CELL / 2
}
function cellY(r: number): number {
  return MARGIN + r * (CELL + GAP) + CELL / 2
}

// Top-left of cell (r, c)
function cellLeft(c: number): number {
  return MARGIN + c * (CELL + GAP)
}
function cellTop(r: number): number {
  return MARGIN + r * (CELL + GAP)
}

const SVG_NS = 'http://www.w3.org/2000/svg'
function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag)
}

// ---------------------------------------------------------------------------
// Player colours
// ---------------------------------------------------------------------------

const P_COLOR = ['var(--accent)', 'var(--p2-color)'] as const

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

const game: GameModule = {
  ...meta,

  mount(root, ctx) {
    // ---- Styles ----
    const styleTag = document.createElement('style')
    styleTag.textContent = `
      .qr-root {
        --p2-color: #ff9f5a;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 0.5rem;
      }
      .qr-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        justify-content: center;
      }
      .qr-status {
        font-size: 1.1rem;
        font-weight: 600;
        min-width: 14ch;
        text-align: center;
      }
      .qr-players {
        display: flex;
        gap: 1.25rem;
      }
      .qr-player-chip {
        display: flex;
        align-items: center;
        gap: 0.4em;
        font-size: 0.95rem;
        padding: 0.3em 0.75em;
        border-radius: 999px;
        border: 2px solid transparent;
        background: transparent;
        opacity: 0.4;
        transition: opacity 0.15s, border-color 0.15s, background 0.15s;
      }
      .qr-player-chip.active {
        opacity: 1;
        border-color: var(--qr-chip-color);
        background: color-mix(in srgb, var(--qr-chip-color) 12%, transparent);
      }
      @keyframes qr-pulse {
        0%, 100% { box-shadow: 0 0 0 0 var(--qr-chip-color); }
        50%       { box-shadow: 0 0 0 4px transparent; }
      }
      .qr-player-chip.active {
        animation: qr-pulse 1.5s ease-in-out infinite;
      }
      .qr-player-dot {
        width: 11px;
        height: 11px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .qr-walls-left {
        font-size: 0.85rem;
        color: var(--fg-dim);
        margin-left: 0.2em;
      }
      .qr-mode-bar {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        flex-wrap: wrap;
        justify-content: center;
      }
      .qr-mode-btn {
        padding: 0.45em 0.9em;
        font-size: 0.9rem;
        border-radius: var(--radius);
        background: var(--bg-elev);
        border: 2px solid transparent;
        cursor: pointer;
        color: var(--fg);
        transition: border-color 0.12s;
      }
      .qr-mode-btn.selected {
        border-color: var(--accent);
      }
      .qr-mode-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .qr-svg-wrap {
        width: 100%;
        max-width: min(95vw, 90vh, 700px);
        touch-action: auto;
      }
      .qr-svg {
        display: block;
        width: 100%;
        height: auto;
      }
      .qr-svg .qr-cell {
        fill: var(--bg-elev);
        rx: 4;
        cursor: pointer;
        transition: fill 0.1s;
      }
      .qr-svg .qr-cell.highlight {
        fill: #2a3d55;
        cursor: pointer;
      }
      .qr-svg .qr-cell.highlight:hover {
        fill: #3a5070;
      }
      .qr-svg .qr-wall-slot {
        fill: transparent;
        cursor: pointer;
      }
      .qr-svg .qr-wall-slot:hover {
        fill: rgba(255,255,255,0.08);
      }
      .qr-svg .qr-wall-slot.preview {
        fill: rgba(108, 177, 255, 0.3);
      }
      .qr-svg .qr-wall-slot.illegal-preview {
        fill: rgba(255, 107, 107, 0.3);
      }
      .qr-footer {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        justify-content: center;
      }
    `
    document.head.appendChild(styleTag)

    // ---- Outer container ----
    const container = document.createElement('div')
    container.className = 'qr-root'
    root.appendChild(container)

    // ---- State ----
    let state: GameState = makeState()
    type Mode = 'move' | 'wall'
    let mode: Mode = 'move'
    let highlightedCells: Pos[] = []

    // ---- Header ----
    const header = document.createElement('div')
    header.className = 'qr-header'

    const statusEl = document.createElement('div')
    statusEl.className = 'qr-status'

    const playersEl = document.createElement('div')
    playersEl.className = 'qr-players'

    const playerChips = ctx.players.map((name, i) => {
      const chip = document.createElement('div')
      chip.className = 'qr-player-chip'
      chip.style.setProperty('--qr-chip-color', P_COLOR[i])
      const dot = document.createElement('div')
      dot.className = 'qr-player-dot'
      dot.style.background = P_COLOR[i]
      const label = document.createElement('span')
      label.textContent = name
      const walls = document.createElement('span')
      walls.className = 'qr-walls-left'
      chip.appendChild(dot)
      chip.appendChild(label)
      chip.appendChild(walls)
      playersEl.appendChild(chip)
      return { chip, walls }
    })

    header.appendChild(statusEl)
    header.appendChild(playersEl)
    container.appendChild(header)

    // ---- Mode bar ----
    const modeBar = document.createElement('div')
    modeBar.className = 'qr-mode-bar'

    const moveModeBtn = document.createElement('button')
    moveModeBtn.type = 'button'
    moveModeBtn.textContent = 'Move pawn'
    moveModeBtn.className = 'qr-mode-btn'

    const wallModeBtn = document.createElement('button')
    wallModeBtn.type = 'button'
    wallModeBtn.textContent = 'Place wall'
    wallModeBtn.className = 'qr-mode-btn'

    modeBar.appendChild(moveModeBtn)
    modeBar.appendChild(wallModeBtn)
    container.appendChild(modeBar)

    // ---- SVG ----
    const svgWrap = document.createElement('div')
    svgWrap.className = 'qr-svg-wrap'
    container.appendChild(svgWrap)

    const svg = svgEl('svg')
    svg.setAttribute('viewBox', `0 0 ${SVG_SIZE} ${SVG_SIZE}`)
    svg.classList.add('qr-svg')
    svgWrap.appendChild(svg)

    // Layers (back to front)
    const cellLayer = svgEl('g') // board cells
    const wallLayer = svgEl('g') // placed walls
    const pawnLayer = svgEl('g') // pawns
    const wallSlotLayer = svgEl('g') // interactive wall slots (top)
    const cellHitLayer = svgEl('g') // interactive cell hit targets (top)

    svg.appendChild(cellLayer)
    svg.appendChild(wallLayer)
    svg.appendChild(pawnLayer)
    svg.appendChild(wallSlotLayer)
    svg.appendChild(cellHitLayer)

    // ---- Build static cell grid ----
    const cellEls: SVGRectElement[][] = []
    for (let r = 0; r < BOARD_SIZE; r++) {
      cellEls[r] = []
      for (let c = 0; c < BOARD_SIZE; c++) {
        const rect = svgEl('rect')
        rect.setAttribute('x', String(cellLeft(c)))
        rect.setAttribute('y', String(cellTop(r)))
        rect.setAttribute('width', String(CELL))
        rect.setAttribute('height', String(CELL))
        rect.setAttribute('rx', '4')
        rect.classList.add('qr-cell')
        rect.dataset.r = String(r)
        rect.dataset.c = String(c)
        cellLayer.appendChild(rect)
        cellEls[r][c] = rect
      }
    }

    // ---- Pawn elements ----
    const pawnEls = ctx.players.map((_, i) => {
      const circle = svgEl('circle')
      circle.setAttribute('r', String(PAWN_R))
      circle.setAttribute('fill', P_COLOR[i])
      circle.setAttribute('stroke', 'var(--bg)')
      circle.setAttribute('stroke-width', '3')
      pawnLayer.appendChild(circle)
      return circle
    })

    // ---- Build wall slot hit targets ----
    // Horizontal wall slots: between row r and r+1, spanning cols c and c+1
    // Each slot covers a 2-cell + gap region
    const hSlotEls: SVGRectElement[][] = [] // [r][c] anchor
    for (let r = 0; r < WALL_GRID; r++) {
      hSlotEls[r] = []
      for (let c = 0; c < WALL_GRID; c++) {
        const x = cellLeft(c)
        const y = cellTop(r) + CELL // start of gap below row r
        const w = CELL * 2 + GAP // spans two cells + gap between them
        const h = GAP
        const slot = svgEl('rect')
        slot.setAttribute('x', String(x))
        slot.setAttribute('y', String(y))
        slot.setAttribute('width', String(w))
        slot.setAttribute('height', String(h))
        slot.classList.add('qr-wall-slot')
        slot.dataset.kind = 'h'
        slot.dataset.r = String(r)
        slot.dataset.c = String(c)
        wallSlotLayer.appendChild(slot)
        hSlotEls[r][c] = slot
      }
    }

    // Vertical wall slots: between col c and c+1, spanning rows r and r+1
    const vSlotEls: SVGRectElement[][] = []
    for (let r = 0; r < WALL_GRID; r++) {
      vSlotEls[r] = []
      for (let c = 0; c < WALL_GRID; c++) {
        const x = cellLeft(c) + CELL // start of gap right of col c
        const y = cellTop(r)
        const w = GAP
        const h = CELL * 2 + GAP // spans two cells + gap between them
        const slot = svgEl('rect')
        slot.setAttribute('x', String(x))
        slot.setAttribute('y', String(y))
        slot.setAttribute('width', String(w))
        slot.setAttribute('height', String(h))
        slot.classList.add('qr-wall-slot')
        slot.dataset.kind = 'v'
        slot.dataset.r = String(r)
        slot.dataset.c = String(c)
        wallSlotLayer.appendChild(slot)
        vSlotEls[r][c] = slot
      }
    }

    // Cell hit targets (overlay on top — only for highlighting move destinations)
    const cellHitEls: SVGRectElement[][] = []
    for (let r = 0; r < BOARD_SIZE; r++) {
      cellHitEls[r] = []
      for (let c = 0; c < BOARD_SIZE; c++) {
        const rect = svgEl('rect')
        rect.setAttribute('x', String(cellLeft(c)))
        rect.setAttribute('y', String(cellTop(r)))
        rect.setAttribute('width', String(CELL))
        rect.setAttribute('height', String(CELL))
        rect.setAttribute('fill', 'transparent')
        rect.dataset.r = String(r)
        rect.dataset.c = String(c)
        cellHitLayer.appendChild(rect)
        cellHitEls[r][c] = rect
      }
    }

    // ---- Wall visual elements (drawn walls) ----
    // These are added dynamically when walls are placed.
    function drawWall(wall: Wall, color: string): void {
      const { orientation, r, c } = wall
      const rect = svgEl('rect')
      rect.setAttribute('fill', color)
      rect.setAttribute('rx', '3')

      if (orientation === 'h') {
        const x = cellLeft(c)
        const y = cellTop(r) + CELL + (GAP - WALL_THICK) / 2
        const w = CELL * 2 + GAP
        rect.setAttribute('x', String(x))
        rect.setAttribute('y', String(y))
        rect.setAttribute('width', String(w))
        rect.setAttribute('height', String(WALL_THICK))
      } else {
        const x = cellLeft(c) + CELL + (GAP - WALL_THICK) / 2
        const y = cellTop(r)
        const h = CELL * 2 + GAP
        rect.setAttribute('x', String(x))
        rect.setAttribute('y', String(y))
        rect.setAttribute('width', String(WALL_THICK))
        rect.setAttribute('height', String(h))
      }

      wallLayer.appendChild(rect)
    }

    // ---- Render / update ----

    function updatePawns(): void {
      for (let i = 0; i < 2; i++) {
        const pos = state.pawns[i]
        pawnEls[i].setAttribute('cx', String(cellX(pos.c)))
        pawnEls[i].setAttribute('cy', String(cellY(pos.r)))
      }
    }

    function updateHighlights(): void {
      // Clear all highlights
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          cellEls[r][c].classList.remove('highlight')
          cellHitEls[r][c].style.cursor = 'default'
        }
      }
      if (state.phase !== 'playing' || mode !== 'move') return
      for (const pos of highlightedCells) {
        cellEls[pos.r][pos.c].classList.add('highlight')
        cellHitEls[pos.r][pos.c].style.cursor = 'pointer'
      }
    }

    function updateWallSlotVisibility(): void {
      const visible = state.phase === 'playing' && mode === 'wall'
      wallSlotLayer.style.display = visible ? '' : 'none'
    }

    function updateCellHitVisibility(): void {
      const visible = state.phase === 'playing' && mode === 'move'
      cellHitLayer.style.display = visible ? '' : 'none'
    }

    function updateStatus(): void {
      if (state.phase === 'done') {
        const w = state.winnerIndex
        if (w !== null) {
          statusEl.textContent = `${ctx.players[w]} wins!`
          statusEl.style.color = P_COLOR[w]
        }
      } else {
        statusEl.textContent = `${ctx.players[state.currentPlayer]}'s turn`
        statusEl.style.color = P_COLOR[state.currentPlayer]
      }

      // Player chips
      playerChips.forEach(({ chip, walls }, i) => {
        chip.classList.toggle('active', i === state.currentPlayer && state.phase === 'playing')
        walls.textContent = `(${state.wallsLeft[i]} walls)`
      })
    }

    function updateModeButtons(): void {
      const playing = state.phase === 'playing'
      moveModeBtn.classList.toggle('selected', mode === 'move')
      wallModeBtn.classList.toggle('selected', mode === 'wall')
      moveModeBtn.disabled = !playing
      wallModeBtn.disabled = !playing || state.wallsLeft[state.currentPlayer] === 0
    }

    function render(): void {
      updatePawns()
      highlightedCells = state.phase === 'playing' ? legalMoves(state) : []
      updateHighlights()
      updateWallSlotVisibility()
      updateCellHitVisibility()
      updateStatus()
      updateModeButtons()
    }

    // ---- Event handlers ----
    const abortCtrl = new AbortController()
    const { signal } = abortCtrl

    // Mode buttons
    moveModeBtn.addEventListener(
      'click',
      () => {
        if (state.phase !== 'playing') return
        mode = 'move'
        clearWallPreviews()
        render()
      },
      { signal },
    )

    wallModeBtn.addEventListener(
      'click',
      () => {
        if (state.phase !== 'playing') return
        if (state.wallsLeft[state.currentPlayer] === 0) return
        mode = 'wall'
        highlightedCells = []
        render()
      },
      { signal },
    )

    // Cell clicks (move mode)
    cellHitLayer.addEventListener(
      'click',
      (e: Event) => {
        if (state.phase !== 'playing' || mode !== 'move') return
        const target = e.target as SVGElement
        const r = Number(target.dataset.r)
        const c = Number(target.dataset.c)
        const isLegal = highlightedCells.some((p) => p.r === r && p.c === c)
        if (!isLegal) return
        const action: Action = { kind: 'move', pos: { r, c } }
        state = applyAction(state, action)
        mode = 'move'
        render()
      },
      { signal },
    )

    // Wall slot hover / click (wall mode)
    function clearWallPreviews(): void {
      for (let r = 0; r < WALL_GRID; r++) {
        for (let c = 0; c < WALL_GRID; c++) {
          hSlotEls[r][c].classList.remove('preview', 'illegal-preview')
          vSlotEls[r][c].classList.remove('preview', 'illegal-preview')
        }
      }
    }

    function applyWallPreview(wall: Wall, legal: boolean): void {
      clearWallPreviews()
      const cls = legal ? 'preview' : 'illegal-preview'
      if (wall.orientation === 'h') {
        hSlotEls[wall.r][wall.c].classList.add(cls)
        // Also highlight the second slot (c+1) to show full wall span
        if (wall.c + 1 < WALL_GRID) hSlotEls[wall.r][wall.c + 1].classList.add(cls)
      } else {
        vSlotEls[wall.r][wall.c].classList.add(cls)
        if (wall.r + 1 < WALL_GRID) vSlotEls[wall.r + 1][wall.c].classList.add(cls)
      }
    }

    wallSlotLayer.addEventListener(
      'mouseover',
      (e: Event) => {
        if (state.phase !== 'playing' || mode !== 'wall') return
        const target = e.target as SVGElement
        if (!target.dataset.kind) return
        const wall: Wall = {
          orientation: target.dataset.kind as 'h' | 'v',
          r: Number(target.dataset.r),
          c: Number(target.dataset.c),
        }
        applyWallPreview(wall, canPlaceWall(state, wall))
      },
      { signal },
    )

    wallSlotLayer.addEventListener(
      'mouseout',
      (e: Event) => {
        const rel = (e as MouseEvent).relatedTarget as Element | null
        if (rel && wallSlotLayer.contains(rel)) return
        clearWallPreviews()
      },
      { signal },
    )

    wallSlotLayer.addEventListener(
      'click',
      (e: Event) => {
        if (state.phase !== 'playing' || mode !== 'wall') return
        const target = e.target as SVGElement
        if (!target.dataset.kind) return
        const wall: Wall = {
          orientation: target.dataset.kind as 'h' | 'v',
          r: Number(target.dataset.r),
          c: Number(target.dataset.c),
        }
        if (!canPlaceWall(state, wall)) return
        const placer = state.currentPlayer
        const action: Action = { kind: 'wall', wall }
        state = applyAction(state, action)
        mode = 'move'
        clearWallPreviews()
        // Draw the wall visually using the color of the player who placed it
        drawWall(wall, P_COLOR[placer])
        render()
      },
      { signal },
    )

    // ---- Footer ----
    const footer = document.createElement('div')
    footer.className = 'qr-footer'

    const newGameBtn = document.createElement('button')
    newGameBtn.type = 'button'
    newGameBtn.textContent = 'New game'

    const exitBtn = document.createElement('button')
    exitBtn.type = 'button'
    exitBtn.textContent = 'Back to picker'

    footer.appendChild(newGameBtn)
    footer.appendChild(exitBtn)
    container.appendChild(footer)

    function startGame(): void {
      // Clear wall visuals
      while (wallLayer.firstChild) wallLayer.removeChild(wallLayer.firstChild)
      state = makeState()
      mode = 'move'
      clearWallPreviews()
      render()
    }

    newGameBtn.addEventListener(
      'click',
      async () => {
        if (!(await confirmDestructive())) return
        startGame()
      },
      { signal },
    )
    exitBtn.addEventListener('click', ctx.onExit, { signal })

    // ---- Initial render ----
    startGame()

    // ---- Cleanup ----
    return () => {
      abortCtrl.abort()
      container.remove()
      styleTag.remove()
    }
  },
}

export default game
