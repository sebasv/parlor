// Pure physics — no DOM, no rendering.
// Kinematic AABB with separate-axis resolution.
// Gravity is applied per step; callers drive the loop.

export const TILE = 32 // px per tile
export const GRAVITY = 1400 // px/s²
export const JUMP_VEL = -520 // px/s (negative = up)
export const WALK_SPEED = 180 // px/s
export const MAX_FALL = 900 // terminal velocity (px/s)

export interface Rect {
  x: number // left edge
  y: number // top edge
  w: number
  h: number
}

export interface CharState {
  x: number
  y: number
  vx: number
  vy: number
  onGround: boolean
  // which tile-column the foot is resting on for stand-on-head detection
}

/** Returns true when two rects overlap (not just touching). */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/** Tile grid helpers */
export function tileAt(grid: string[], col: number, row: number): string {
  if (row < 0 || row >= grid.length) return '#'
  const line = grid[row]
  if (col < 0 || col >= line.length) return '#'
  return line[col]
}

export function isSolid(ch: string): boolean {
  return ch === '#'
}

/** All solid rects that overlap with query rect (returns tile rects). */
export function solidTilesIn(grid: string[], query: Rect): Rect[] {
  const result: Rect[] = []
  const c0 = Math.floor(query.x / TILE)
  const c1 = Math.floor((query.x + query.w - 1) / TILE)
  const r0 = Math.floor(query.y / TILE)
  const r1 = Math.floor((query.y + query.h - 1) / TILE)
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (isSolid(tileAt(grid, c, r))) {
        result.push({ x: c * TILE, y: r * TILE, w: TILE, h: TILE })
      }
    }
  }
  return result
}

export interface PhysicsInput {
  left: boolean
  right: boolean
  jump: boolean
}

// Width and height of a character in pixels
export const CHAR_W = 26
export const CHAR_H = 30

/**
 * Advance one physics character for `dt` seconds.
 *
 * `platformRect` is an optional extra solid rect (the other character acting
 * as a moving platform from below). Pass null when not applicable.
 *
 * Returns the mutated char state (mutated in place for GC friendliness).
 */
export function stepChar(
  char: CharState,
  input: PhysicsInput,
  grid: string[],
  dt: number,
  platformRect: Rect | null,
): void {
  // --- Horizontal intent ---
  const targetVx = input.left ? -WALK_SPEED : input.right ? WALK_SPEED : 0
  // Snap immediately (platformer feel)
  char.vx = targetVx

  // --- Gravity ---
  char.vy = Math.min(char.vy + GRAVITY * dt, MAX_FALL)

  // --- Jump ---
  if (input.jump && char.onGround) {
    char.vy = JUMP_VEL
    char.onGround = false
  }

  // --- Move vertically, resolve collisions ---
  char.y += char.vy * dt
  char.onGround = false

  const charRect: Rect = { x: char.x, y: char.y, w: CHAR_W, h: CHAR_H }

  // Resolve against tile grid (vertical)
  for (const tile of solidTilesIn(grid, charRect)) {
    if (!overlaps(charRect, tile)) continue
    if (char.vy > 0) {
      // Falling — push up
      char.y -= charRect.y + charRect.h - tile.y
      char.vy = 0
      char.onGround = true
    } else if (char.vy < 0) {
      // Rising — push down
      char.y += tile.y + tile.h - charRect.y
      char.vy = 0
    }
    // Re-sync rect after adjustment
    charRect.y = char.y
  }

  // Resolve against platform (other character), vertical only
  if (platformRect !== null) {
    const freshRect: Rect = { x: char.x, y: char.y, w: CHAR_W, h: CHAR_H }
    if (overlaps(freshRect, platformRect) && char.vy >= 0) {
      const feetY = freshRect.y + freshRect.h
      const headY = platformRect.y
      if (feetY > headY && feetY < headY + platformRect.h / 2) {
        // Land on top
        char.y = headY - CHAR_H
        char.vy = 0
        char.onGround = true
      }
    }
  }

  // --- Move horizontally, resolve collisions ---
  char.x += char.vx * dt
  const charRectH: Rect = { x: char.x, y: char.y, w: CHAR_W, h: CHAR_H }

  for (const tile of solidTilesIn(grid, charRectH)) {
    if (!overlaps(charRectH, tile)) continue
    if (char.vx > 0) {
      char.x = tile.x - CHAR_W
    } else if (char.vx < 0) {
      char.x = tile.x + TILE
    }
    char.vx = 0
    charRectH.x = char.x
  }
}
