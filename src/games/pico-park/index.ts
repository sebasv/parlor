import type { GameModule } from '../../lib/game'
import { LEVELS, type LevelDef } from './levels'
import meta from './meta'
import {
  CHAR_H,
  CHAR_W,
  type CharState,
  overlaps,
  type PhysicsInput,
  type Rect,
  stepChar,
  TILE,
  tileAt,
} from './physics'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIXED_DT = 1 / 60 // physics tick in seconds
const DOOR_TILE = 'D'
const PLATE_TILE = 'P'
const GOAL_TILE = 'G'

// Player colour palette (index matches player 0/1)
const PLAYER_COLORS = ['#6cb1ff', '#ff6b6b'] as const
const PLAYER_DARK = ['#3a7fc7', '#c74040'] as const

// ---------------------------------------------------------------------------
// Level parsing helpers
// ---------------------------------------------------------------------------

interface LevelState {
  def: LevelDef
  // Mutable working copy of the grid (for door toggling)
  grid: string[]
  plateActive: boolean
}

interface SpawnPos {
  x: number
  y: number
}

function findSpawns(grid: readonly string[]): [SpawnPos, SpawnPos] {
  const spawns: SpawnPos[] = []
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const ch = grid[r][c]
      if (ch === '1' || ch === '2') {
        spawns[ch === '1' ? 0 : 1] = { x: c * TILE + (TILE - CHAR_W) / 2, y: r * TILE }
      }
    }
  }
  if (!spawns[0] || !spawns[1]) {
    throw new Error('Level missing spawn tiles 1 and/or 2')
  }
  return [spawns[0], spawns[1]]
}

/** Return grid with spawn tiles replaced by '.' */
function cleanGrid(grid: readonly string[]): string[] {
  return grid.map((row) => row.replace(/[12]/g, '.'))
}

// ---------------------------------------------------------------------------
// Pressure plate / door logic
// ---------------------------------------------------------------------------

/**
 * Returns true when any character rect overlaps a plate tile in the grid.
 */
function isPlatePressed(grid: string[], chars: CharState[]): boolean {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] !== PLATE_TILE) continue
      const plateRect: Rect = { x: c * TILE, y: r * TILE, w: TILE, h: TILE }
      for (const char of chars) {
        const charRect: Rect = { x: char.x, y: char.y, w: CHAR_W, h: CHAR_H }
        if (overlaps(charRect, plateRect)) return true
      }
    }
  }
  return false
}

