import type { GameModule } from '../../lib/game'
import meta from './meta'

// ── Types ────────────────────────────────────────────────────────────────────

type Symbol = 'X' | 'O'
type Cell = Symbol | null

// Flat 36-element array; index = row * 6 + col
type Board = Cell[]

type Phase = 'playing' | 'order-wins' | 'chaos-wins'

interface State {
  board: Board
  // 0 = Order (ctx.players[0]), 1 = Chaos (ctx.players[1])
  currentPlayer: 0 | 1
  // The symbol the current player intends to place (toggled before confirming)
  pendingSymbol: Symbol
  // The cell index the current player has tapped (null = none selected)
  selectedCell: number | null
  phase: Phase
  winLine: number[] | null // indices of the 5 winning cells, if any
}

// ── Pure logic ───────────────────────────────────────────────────────────────

const BOARD_SIZE = 6
const WIN_LENGTH = 5

function emptyBoard(): Board {
  return Array.from<Cell>({ length: BOARD_SIZE * BOARD_SIZE }).fill(null)
}

function initialState(): State {
  return {
    board: emptyBoard(),
    currentPlayer: 0,
    pendingSymbol: 'X',
    selectedCell: null,
    phase: 'playing',
    winLine: null,
  }
}

/** Returns the indices of the first five-in-a-row found, or null. */
function findFiveInARow(board: Board): number[] | null {
  // Directions: right, down, diagonal-down-right, diagonal-down-left
  const directions: [number, number][] = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ]

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const start = row * BOARD_SIZE + col
      const symbol = board[start]
      if (symbol === null) continue

      for (const [dr, dc] of directions) {
        const line: number[] = [start]
        for (let step = 1; step < WIN_LENGTH; step++) {
          const r = row + dr * step
          const c = col + dc * step
          if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break
          const idx = r * BOARD_SIZE + c
          if (board[idx] !== symbol) break
          line.push(idx)
        }
        if (line.length === WIN_LENGTH) return line
      }
    }
  }
  return null
}

function isBoardFull(board: Board): boolean {
  return board.every((cell) => cell !== null)
}

/** Place a symbol and compute the resulting phase. Pure — returns new state fields. */
function applyMove(
  board: Board,
  index: number,
  symbol: Symbol,
): Pick<State, 'board' | 'phase' | 'winLine'> {
  const next = board.slice()
  next[index] = symbol
  const winLine = findFiveInARow(next)
  if (winLine !== null) return { board: next, phase: 'order-wins', winLine }
  if (isBoardFull(next)) return { board: next, phase: 'chaos-wins', winLine: null }
  return { board: next, phase: 'playing', winLine: null }
}

// ── DOM helpers ──────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  )
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (HTMLElement | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v
    else e.setAttribute(k, v)
  }
  for (const child of children) {
    if (typeof child === 'string') e.appendChild(document.createTextNode(child))
    else e.appendChild(child)
  }
  return e
}

// ── Rendering ────────────────────────────────────────────────────────────────

