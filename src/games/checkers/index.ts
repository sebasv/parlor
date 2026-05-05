import type { GameModule } from '../../lib/game'
import meta from './meta'
import {
  applyMove,
  type GameState,
  idxToRowCol,
  initialState,
  legalMoves,
  type Move,
  rowColToIdx,
  winner,
} from './rules'

// ---------- Helpers ----------

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  )
}

/**
 * For each hop in a move's path, find which captured piece index was taken
 * during that hop. The captured piece lies on the diagonal between the
 * departure square and the landing square.
 *
 * Returns an array of length `move.path.length`, where entry i is the
 * index of the captured piece during hop i (from move.from → path[0],
 * path[0] → path[1], ...), or null if no capture happens on that hop
 * (quiet move).
 */
function capturePerHop(move: Move): (number | null)[] {
  if (move.captured.length === 0) return move.path.map(() => null)

  const capturedSet = new Set(move.captured)
  const result: (number | null)[] = []
  const squares = [move.from, ...move.path]

  for (let i = 0; i < move.path.length; i++) {
    const from = squares[i]
    const to = squares[i + 1]
    const [r1, c1] = idxToRowCol(from)
    const [r2, c2] = idxToRowCol(to)
    const dr = Math.sign(r2 - r1)
    const dc = Math.sign(c2 - c1)

    // Walk from 'from' toward 'to' (exclusive of endpoints) to find a
    // captured piece on this diagonal segment
    let found: number | null = null
    let r = r1 + dr
    let c = c1 + dc
    while (r !== r2 || c !== c2) {
      const idx = rowColToIdx(r, c)
      if (idx !== -1 && capturedSet.has(idx)) {
        found = idx
        break
      }
      r += dr
      c += dc
    }
    result.push(found)
  }

  return result
}

// ---------- Game module ----------