/** Check if both characters are on goal tiles. */
function bothOnGoal(grid: string[], chars: CharState[]): boolean {
  return chars.every((char) => {
    const feet: Rect = { x: char.x + 4, y: char.y + CHAR_H - 4, w: CHAR_W - 8, h: 8 }
    const c0 = Math.floor(feet.x / TILE)
    const c1 = Math.floor((feet.x + feet.w - 1) / TILE)
    const r0 = Math.floor(feet.y / TILE)
    const r1 = Math.floor((feet.y + feet.h - 1) / TILE)
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (tileAt(grid, c, r) === GOAL_TILE) return true
      }
    }
    return false
  })
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderFrame(
  ctx2d: CanvasRenderingContext2D,
  level: LevelState,
  chars: CharState[],
  playerNames: readonly string[],
  plateActive: boolean,
  levelIndex: number,
  won: boolean,
): void {
  const { grid } = level
  const w = ctx2d.canvas.width
  const h = ctx2d.canvas.height

  // Background
  ctx2d.fillStyle = '#0f1115'
  ctx2d.fillRect(0, 0, w, h)

  // Tiles
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const ch = grid[r][c]
      const px = c * TILE
      const py = r * TILE
      if (ch === '#') {
        ctx2d.fillStyle = '#2a3550'
        ctx2d.fillRect(px, py, TILE, TILE)
        // Highlight top edge
        ctx2d.fillStyle = '#3a4d72'
        ctx2d.fillRect(px, py, TILE, 3)
      } else if (ch === DOOR_TILE) {
        ctx2d.fillStyle = plateActive ? '#1a3020' : '#5a2020'
        ctx2d.fillRect(px, py, TILE, TILE)
        // Door bars
        ctx2d.fillStyle = plateActive ? '#2a7040' : '#c04040'
        for (let bar = 0; bar < 3; bar++) {
          ctx2d.fillRect(px + 4 + bar * 9, py + 2, 5, TILE - 4)
        }
      } else if (ch === PLATE_TILE) {
        // Platform + plate marker
        ctx2d.fillStyle = '#2a3550'
        ctx2d.fillRect(px, py + TILE - 8, TILE, 8)
        ctx2d.fillStyle = plateActive ? '#80ff80' : '#ffaa20'
        ctx2d.fillRect(px + 4, py + TILE - 7, TILE - 8, 6)
      } else if (ch === GOAL_TILE) {
        ctx2d.fillStyle = '#1a2a1a'
        ctx2d.fillRect(px, py, TILE, TILE)
        // Star / goal indicator
        ctx2d.fillStyle = '#ffd700'
        ctx2d.beginPath()
        const cx = px + TILE / 2
        const cy = py + TILE / 2
        for (let i = 0; i < 5; i++) {
          const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2
          const rx = cx + Math.cos(angle) * 10
          const ry = cy + Math.sin(angle) * 10
          if (i === 0) ctx2d.moveTo(rx, ry)
          else ctx2d.lineTo(rx, ry)
        }
        ctx2d.closePath()
        ctx2d.fill()
      }
    }
  }

  // Characters
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]
    const px = Math.round(char.x)
    const py = Math.round(char.y)
    // Body
    ctx2d.fillStyle = PLAYER_COLORS[i]
    ctx2d.beginPath()
    ctx2d.roundRect(px, py, CHAR_W, CHAR_H, 6)
    ctx2d.fill()
    // Darker bottom strip (feet)
    ctx2d.fillStyle = PLAYER_DARK[i]
    ctx2d.fillRect(px + 2, py + CHAR_H - 8, CHAR_W - 4, 6)
    // Eyes
    ctx2d.fillStyle = '#fff'
    ctx2d.fillRect(px + 5, py + 7, 6, 6)
    ctx2d.fillRect(px + 15, py + 7, 6, 6)
    ctx2d.fillStyle = '#111'
    ctx2d.fillRect(px + 7, py + 9, 3, 3)
    ctx2d.fillRect(px + 17, py + 9, 3, 3)
    // Label
    ctx2d.fillStyle = '#fff'
    ctx2d.font = 'bold 9px system-ui'
    ctx2d.textAlign = 'center'
    ctx2d.fillText(playerNames[i].charAt(0).toUpperCase(), px + CHAR_W / 2, py - 4)
  }

  // HUD — level name
  ctx2d.fillStyle = 'rgba(0,0,0,0.5)'
  ctx2d.fillRect(0, 0, w, 28)
  ctx2d.fillStyle = '#e6e6e6'
  ctx2d.font = 'bold 13px system-ui'
  ctx2d.textAlign = 'center'
  ctx2d.fillText(`Level ${levelIndex + 1}: ${level.def.name}`, w / 2, 18)

  // Hint text at the bottom HUD strip
  ctx2d.fillStyle = 'rgba(0,0,0,0.4)'
  ctx2d.fillRect(0, h - 24, w, 24)
  ctx2d.fillStyle = '#9aa0a6'
  ctx2d.font = '11px system-ui'
  ctx2d.textAlign = 'center'
  ctx2d.fillText(level.def.hint, w / 2, h - 8)

  // Win overlay
  if (won) {
    ctx2d.fillStyle = 'rgba(0,0,0,0.6)'
    ctx2d.fillRect(0, 0, w, h)
    ctx2d.fillStyle = '#ffd700'
    ctx2d.font = 'bold 36px system-ui'
    ctx2d.textAlign = 'center'
    ctx2d.fillText('Level Clear!', w / 2, h / 2 - 16)
    ctx2d.fillStyle = '#e6e6e6'
    ctx2d.font = '18px system-ui'
    ctx2d.fillText('Both players reached the goal', w / 2, h / 2 + 18)
  }
}

// ---------------------------------------------------------------------------
// Input overlay rendering (touch controls)
// ---------------------------------------------------------------------------

interface TouchButton {
  label: string
  x: number
  y: number
  w: number
  h: number
  action: 'left' | 'right' | 'jump'
  player: 0 | 1
}

