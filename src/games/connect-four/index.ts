import type { GameModule } from '../../lib/game'
import meta from './meta'

// ---------------------------------------------------------------------------
// Board constants
// ---------------------------------------------------------------------------

const COLS = 7
const ROWS = 6

// ---------------------------------------------------------------------------
// Pure game logic — no DOM dependencies; could be reused by an AI opponent
// ---------------------------------------------------------------------------

type Cell = 0 | 1 | 2 // 0 = empty, 1 = player 1, 2 = player 2
type Board = Cell[][]

/** Create an empty ROWS×COLS board (row 0 = top). */
function createBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(0))
}

/**
 * Return the row index where a disc lands in the given column,
 * or -1 if the column is full.
 */
function dropRow(board: Board, col: number): number {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][col] === 0) return row
  }
  return -1
}

/**
 * Drop a disc for `player` into `col`.
 * Returns a new board and the row the disc landed on,
 * or null if the column is full.
 */
function drop(board: Board, col: number, player: 1 | 2): { board: Board; row: number } | null {
  const row = dropRow(board, col)
  if (row === -1) return null
  const next = board.map((r) => r.slice() as Cell[])
  next[row][col] = player
  return { board: next, row }
}

/**
 * Check whether `player` has four in a row anywhere on the board.
 * Returns the winning cells as [row, col] pairs, or null.
 */
function checkWin(board: Board, player: 1 | 2): [number, number][] | null {
  const directions: [number, number][] = [
    [0, 1], // horizontal
    [1, 0], // vertical
    [1, 1], // diagonal ↘
    [1, -1], // diagonal ↙
  ]

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (board[row][col] !== player) continue
      for (const [dr, dc] of directions) {
        const cells: [number, number][] = [[row, col]]
        for (let k = 1; k < 4; k++) {
          const r = row + dr * k
          const c = col + dc * k
          if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== player) break
          cells.push([r, c])
        }
        if (cells.length === 4) return cells
      }
    }
  }
  return null
}