const game: GameModule = {
  ...meta,

  mount(root, ctx) {
    const [p0Name, p1Name] = [ctx.players[0], ctx.players[1]]

    // ---- Mutable game state ----
    let state: GameState = initialState()
    let selectedIdx: number | null = null
    // Moves available from the selected piece
    let movesFromSelected: Move[] = []
    // All legal moves for current turn
    let allMoves: Move[] = []
    // Captured counts
    let capturedByPlayer: [number, number] = [0, 0]
    let gameOver = false
    // True while a move animation is playing — blocks all input
    let animating = false

    // ---- DOM construction ----
    const style = document.createElement('style')
    style.textContent = `
      .dr-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 0.5rem 1rem;
      }

      .dr-status {
        font-size: 1.05rem;
        font-weight: 600;
        min-height: 1.6em;
        text-align: center;
        color: var(--fg);
      }
      .dr-status.dr-win { color: var(--accent); }

      .dr-scores {
        display: flex;
        gap: 0.75rem;
        font-size: 0.9rem;
        color: var(--fg-dim);
      }
      .dr-score-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.15rem;
        padding: 0.35em 0.85em;
        border-radius: 999px;
        border: 2px solid transparent;
        background: var(--bg-elev, #1a1d24);
        opacity: 0.45;
        transition: opacity 0.15s, border-color 0.15s, background 0.15s;
      }
      .dr-score-name {
        display: flex;
        align-items: center;
        gap: 0.35em;
        font-size: 0.8rem;
      }
      .dr-piece-swatch {
        width: 0.75em;
        height: 0.75em;
        border-radius: 50%;
        flex-shrink: 0;
        border: 1px solid rgba(255,255,255,0.25);
      }
      .dr-score-val { font-size: 1.2rem; font-weight: 700; color: var(--fg); }
      /* player-light = ivory tones, player-dark = red */
      .dr-score-item[data-piece="light"] { color: #c8b89a; }
      .dr-score-item[data-piece="dark"]  { color: #c44; }
      .dr-score-item.dr-active-player {
        opacity: 1;
        border-color: currentColor;
      }
      .dr-score-item[data-piece="light"].dr-active-player {
        background: color-mix(in srgb, #c8b89a 15%, var(--bg-elev, #1a1d24));
      }
      .dr-score-item[data-piece="dark"].dr-active-player {
        background: color-mix(in srgb, #c44 15%, var(--bg-elev, #1a1d24));
      }
      @keyframes dr-pulse {
        0%, 100% { box-shadow: 0 0 0 0 currentColor; }
        50%       { box-shadow: 0 0 0 4px transparent; }
      }
      .dr-score-item.dr-active-player {
        animation: dr-pulse 1.5s ease-in-out infinite;
      }

      .dr-board-wrap {
        width: min(96vw, 90vh, 640px);
        aspect-ratio: 1;
        position: relative;
      }

      .dr-board {
        display: grid;
        grid-template-columns: repeat(10, 1fr);
        grid-template-rows: repeat(10, 1fr);
        width: 100%;
        height: 100%;
        border: 2px solid #2a2f38;
        border-radius: 6px;
        overflow: hidden;
      }

      .dr-sq {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .dr-sq.dr-light-sq {
        background: #c8b57a;
      }
      .dr-sq.dr-dark-sq {
        background: #5a3e1b;
        cursor: default;
      }
      .dr-sq.dr-dark-sq.dr-selectable {
        background: #6b4d22;
        cursor: pointer;
      }
      .dr-sq.dr-dark-sq.dr-selectable:hover {
        background: #7d5a2a;
      }
      .dr-sq.dr-dark-sq.dr-selected {
        background: #3a5a80;
        cursor: pointer;
      }
      .dr-sq.dr-dark-sq.dr-dest {
        background: #2a6040;
        cursor: pointer;
      }
      .dr-sq.dr-dark-sq.dr-dest:hover {
        background: #327048;
        cursor: pointer;
      }

      /* Path highlight: intermediate landing squares during multi-jump */
      .dr-sq.dr-path-hop {
        background: #1a5030;
      }

      .dr-piece {
        width: 76%;
        height: 76%;
        border-radius: 50%;
        pointer-events: none;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: clamp(0.55rem, 1.5vw, 0.8rem);
        font-weight: 900;
        letter-spacing: -0.02em;
        box-shadow: 0 2px 4px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.12);
      }
      .dr-piece.dr-piece-light {
        background: radial-gradient(circle at 35% 35%, #f0e8d0, #c8b89a);
        color: #3a2a0a;
        border: 2px solid #a0906a;
      }
      .dr-piece.dr-piece-dark {
        background: radial-gradient(circle at 35% 35%, #c44, #7a1010);
        color: #ffe8e8;
        border: 2px solid #ff8080;
      }

      /* Captured piece overlay shown during animation */
      .dr-piece.dr-piece-captured {
        opacity: 1;
        transition: opacity 150ms ease-out;
      }
      .dr-piece.dr-piece-captured.dr-fade-out {
        opacity: 0;
      }

      /* Hop number badge shown on intermediate path squares */
      .dr-hop-badge {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: clamp(0.6rem, 1.8vw, 0.95rem);
        font-weight: 900;
        color: rgba(255,255,255,0.85);
        pointer-events: none;
        transition: opacity 300ms ease-out;
      }
      .dr-hop-badge.dr-fade-out { opacity: 0; }

      /* Captured-piece X overlay during animation */
      .dr-capture-mark {
        position: absolute;
        inset: 15%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: clamp(0.7rem, 2vw, 1.1rem);
        font-weight: 900;
        color: rgba(255,80,80,0.9);
        pointer-events: none;
        border-radius: 50%;
        border: 2px solid rgba(255,80,80,0.7);
        transition: opacity 200ms ease-out;
      }
      .dr-capture-mark.dr-fade-out { opacity: 0; }

      /* Animated piece that slides over the board during animation */
      .dr-anim-piece {
        position: absolute;
        width: calc(100% / 10 * 0.76);
        height: calc(100% / 10 * 0.76);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: clamp(0.55rem, 1.5vw, 0.8rem);
        font-weight: 900;
        letter-spacing: -0.02em;
        box-shadow: 0 4px 8px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.12);
        pointer-events: none;
        will-change: transform;
        z-index: 10;
        /* transition is set dynamically */
      }

      /* SVG overlay for path visualisation on piece selection */
      .dr-path-svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
        overflow: visible;
      }
      .dr-path-svg line {
        stroke: rgba(120, 220, 160, 0.55);
        stroke-width: 2.5;
        stroke-dasharray: 6 4;
        stroke-linecap: round;
      }
      .dr-anim-piece.dr-piece-light {
        background: radial-gradient(circle at 35% 35%, #f0e8d0, #c8b89a);
        color: #3a2a0a;
        border: 2px solid #a0906a;
      }
      .dr-anim-piece.dr-piece-dark {
        background: radial-gradient(circle at 35% 35%, #c44, #7a1010);
        color: #ffe8e8;
        border: 2px solid #ff8080;
      }

      .dr-controls {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        justify-content: center;
      }
      .dr-btn-new {
        background: var(--accent);
        color: #000;
        font-weight: 600;
        border: none;
      }
      .dr-btn-exit {
        background: var(--bg-elev);
        color: var(--fg-dim);
      }

      .dr-midjump-note {
        font-size: 0.85rem;
        color: var(--accent);
        min-height: 1.2em;
        text-align: center;
      }
    `

    const wrap = document.createElement('div')
    wrap.className = 'dr-wrap'

    const statusEl = document.createElement('div')
    statusEl.className = 'dr-status'

    const scoresEl = document.createElement('div')
    scoresEl.className = 'dr-scores'

    const midJumpNote = document.createElement('div')
    midJumpNote.className = 'dr-midjump-note'

    const boardWrap = document.createElement('div')
    boardWrap.className = 'dr-board-wrap'

    const boardEl = document.createElement('div')
    boardEl.className = 'dr-board'
    boardEl.setAttribute('role', 'grid')
    boardEl.setAttribute('aria-label', 'Draughts board')
    boardWrap.appendChild(boardEl)

    // SVG layer for path visualisation (non-interactive, sits above board)
    const pathSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    pathSvg.setAttribute('class', 'dr-path-svg')
    pathSvg.setAttribute('aria-hidden', 'true')
    boardWrap.appendChild(pathSvg)

    const controlsEl = document.createElement('div')
    controlsEl.className = 'dr-controls'

    const newGameBtn = document.createElement('button')
    newGameBtn.type = 'button'
    newGameBtn.textContent = 'New game'
    newGameBtn.className = 'dr-btn-new'

    const exitBtn = document.createElement('button')
    exitBtn.type = 'button'
    exitBtn.textContent = 'Back to picker'
    exitBtn.className = 'dr-btn-exit'

    controlsEl.appendChild(newGameBtn)
    controlsEl.appendChild(exitBtn)

    wrap.appendChild(statusEl)
    wrap.appendChild(scoresEl)
    wrap.appendChild(midJumpNote)
    wrap.appendChild(boardWrap)
    wrap.appendChild(controlsEl)

    // Build 100 square elements (10x10)
    const sqEls: HTMLDivElement[] = []
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const sq = document.createElement('div')
        sq.className = 'dr-sq'
        const isDark = (row + col) % 2 === 1
        sq.classList.add(isDark ? 'dr-dark-sq' : 'dr-light-sq')
        if (isDark) {
          const darkIdx = rowColToIdx(row, col)
          sq.dataset.idx = String(darkIdx)
        }
        boardEl.appendChild(sq)
        sqEls.push(sq)
      }
    }

    // ---- Square element lookup helpers ----

    /** Return the DOM element for a dark-square index. */
    function sqElForIdx(idx: number): HTMLDivElement {
      const [row, col] = idxToRowCol(idx)
      return sqEls[row * 10 + col]
    }

    /**
     * Return the center of a dark-square as fractional offsets (0..1) relative
     * to the board-wrap element. Used to position the animated piece.
     */
    function squareFraction(idx: number): { x: number; y: number } {
      const [row, col] = idxToRowCol(idx)
      return { x: (col + 0.5) / 10, y: (row + 0.5) / 10 }
    }

    // ---- Path visualisation ----

    /** Remove all path lines from the SVG overlay. */
    function clearPathLines(): void {
      while (pathSvg.firstChild) pathSvg.removeChild(pathSvg.firstChild)
    }

    /**
     * Draw dashed diagonal lines showing the route(s) a selected piece can
     * take.  For each legal move from the selected square we walk the full
     * sequence of squares (from → path[0] → path[1] → …) and emit a <line>
     * element per segment.  Duplicate segments (shared prefixes in multi-
     * path capture trees) are deduplicated so the overlay stays clean.
     *
     * Coordinates are expressed as percentages of the board-wrap size so they
     * scale correctly at any board size without needing a ResizeObserver.
     */
    function drawPathLines(moves: Move[]): void {
      clearPathLines()
      if (moves.length === 0) return

      const drawnSegments = new Set<string>()

      for (const move of moves) {
        const squares = [move.from, ...move.path]
        for (let i = 0; i < squares.length - 1; i++) {
          const a = squares[i]
          const b = squares[i + 1]
          const key = `${Math.min(a, b)}-${Math.max(a, b)}`
          if (drawnSegments.has(key)) continue
          drawnSegments.add(key)

          const fa = squareFraction(a)
          const fb = squareFraction(b)

          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
          line.setAttribute('x1', `${fa.x * 100}%`)
          line.setAttribute('y1', `${fa.y * 100}%`)
          line.setAttribute('x2', `${fb.x * 100}%`)
          line.setAttribute('y2', `${fb.y * 100}%`)
          pathSvg.appendChild(line)
        }
      }
    }

    // ---- Animation ----

    /**
     * Animate a move: slide the piece through each hop, fading out captured
     * pieces as the moving piece passes over them. After the last hop completes,
     * call `onDone` to commit the state and re-render.
     *
     * During animation, `animating` is true so input is blocked.
     */
    function animateMove(move: Move, hopMs: number, onDone: () => void): void {
      animating = true

      const piece = state.board[move.from]
      if (piece === null) {
        // Shouldn't happen, but bail gracefully
        animating = false
        onDone()
        return
      }

      const isMultiJump = move.path.length > 1
      const hopsPerCapture = capturePerHop(move)
      const HOP_MS = hopMs

      // ---- Prepare board visuals for the animation ----

      // Hide the moving piece from its source square visually (we render it
      // as a separate absolutely-positioned element instead)
      const srcEl = sqElForIdx(move.from)
      const srcPieceEl = srcEl.querySelector<HTMLDivElement>('.dr-piece')
      if (srcPieceEl) srcPieceEl.style.visibility = 'hidden'

      // Mark captured pieces with an X overlay and keep a reference for fade-out
      const captureMarkEls = new Map<number, HTMLDivElement>()
      for (const capIdx of move.captured) {
        const capEl = sqElForIdx(capIdx)
        const capPiece = capEl.querySelector<HTMLDivElement>('.dr-piece')
        if (capPiece) {
          capPiece.classList.add('dr-piece-captured')
          const mark = document.createElement('div')
          mark.className = 'dr-capture-mark'
          mark.textContent = 'x'
          capEl.appendChild(mark)
          captureMarkEls.set(capIdx, mark)
        }
      }

      // For multi-jump: highlight intermediate squares with numbered badges
      const hopBadgeEls: HTMLDivElement[] = []
      if (isMultiJump) {
        // All hops except the final destination get a number badge
        for (let i = 0; i < move.path.length - 1; i++) {
          const hopIdx = move.path[i]
          const hopEl = sqElForIdx(hopIdx)
          hopEl.classList.add('dr-path-hop')
          const badge = document.createElement('div')
          badge.className = 'dr-hop-badge'
          badge.textContent = String(i + 1)
          hopEl.appendChild(badge)
          hopBadgeEls.push(badge)
        }
      }

      // ---- Create the animated piece element ----
      const animPiece = document.createElement('div')
      animPiece.className = 'dr-anim-piece'
      const isLight = piece === 'light-man' || piece === 'light-king'
      animPiece.classList.add(isLight ? 'dr-piece-light' : 'dr-piece-dark')
      if (piece === 'light-king' || piece === 'dark-king') {
        animPiece.textContent = 'K'
      }

      // Position it at the source square (no transition yet)
      const startFrac = squareFraction(move.from)
      // The anim-piece is sized as one cell (10%) centered at the square center.
      // We use top-left corner positioning via translate.
      const cellPct = 10 // percent per cell
      const piecePct = cellPct * 0.76 // piece is 76% of cell

      function applyPosition(frac: { x: number; y: number }, withTransition: boolean): void {
        // Center of the square in percent, minus half the piece size
        const leftPct = frac.x * 100 - piecePct / 2
        const topPct = frac.y * 100 - piecePct / 2
        animPiece.style.transition = withTransition
          ? `left ${HOP_MS}ms ease-in-out, top ${HOP_MS}ms ease-in-out`
          : 'none'
        animPiece.style.left = `${leftPct}%`
        animPiece.style.top = `${topPct}%`
      }

      applyPosition(startFrac, false)
      boardWrap.appendChild(animPiece)

      // ---- Hop sequence ----

      const squares = [move.from, ...move.path]
      let hopIndex = 0

      function doNextHop(): void {
        if (hopIndex >= move.path.length) {
          // All hops done — clean up and commit
          cleanup()
          onDone()
          return
        }

        const destIdx = squares[hopIndex + 1]
        const capturedThisHop = hopsPerCapture[hopIndex]

        // Start transition to destination
        const destFrac = squareFraction(destIdx)
        applyPosition(destFrac, true)

        // After transition ends, fade out the captured piece and continue
        animPiece.addEventListener(
          'transitionend',
          () => {
            // Fade out captured piece for this hop
            if (capturedThisHop !== null) {
              const capPiece =
                sqElForIdx(capturedThisHop).querySelector<HTMLDivElement>('.dr-piece')
              if (capPiece) capPiece.classList.add('dr-fade-out')
              const mark = captureMarkEls.get(capturedThisHop)
              if (mark) mark.classList.add('dr-fade-out')
            }
            hopIndex++
            doNextHop()
          },
          { once: true },
        )
      }

      function cleanup(): void {
        // Remove animated piece
        animPiece.remove()

        // Restore hidden source piece visibility (render() will overwrite anyway)
        if (srcPieceEl) srcPieceEl.style.visibility = ''

        // Remove hop badges (fade them first, then remove after render)
        for (const badge of hopBadgeEls) {
          badge.classList.add('dr-fade-out')
          const el = badge
          setTimeout(() => el.remove(), 350)
        }

        // Remove capture marks
        for (const mark of captureMarkEls.values()) {
          mark.remove()
        }

        // Remove path-hop class from intermediate squares
        for (let i = 0; i < move.path.length - 1; i++) {
          sqElForIdx(move.path[i]).classList.remove('dr-path-hop')
        }

        animating = false
      }

      // Kick off the first hop on the next frame so the initial position
      // renders before we start the transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          doNextHop()
        })
      })
    }

    // ---- Render ----

    function render() {
      const win = winner(state)
      gameOver = win !== null
      allMoves = gameOver ? [] : legalMoves(state)

      // Determine which squares are selectable (pieces that have moves)
      const selectableFrom = new Set(allMoves.map((m) => m.from))
      // Destination squares for the selected piece
      const destSet = new Set(movesFromSelected.map((m) => m.path[m.path.length - 1]))

      // Update status
      statusEl.className = 'dr-status'
      if (win !== null) {
        const name = escapeHtml(win === 0 ? p0Name : p1Name)
        statusEl.innerHTML = `${name} wins!`
        statusEl.classList.add('dr-win')
      } else {
        const name = escapeHtml(state.turn === 0 ? p0Name : p1Name)
        const label = state.turn === 0 ? 'Light' : 'Dark'
        statusEl.innerHTML = `${name} (${label}) to move`
      }

      // Mid-jump note
      midJumpNote.textContent = state.midJump !== null ? 'Continue capturing — jump again!' : ''

      // Scores
      scoresEl.innerHTML = ''
      for (const p of [0, 1] as const) {
        const div = document.createElement('div')
        div.className = 'dr-score-item'
        div.setAttribute('data-piece', p === 0 ? 'light' : 'dark')
        if (!gameOver && state.turn === p) div.classList.add('dr-active-player')
        const nameSpan = document.createElement('span')
        nameSpan.className = 'dr-score-name'
        const pieceSwatch = document.createElement('span')
        pieceSwatch.className = 'dr-piece-swatch'
        // light pieces = ivory, dark pieces = red — match the actual piece colours
        pieceSwatch.style.background = p === 0 ? '#c8b89a' : '#c44'
        nameSpan.appendChild(pieceSwatch)
        nameSpan.appendChild(document.createTextNode(escapeHtml(p === 0 ? p0Name : p1Name)))
        const valSpan = document.createElement('span')
        valSpan.className = 'dr-score-val'
        valSpan.textContent = `${capturedByPlayer[p]} captured`
        div.appendChild(nameSpan)
        div.appendChild(valSpan)
        scoresEl.appendChild(div)
      }

      // Update all squares
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          const sqEl = sqEls[row * 10 + col]
          const isDark = (row + col) % 2 === 1
          if (!isDark) continue

          const idx = rowColToIdx(row, col)
          const piece = state.board[idx]

          // Reset classes
          sqEl.classList.remove('dr-selectable', 'dr-selected', 'dr-dest')

          // Clear children
          while (sqEl.firstChild) sqEl.removeChild(sqEl.firstChild)

          // Add piece element if present
          if (piece !== null) {
            const pieceEl = document.createElement('div')
            pieceEl.className = 'dr-piece'
            const isLight = piece === 'light-man' || piece === 'light-king'
            pieceEl.classList.add(isLight ? 'dr-piece-light' : 'dr-piece-dark')
            if (piece === 'light-king' || piece === 'dark-king') {
              pieceEl.textContent = 'K'
            }
            sqEl.appendChild(pieceEl)
          }

          // Apply state classes
          if (idx === selectedIdx) {
            sqEl.classList.add('dr-selected')
          } else if (destSet.has(idx)) {
            sqEl.classList.add('dr-dest')
          } else if (!gameOver && selectableFrom.has(idx)) {
            sqEl.classList.add('dr-selectable')
          }
        }
      }
    }

    // ---- Interaction ----

    function handleSquareClick(e: Event) {
      if (gameOver || animating) return
      const target = e.currentTarget as HTMLDivElement
      const idxStr = target.dataset.idx
      if (idxStr === undefined) return
      const idx = Number(idxStr)

      const selectableFrom = new Set(allMoves.map((m) => m.from))
      const destSet = new Set(movesFromSelected.map((m) => m.path[m.path.length - 1]))

      if (selectedIdx !== null && destSet.has(idx)) {
        // Execute the move to this destination
        const move = movesFromSelected.find((m) => m.path[m.path.length - 1] === idx)
        if (move === undefined) return

        // Track captures
        capturedByPlayer[state.turn] += move.captured.length

        // Deselect and clear path lines before animating
        selectedIdx = null
        movesFromSelected = []
        clearPathLines()

        // Animate all moves: quiet single-step uses a shorter 200 ms duration,
        // captures keep the existing 250 ms per-hop timing.
        const moveToApply = move
        const hopMs = move.captured.length > 0 ? 250 : 200
        render() // render the "in-progress" board (piece still at source, no selection)
        animateMove(moveToApply, hopMs, () => {
          state = applyMove(state, moveToApply)
          render()
        })
        return
      }

      if (selectableFrom.has(idx)) {
        // Select this piece; draw path lines showing all routes to legal destinations
        selectedIdx = idx
        movesFromSelected = allMoves.filter((m) => m.from === idx)
        render()
        drawPathLines(movesFromSelected)
        return
      }

      // Clicked on empty/unselectable square: deselect and clear path lines
      if (state.midJump === null) {
        selectedIdx = null
        movesFromSelected = []
        clearPathLines()
        render()
      }
    }

    // Wire click events to dark squares
    for (const sq of sqEls) {
      if (sq.classList.contains('dr-dark-sq')) {
        sq.addEventListener('click', handleSquareClick)
      }
    }

    function handleNewGame() {
      state = initialState()
      selectedIdx = null
      movesFromSelected = []
      allMoves = []
      capturedByPlayer = [0, 0]
      gameOver = false
      animating = false
      clearPathLines()
      render()
    }

    newGameBtn.addEventListener('click', handleNewGame)
    exitBtn.addEventListener('click', ctx.onExit)

    // Mount
    root.appendChild(style)
    root.appendChild(wrap)

    // Initial render
    allMoves = legalMoves(state)
    render()

    // Cleanup
    return () => {
      style.remove()
      wrap.remove()
    }
  },
}

export default game