function renderGame(
  root: HTMLElement,
  ctx: { players: readonly string[]; onExit: () => void },
): () => void {
  let state = initialState()

  // ── Outer container ──────────────────────────────────────────────────────
  const container = el('div', { class: 'oc-container' })
  root.appendChild(container)

  // ── Status bar ───────────────────────────────────────────────────────────
  const statusBar = el('div', { class: 'oc-status' })
  container.appendChild(statusBar)

  // ── Symbol chooser ───────────────────────────────────────────────────────
  const symbolBar = el('div', { class: 'oc-symbol-bar' })
  const labelChoose = el('span', { class: 'oc-symbol-label' }, 'Place:')
  const btnX = el('button', { type: 'button', class: 'oc-sym-btn oc-sym-x', 'data-sym': 'X' }, 'X')
  const btnO = el('button', { type: 'button', class: 'oc-sym-btn oc-sym-o', 'data-sym': 'O' }, 'O')
  symbolBar.appendChild(labelChoose)
  symbolBar.appendChild(btnX)
  symbolBar.appendChild(btnO)
  container.appendChild(symbolBar)

  // ── Board ─────────────────────────────────────────────────────────────────
  const boardEl = el('div', {
    class: 'oc-board',
    role: 'grid',
    'aria-label': 'Order and Chaos board',
  })
  container.appendChild(boardEl)

  const cellEls: HTMLButtonElement[] = []
  for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
    const cellBtn = el('button', {
      type: 'button',
      class: 'oc-cell',
      'aria-label': `row ${Math.floor(i / BOARD_SIZE) + 1} col ${(i % BOARD_SIZE) + 1}`,
      'data-idx': String(i),
    })
    boardEl.appendChild(cellBtn)
    cellEls.push(cellBtn)
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  const actionBar = el('div', { class: 'oc-actions' })
  const btnConfirm = el('button', { type: 'button', class: 'oc-btn-confirm' }, 'Confirm')
  const btnNew = el('button', { type: 'button', class: 'oc-btn-new' }, 'New game')
  const btnExit = el('button', { type: 'button', class: 'oc-btn-exit' }, 'Exit')
  actionBar.appendChild(btnConfirm)
  actionBar.appendChild(btnNew)
  actionBar.appendChild(btnExit)
  container.appendChild(actionBar)

  // ── Event handlers ────────────────────────────────────────────────────────

  function handleCellClick(e: Event) {
    if (state.phase !== 'playing') return
    const btn = (e.currentTarget ?? e.target) as HTMLButtonElement
    const idx = Number(btn.dataset.idx)
    if (state.board[idx] !== null) return

    if (state.selectedCell === idx) {
      // Second tap on same cell = deselect
      state = { ...state, selectedCell: null }
    } else {
      state = { ...state, selectedCell: idx }
    }
    render()
  }

  function handleSymbolClick(e: Event) {
    if (state.phase !== 'playing') return
    const btn = e.currentTarget as HTMLButtonElement
    const sym = btn.dataset.sym as Symbol
    state = { ...state, pendingSymbol: sym }
    render()
  }

  function handleConfirm() {
    if (state.phase !== 'playing' || state.selectedCell === null) return
    const { board, phase, winLine } = applyMove(
      state.board,
      state.selectedCell,
      state.pendingSymbol,
    )
    const nextPlayer: 0 | 1 = state.currentPlayer === 0 ? 1 : 0
    state = {
      ...state,
      board,
      phase,
      winLine,
      selectedCell: null,
      currentPlayer: phase === 'playing' ? nextPlayer : state.currentPlayer,
    }
    render()
  }

  function handleNew() {
    state = initialState()
    render()
  }

  // ── Attach listeners ──────────────────────────────────────────────────────
  for (const cellBtn of cellEls) {
    cellBtn.addEventListener('click', handleCellClick)
  }
  btnX.addEventListener('click', handleSymbolClick)
  btnO.addEventListener('click', handleSymbolClick)
  btnConfirm.addEventListener('click', handleConfirm)
  btnNew.addEventListener('click', handleNew)
  btnExit.addEventListener('click', ctx.onExit)

  // ── Render ────────────────────────────────────────────────────────────────

  function render() {
    const { board, currentPlayer, pendingSymbol, selectedCell, phase, winLine } = state
    const orderName = escapeHtml(ctx.players[0])
    const chaosName = escapeHtml(ctx.players[1])

    // Status bar
    if (phase === 'order-wins') {
      statusBar.innerHTML = `<strong class="oc-winner">${orderName} (Order) wins!</strong> Five-in-a-row achieved.`
    } else if (phase === 'chaos-wins') {
      statusBar.innerHTML = `<strong class="oc-winner">${chaosName} (Chaos) wins!</strong> Board full — no five-in-a-row.`
    } else {
      const name = currentPlayer === 0 ? orderName : chaosName
      const role = currentPlayer === 0 ? 'Order' : 'Chaos'
      const goal =
        currentPlayer === 0
          ? 'goal: get five-in-a-row'
          : 'goal: fill the board without five-in-a-row'
      statusBar.innerHTML = `<strong>${name}</strong> (${role}) &mdash; ${goal}`
    }

    // Symbol buttons
    btnX.classList.toggle('oc-sym-active', pendingSymbol === 'X')
    btnO.classList.toggle('oc-sym-active', pendingSymbol === 'O')
    symbolBar.style.visibility = phase === 'playing' ? 'visible' : 'hidden'

    // Confirm button
    btnConfirm.disabled = phase !== 'playing' || selectedCell === null

    // Cell rendering
    const winSet = new Set(winLine ?? [])
    for (let i = 0; i < cellEls.length; i++) {
      const cellEl = cellEls[i]
      const content = board[i]
      const isSelected = selectedCell === i
      const isWin = winSet.has(i)
      const isEmpty = content === null

      cellEl.disabled = !isEmpty || phase !== 'playing'
      cellEl.textContent = isSelected && content === null ? pendingSymbol : (content ?? '')

      cellEl.className = 'oc-cell'
      if (isSelected) cellEl.classList.add('oc-cell-selected')
      if (isWin) cellEl.classList.add('oc-cell-win')
      if (content === 'X') cellEl.classList.add('oc-cell-x')
      if (content === 'O') cellEl.classList.add('oc-cell-o')
      if (isSelected && content === null) {
        cellEl.classList.add(pendingSymbol === 'X' ? 'oc-cell-x' : 'oc-cell-o')
        cellEl.classList.add('oc-cell-preview')
      }
    }
  }

  render()

  // ── Inline styles ─────────────────────────────────────────────────────────
  // Scoped CSS injected as a <style> tag so the game is self-contained.
  const style = document.createElement('style')
  style.textContent = `
    .oc-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
    }

    .oc-status {
      font-size: 1.1rem;
      text-align: center;
      min-height: 2em;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .oc-winner {
      color: var(--accent);
    }

    .oc-symbol-bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .oc-symbol-label {
      color: var(--fg-dim);
    }

    .oc-sym-btn {
      width: 3rem;
      height: 3rem;
      font-size: 1.4rem;
      font-weight: 700;
      border: 2px solid transparent;
      border-radius: var(--radius);
      background: var(--bg-elev);
      cursor: pointer;
      transition: border-color 0.1s, background 0.1s;
    }

    .oc-sym-btn.oc-sym-active {
      border-color: var(--accent);
      background: color-mix(in srgb, var(--accent) 15%, var(--bg-elev));
    }

    .oc-sym-x { color: #ff9f6b; }
    .oc-sym-o { color: #6bcfff; }

    .oc-board {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 4px;
      /* Tablet-first: board fills available space up to a comfortable size */
      width: min(90vw, 85vh, 560px);
      height: min(90vw, 85vh, 560px);
    }

    .oc-cell {
      aspect-ratio: 1;
      font-size: clamp(1rem, 4vw, 2rem);
      font-weight: 700;
      border: 2px solid #2a2f38;
      border-radius: 8px;
      background: var(--bg-elev);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.1s, background 0.1s;
      padding: 0;
      width: 100%;
    }

    .oc-cell:disabled:not(.oc-cell-win) {
      cursor: not-allowed;
    }

    .oc-cell-x { color: #ff9f6b; }
    .oc-cell-o { color: #6bcfff; }

    .oc-cell-selected {
      border-color: var(--accent);
      background: color-mix(in srgb, var(--accent) 10%, var(--bg-elev));
    }

    .oc-cell-preview {
      opacity: 0.7;
    }

    .oc-cell-win {
      border-color: #ffd700;
      background: color-mix(in srgb, #ffd700 20%, var(--bg-elev));
    }

    .oc-actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      justify-content: center;
    }

    .oc-btn-confirm {
      background: var(--accent);
      color: var(--bg);
      font-weight: 700;
      border: none;
      padding: 0.6em 1.4em;
    }

    .oc-btn-confirm:disabled {
      background: var(--bg-elev);
      color: var(--fg-dim);
    }

    .oc-btn-new, .oc-btn-exit {
      background: var(--bg-elev);
      border: 1px solid #2a2f38;
    }
  `
  document.head.appendChild(style)

  // ── Cleanup ───────────────────────────────────────────────────────────────
  return () => {
    container.remove()
    style.remove()
  }
}

// ── GameModule ────────────────────────────────────────────────────────────────

const game: GameModule = {
  ...meta,
  mount(root, ctx) {
    return renderGame(root, ctx)
  },
}

export default game