/** True when no empty cells remain. */
function isBoardFull(board: Board): boolean {
  return board[0].every((cell) => cell !== 0)
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

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (HTMLElement | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  for (const child of children) {
    if (typeof child === 'string') node.appendChild(document.createTextNode(child))
    else node.appendChild(child)
  }
  return node
}

// ---------------------------------------------------------------------------
// Styles (scoped to .cf-root)
// ---------------------------------------------------------------------------

const CSS = `
.cf-root {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem 0.5rem;
}

.cf-status {
  font-size: 1.1rem;
  font-weight: 600;
  min-height: 1.6em;
  text-align: center;
}

.cf-status[data-winner="1"] { color: var(--cf-p1); }
.cf-status[data-winner="2"] { color: var(--cf-p2); }

.cf-board-wrap {
  /* CSS custom properties for player colours */
  --cf-p1: #ef4444;
  --cf-p2: #facc15;
  --cf-empty: #1e2330;
  --cf-board-bg: #2563eb;
  --cf-cell: clamp(40px, 11vw, 80px);

  display: inline-block;
  background: var(--cf-board-bg);
  border-radius: 12px;
  padding: 8px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.5);
  /* Clip the drop animation to the board area */
  position: relative;
  overflow: hidden;
}

.cf-grid {
  display: grid;
  grid-template-columns: repeat(7, var(--cf-cell));
  grid-template-rows: repeat(6, var(--cf-cell));
  gap: 6px;
}

/* Each column is a clickable target that spans all rows */
.cf-col {
  display: contents;
}

.cf-col-btn {
  display: contents;
  cursor: pointer;
}

/* Cells are plain divs; they sit inside the grid */
.cf-cell {
  width: var(--cf-cell);
  height: var(--cf-cell);
  border-radius: 50%;
  background: var(--cf-empty);
  transition: background 0.1s;
  pointer-events: none; /* column button handles clicks */
}

.cf-cell[data-player="1"] { background: var(--cf-p1); }
.cf-cell[data-player="2"] { background: var(--cf-p2); }
.cf-cell[data-win="true"] {
  box-shadow: 0 0 0 3px #fff, 0 0 0 5px currentColor;
  /* currentColor picks up the parent's colour via the cascade */
}
.cf-cell[data-win="true"][data-player="1"] { color: var(--cf-p1); }
.cf-cell[data-win="true"][data-player="2"] { color: var(--cf-p2); }

/* Hover hint: highlight the whole column */
.cf-col-btn:not([disabled]):hover .cf-cell[data-player="0"],
.cf-col-btn:not([disabled]):focus-visible .cf-cell[data-player="0"] {
  background: #2e3650;
}

.cf-col-btn[disabled] {
  cursor: default;
}

/* The invisible button overlay for each column */
.cf-col-tap {
  /* Stretches over all 6 rows in its column via grid placement */
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  border-radius: 8px;
  cursor: pointer;
  /* The button itself is invisible; the cells inside show visually */
}
.cf-col-tap:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.cf-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}

.cf-btn {
  padding: 0.55em 1.2em;
  border-radius: 8px;
  border: 1px solid transparent;
  background: var(--bg-elev, #1a1d24);
  color: var(--fg, #e6e6e6);
  font: inherit;
  cursor: pointer;
  font-size: 0.95rem;
}
.cf-btn:hover { border-color: var(--accent, #6cb1ff); }

/* Animated disc that drops from top to final cell */
.cf-drop-disc {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  /* Hardware-accelerated slide with ease-in to mimic gravity */
  transition: transform 250ms ease-in;
  z-index: 10;
}
`

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

const game: GameModule = {
  ...meta,

  mount(root, ctx) {
    // Inject scoped styles once
    const styleEl = document.createElement('style')
    styleEl.textContent = CSS
    document.head.appendChild(styleEl)

    // State
    let board = createBoard()
    let currentPlayer: 1 | 2 = 1
    let gameOver = false

    // Build skeleton DOM
    const wrapper = el('div', { class: 'cf-root' })

    const statusEl = el('div', { class: 'cf-status' })

    // Board: a flat CSS grid containing 7 column-button overlays,
    // each wrapping its 6 cells stacked via grid placement.
    const boardWrap = el('div', { class: 'cf-board-wrap' })
    const grid = el('div', { class: 'cf-grid' })
    boardWrap.appendChild(grid)

    // cellEls[row][col] -> the visual disc element
    const cellEls: HTMLDivElement[][] = Array.from({ length: ROWS }, () =>
      Array<HTMLDivElement>(COLS),
    )

    // Column tap buttons sit in the grid, spanning all 6 rows
    const colBtns: HTMLButtonElement[] = []

    for (let col = 0; col < COLS; col++) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'cf-col-tap'
      btn.setAttribute('aria-label', `Drop in column ${col + 1}`)
      // Place this button in the grid: column col+1, rows 1–6
      btn.style.gridColumn = `${col + 1}`
      btn.style.gridRow = `1 / ${ROWS + 1}`
      // The button must be transparent / zero-size visually but capture clicks
      // We achieve this by giving it full size via grid but z-index above cells
      btn.style.zIndex = '1'
      btn.addEventListener('click', () => handleColClick(col))
      colBtns.push(btn)
    }

    // Cell divs, placed into the grid before the buttons (so buttons are on top)
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const cell = document.createElement('div')
        cell.className = 'cf-cell'
        cell.dataset.player = '0'
        cell.style.gridColumn = `${col + 1}`
        cell.style.gridRow = `${row + 1}`
        cellEls[row][col] = cell
        grid.appendChild(cell)
      }
    }

    // Buttons go after cells in DOM so they sit on top via stacking context
    for (const btn of colBtns) {
      grid.appendChild(btn)
    }

    const actionsEl = el('div', { class: 'cf-actions' })
    const newGameBtn = el('button', { class: 'cf-btn', type: 'button' }, 'New game')
    const exitBtn = el('button', { class: 'cf-btn', type: 'button' }, 'Back to menu')
    actionsEl.appendChild(newGameBtn)
    actionsEl.appendChild(exitBtn)

    wrapper.appendChild(statusEl)
    wrapper.appendChild(boardWrap)
    wrapper.appendChild(actionsEl)
    root.appendChild(wrapper)

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    function renderBoard(winCells: [number, number][] | null = null): void {
      const winSet = new Set(winCells?.map(([r, c]) => `${r},${c}`) ?? [])
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const cell = cellEls[row][col]
          const player = board[row][col]
          cell.dataset.player = String(player)
          cell.dataset.win = winSet.has(`${row},${col}`) ? 'true' : 'false'
        }
      }
    }

    function renderStatus(winCells: [number, number][] | null = null): void {
      if (winCells) {
        const winner = board[winCells[0][0]][winCells[0][1]] as 1 | 2
        const name = escapeHtml(ctx.players[winner - 1])
        statusEl.innerHTML = `${name} wins!`
        statusEl.setAttribute('data-winner', String(winner))
      } else if (isBoardFull(board)) {
        statusEl.textContent = "It's a draw!"
        statusEl.removeAttribute('data-winner')
      } else {
        const name = escapeHtml(ctx.players[currentPlayer - 1])
        statusEl.innerHTML = `${name}'s turn`
        statusEl.removeAttribute('data-winner')
      }
    }

    function setColBtnsDisabled(disabled: boolean): void {
      for (const btn of colBtns) {
        if (disabled) {
          btn.setAttribute('disabled', '')
        } else {
          btn.removeAttribute('disabled')
        }
      }
    }

    function render(winCells: [number, number][] | null = null): void {
      renderBoard(winCells)
      renderStatus(winCells)
      setColBtnsDisabled(gameOver)
    }

    // ---------------------------------------------------------------------------
    // Drop animation
    // ---------------------------------------------------------------------------

    // Whether an animation is currently running — blocks input during the drop.
    let animating = false

    /**
     * Animate a disc dropping from the top of `col` to `landRow`, then call
     * `onDone` when the transition finishes.
     *
     * The animated element is a temporary absolutely-positioned div placed over
     * the board. On transitionend we remove it and commit the final state.
     */
    function animateDrop(col: number, landRow: number, player: 1 | 2, onDone: () => void): void {
      const CELL_SIZE = cellEls[0][0].getBoundingClientRect().width
      const GAP = 6
      const PADDING = 8

      // Top-left of the first cell in the column (row=0)
      const topCell = cellEls[0][col]
      const wrapRect = boardWrap.getBoundingClientRect()
      const cellRect = topCell.getBoundingClientRect()

      // Position relative to boardWrap (which has position:relative)
      const startX = cellRect.left - wrapRect.left
      const startY = -(CELL_SIZE + PADDING) // just above the board

      // Destination y inside the board
      const destY = PADDING + landRow * (CELL_SIZE + GAP)

      const disc = document.createElement('div')
      disc.className = 'cf-drop-disc'
      disc.style.width = `${CELL_SIZE}px`
      disc.style.height = `${CELL_SIZE}px`
      disc.style.background = player === 1 ? 'var(--cf-p1)' : 'var(--cf-p2)'
      disc.style.left = `${startX}px`
      disc.style.top = `${startY}px`
      boardWrap.appendChild(disc)

      // Force layout so the initial position is painted before the transition starts
      disc.getBoundingClientRect()

      const deltaY = destY - startY
      disc.style.transform = `translateY(${deltaY}px)`

      disc.addEventListener(
        'transitionend',
        () => {
          disc.remove()
          onDone()
        },
        { once: true },
      )
    }

    // ---------------------------------------------------------------------------
    // Game logic
    // ---------------------------------------------------------------------------

    function handleColClick(col: number): void {
      if (gameOver || animating) return

      const result = drop(board, col, currentPlayer)
      if (!result) return // column full

      animating = true
      setColBtnsDisabled(true)

      animateDrop(col, result.row, currentPlayer, () => {
        animating = false
        board = result.board

        const winCells = checkWin(board, currentPlayer)
        if (winCells || isBoardFull(board)) {
          gameOver = true
          render(winCells)
          return
        }

        currentPlayer = currentPlayer === 1 ? 2 : 1
        render()
      })
    }

    function startNewGame(): void {
      board = createBoard()
      currentPlayer = 1
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