function buildTouchButtons(canvasW: number, canvasH: number): TouchButton[] {
  // Controls are rendered in the bottom portion of each half.
  // Left half = player 0, right half = player 1.

  const halfW = canvasW / 2
  const btnH = 72
  const btnW = 72
  const margin = 12
  const bottomY = canvasH - btnH - margin

  const buttons: TouchButton[] = []

  for (let p = 0 as 0 | 1; p <= 1; p = (p + 1) as 0 | 1) {
    const offsetX = p === 0 ? 0 : halfW

    // Left arrow
    buttons.push({
      label: '<',
      x: offsetX + margin,
      y: bottomY,
      w: btnW,
      h: btnH,
      action: 'left',
      player: p,
    })
    // Right arrow
    buttons.push({
      label: '>',
      x: offsetX + margin + btnW + 8,
      y: bottomY,
      w: btnW,
      h: btnH,
      action: 'right',
      player: p,
    })
    // Jump (rightmost in each half)
    buttons.push({
      label: 'UP',
      x: offsetX + halfW - margin - btnW,
      y: bottomY,
      w: btnW,
      h: btnH,
      action: 'jump',
      player: p,
    })
  }

  return buttons
}

function renderTouchControls(
  ctx2d: CanvasRenderingContext2D,
  buttons: TouchButton[],
  activeButtons: Set<string>,
): void {
  for (const btn of buttons) {
    const key = `${btn.player}-${btn.action}`
    const active = activeButtons.has(key)

    ctx2d.fillStyle = active ? 'rgba(108,177,255,0.5)' : 'rgba(255,255,255,0.12)'
    ctx2d.beginPath()
    ctx2d.roundRect(btn.x, btn.y, btn.w, btn.h, 10)
    ctx2d.fill()

    ctx2d.strokeStyle = active ? 'rgba(108,177,255,0.8)' : 'rgba(255,255,255,0.25)'
    ctx2d.lineWidth = 1.5
    ctx2d.beginPath()
    ctx2d.roundRect(btn.x, btn.y, btn.w, btn.h, 10)
    ctx2d.stroke()

    ctx2d.fillStyle = active ? '#fff' : 'rgba(255,255,255,0.7)'
    ctx2d.font = 'bold 20px system-ui'
    ctx2d.textAlign = 'center'
    ctx2d.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 7)
  }

  // Divider between left/right player areas
  const midX = ctx2d.canvas.width / 2
  const h = ctx2d.canvas.height
  ctx2d.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx2d.lineWidth = 1
  ctx2d.beginPath()
  ctx2d.moveTo(midX, 28)
  ctx2d.lineTo(midX, h)
  ctx2d.stroke()
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

const CSS = `
.pp-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  background: #0f1115;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pp-canvas-wrap {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
  justify-content: center;
}

.pp-canvas {
  display: block;
  touch-action: none;
  width: 100%;
  height: 100%;
  max-width: 100%;
}

.pp-actions {
  position: absolute;
  top: 32px;
  right: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 10;
}

.pp-btn {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(26,29,36,0.85);
  color: #e6e6e6;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.pp-btn:hover {
  border-color: #6cb1ff;
}

.pp-won-actions {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, 60px);
  display: flex;
  gap: 12px;
  z-index: 20;
}

.pp-won-actions.hidden {
  display: none;
}
`

const game: GameModule = {
  ...meta,

  mount(root, ctx) {
    // Inject styles
    const styleEl = document.createElement('style')
    styleEl.textContent = CSS
    document.head.appendChild(styleEl)

    // --- Outer wrapper
    const wrap = document.createElement('div')
    wrap.className = 'pp-wrap'

    const canvasWrap = document.createElement('div')
    canvasWrap.className = 'pp-canvas-wrap'

    const canvas = document.createElement('canvas')
    canvas.className = 'pp-canvas'
    canvasWrap.appendChild(canvas)

    // --- Action buttons (overlaid top-right)
    const actionsEl = document.createElement('div')
    actionsEl.className = 'pp-actions'

    const restartBtn = document.createElement('button')
    restartBtn.className = 'pp-btn'
    restartBtn.type = 'button'
    restartBtn.textContent = 'Restart'

    const exitBtn = document.createElement('button')
    exitBtn.className = 'pp-btn'
    exitBtn.type = 'button'
    exitBtn.textContent = 'Exit'

    actionsEl.appendChild(restartBtn)
    actionsEl.appendChild(exitBtn)

    // --- Won-state actions
    const wonActionsEl = document.createElement('div')
    wonActionsEl.className = 'pp-won-actions hidden'

    const nextBtn = document.createElement('button')
    nextBtn.className = 'pp-btn'
    nextBtn.type = 'button'
    nextBtn.textContent = 'Next Level'

    const wonRestartBtn = document.createElement('button')
    wonRestartBtn.className = 'pp-btn'
    wonRestartBtn.type = 'button'
    wonRestartBtn.textContent = 'Replay'

    const wonExitBtn = document.createElement('button')
    wonExitBtn.className = 'pp-btn'
    wonExitBtn.type = 'button'
    wonExitBtn.textContent = 'Exit'

    wonActionsEl.appendChild(nextBtn)
    wonActionsEl.appendChild(wonRestartBtn)
    wonActionsEl.appendChild(wonExitBtn)

    canvasWrap.appendChild(actionsEl)
    canvasWrap.appendChild(wonActionsEl)

    wrap.appendChild(canvasWrap)
    root.appendChild(wrap)

    const ctx2dRaw = canvas.getContext('2d')
    if (!ctx2dRaw) throw new Error('Could not get 2d context')
    const ctx2d: CanvasRenderingContext2D = ctx2dRaw

    // ---------------------------------------------------------------------------
    // Game state
    // ---------------------------------------------------------------------------

    let levelIndex = 0
    let chars: CharState[] = []
    let level: LevelState = buildLevel(levelIndex)
    let won = false
    let accumulated = 0 // for fixed timestep
    let buttons: TouchButton[] = []
    const activeButtons = new Set<string>()
    const inputs: PhysicsInput[] = [
      { left: false, right: false, jump: false },
      { left: false, right: false, jump: false },
    ]

    function buildLevel(idx: number): LevelState {
      const def = LEVELS[idx]
      if (!def) throw new Error(`No level at index ${idx}`)
      const grid = cleanGrid(def.grid)
      return { def, grid, plateActive: false }
    }

    function spawnChars(lvl: LevelState): CharState[] {
      const [s1, s2] = findSpawns(lvl.def.grid)
      return [
        { x: s1.x, y: s1.y, vx: 0, vy: 0, onGround: false },
        { x: s2.x, y: s2.y, vx: 0, vy: 0, onGround: false },
      ]
    }

    function startLevel(idx: number): void {
      levelIndex = idx
      level = buildLevel(idx)
      chars = spawnChars(level)
      won = false
      wonActionsEl.classList.add('hidden')
      nextBtn.style.display = LEVELS[idx + 1] ? '' : 'none'
      activeButtons.clear()
      inputs[0] = { left: false, right: false, jump: false }
      inputs[1] = { left: false, right: false, jump: false }
    }

    startLevel(0)

    // ---------------------------------------------------------------------------
    // Canvas sizing
    // ---------------------------------------------------------------------------

    function resize(): void {
      const rect = canvasWrap.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
      buttons = buildTouchButtons(canvas.width, canvas.height)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvasWrap)
    resize()

    // ---------------------------------------------------------------------------
    // Touch / pointer input
    // ---------------------------------------------------------------------------

    // Map pointerId -> button key for multi-touch tracking
    const pointerMap = new Map<number, string>()

    function hitButton(clientX: number, clientY: number): TouchButton | null {
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const x = (clientX - rect.left) * scaleX
      const y = (clientY - rect.top) * scaleY
      for (const btn of buttons) {
        if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
          return btn
        }
      }
      return null
    }

    function setButtonActive(btn: TouchButton, active: boolean): void {
      const key = `${btn.player}-${btn.action}`
      if (active) {
        activeButtons.add(key)
      } else {
        activeButtons.delete(key)
      }
      // Sync to inputs
      const p = btn.player
      inputs[p] = {
        left: activeButtons.has(`${p}-left`),
        right: activeButtons.has(`${p}-right`),
        jump: activeButtons.has(`${p}-jump`),
      }
    }

    function onPointerDown(e: PointerEvent): void {
      e.preventDefault()
      const btn = hitButton(e.clientX, e.clientY)
      if (!btn) return
      canvas.setPointerCapture(e.pointerId)
      pointerMap.set(e.pointerId, `${btn.player}-${btn.action}`)
      setButtonActive(btn, true)
    }

    function onPointerMove(e: PointerEvent): void {
      e.preventDefault()
      const tracked = pointerMap.get(e.pointerId)
      const btn = hitButton(e.clientX, e.clientY)
      const newKey = btn ? `${btn.player}-${btn.action}` : null

      if (tracked !== newKey) {
        // Pointer moved off its original button — deactivate old
        if (tracked) {
          const [pStr, action] = tracked.split('-')
          const p = Number(pStr) as 0 | 1
          setButtonActive(
            { player: p, action: action as TouchButton['action'] } as TouchButton,
            false,
          )
        }
        if (btn && newKey) {
          pointerMap.set(e.pointerId, newKey)
          setButtonActive(btn, true)
        } else {
          pointerMap.delete(e.pointerId)
        }
      }
    }

    function onPointerUp(e: PointerEvent): void {
      e.preventDefault()
      const tracked = pointerMap.get(e.pointerId)
      if (tracked) {
        const [pStr, action] = tracked.split('-')
        const p = Number(pStr) as 0 | 1
        setButtonActive(
          { player: p, action: action as TouchButton['action'] } as TouchButton,
          false,
        )
        pointerMap.delete(e.pointerId)
      }
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)

    // ---------------------------------------------------------------------------
    // Physics update
    // ---------------------------------------------------------------------------

    function physicsStep(): void {
      if (won) return

      // Determine if plate is pressed
      const plateWasActive = level.plateActive
      level.plateActive = isPlatePressed(level.grid, chars)

      // Toggle doors when plate state changes
      if (level.plateActive !== plateWasActive) {
        for (let r = 0; r < level.grid.length; r++) {
          level.grid[r] = level.grid[r]
            .split('')
            .map((ch) => {
              if (level.plateActive && ch === DOOR_TILE) return ' ' // open door (passable space)
              if (!level.plateActive && ch === ' ') return DOOR_TILE // close door
              return ch
            })
            .join('')
        }
      }

      // Build platform rect for stand-on-head: char acts as platform for the other
      const char0Rect: Rect = { x: chars[0].x, y: chars[0].y, w: CHAR_W, h: CHAR_H }
      const char1Rect: Rect = { x: chars[1].x, y: chars[1].y, w: CHAR_W, h: CHAR_H }

      stepChar(chars[0], inputs[0], level.grid, FIXED_DT, char1Rect)
      stepChar(chars[1], inputs[1], level.grid, FIXED_DT, char0Rect)

      // Prevent chars from passing through each other horizontally
      // Simple push-apart if they overlap
      const r0: Rect = { x: chars[0].x, y: chars[0].y, w: CHAR_W, h: CHAR_H }
      const r1: Rect = { x: chars[1].x, y: chars[1].y, w: CHAR_W, h: CHAR_H }
      if (overlaps(r0, r1)) {
        // Only push if not one standing on other's head
        const vertOverlap = Math.min(r0.y + CHAR_H, r1.y + CHAR_H) - Math.max(r0.y, r1.y)
        const horizOverlap = Math.min(r0.x + CHAR_W, r1.x + CHAR_W) - Math.max(r0.x, r1.x)
        if (horizOverlap < vertOverlap * 1.5) {
          const push = horizOverlap / 2 + 0.5
          if (chars[0].x < chars[1].x) {
            chars[0].x -= push
            chars[1].x += push
          } else {
            chars[0].x += push
            chars[1].x -= push
          }
        }
      }

      // Check win
      if (bothOnGoal(level.grid, chars)) {
        won = true
        // Show won buttons after a moment
        setTimeout(() => {
          wonActionsEl.classList.remove('hidden')
        }, 800)
      }
    }

    // ---------------------------------------------------------------------------
    // Game loop
    // ---------------------------------------------------------------------------

    let lastTime = performance.now()
    let rafId = 0

    function loop(now: number): void {
      const rawDt = (now - lastTime) / 1000
      lastTime = now

      // Cap dt to avoid spiral of death
      accumulated += Math.min(rawDt, 0.1)
      while (accumulated >= FIXED_DT) {
        physicsStep()
        accumulated -= FIXED_DT
      }

      // Clear and render
      renderFrame(ctx2d, level, chars, ctx.players, level.plateActive, levelIndex, won)
      renderTouchControls(ctx2d, buttons, activeButtons)

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame((t) => {
      lastTime = t
      loop(t)
    })

    // ---------------------------------------------------------------------------
    // Button wiring
    // ---------------------------------------------------------------------------

    restartBtn.addEventListener('click', () => startLevel(levelIndex))
    exitBtn.addEventListener('click', ctx.onExit)

    nextBtn.addEventListener('click', () => {
      if (levelIndex + 1 < LEVELS.length) startLevel(levelIndex + 1)
    })
    wonRestartBtn.addEventListener('click', () => startLevel(levelIndex))
    wonExitBtn.addEventListener('click', ctx.onExit)

    // ---------------------------------------------------------------------------
    // Cleanup
    // ---------------------------------------------------------------------------

    return () => {
      cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      wrap.remove()
      styleEl.remove()
    }
  },
}

export default game
