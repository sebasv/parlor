// ---------------------------------------------------------------------------
// Port indexing (canonical, documented in tsuro-design.md)
// ---------------------------------------------------------------------------
//
// Each tile has 8 connection ports numbered 0–7 clockwise starting from the
// top-left corner of the tile:
//
//       0   1
//     +-------+
//   7 |       | 2
//   6 |       | 3
//     +-------+
//       5   4
//
// Top edge:    ports 0 (left of centre) and 1 (right of centre)
// Right edge:  ports 2 (top of centre) and 3 (bottom of centre)
// Bottom edge: ports 4 (right of centre) and 5 (left of centre)  ← reversed so clockwise
// Left edge:   ports 6 (bottom of centre) and 7 (top of centre)  ← reversed so clockwise
//
// A tile's connections are an array of 4 pairs, each pair connecting two ports.
// E.g. [[0,5],[1,2],[3,7],[4,6]] — no port repeated across all pairs.

export type Port = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
export type Connection = [Port, Port]
export type Tile = [Connection, Connection, Connection, Connection]

// ---------------------------------------------------------------------------
// Port positions within a tile (for SVG rendering)
// ---------------------------------------------------------------------------
// Tile is rendered in a TILE_SIZE × TILE_SIZE square.
// Each port sits 1/3 or 2/3 along its edge.

export const TILE_SIZE = 90

// Returns the (x, y) pixel coordinate of a port within the tile's local space.
export function portPosition(port: Port): [number, number] {
  const T = TILE_SIZE
  const a = T / 3 // 1/3 along
  const b = (2 * T) / 3 // 2/3 along
  // Ports 0,1: top edge; 2,3: right edge; 4,5: bottom edge; 6,7: left edge
  switch (port) {
    case 0:
      return [a, 0]
    case 1:
      return [b, 0]
    case 2:
      return [T, a]
    case 3:
      return [T, b]
    case 4:
      return [b, T]
    case 5:
      return [a, T]
    case 6:
      return [0, b]
    case 7:
      return [0, a]
  }
}

// ---------------------------------------------------------------------------
// Rotation
// ---------------------------------------------------------------------------
// A 90° clockwise rotation maps each port to the next port in the clockwise
// sequence. The port numbering is clockwise, so rotating 90° CW maps port p
// to (p + 2) mod 8 (each side has 2 ports, and rotating 90° moves everything
// forward by one side = 2 ports).

export function rotatePort(port: Port, quarterTurns: number): Port {
  return (((port + quarterTurns * 2) % 8) + 8) as Port
}

export function rotateTile(tile: Tile, quarterTurns: number): Tile {
  return tile.map(([a, b]) => [rotatePort(a, quarterTurns), rotatePort(b, quarterTurns)]) as Tile
}

// ---------------------------------------------------------------------------
// Path following on a tile
// ---------------------------------------------------------------------------
// Given entry port p, returns the exit port by looking up the tile connections.

export function exitPort(tile: Tile, entryPort: Port): Port {
  for (const [a, b] of tile) {
    if (a === entryPort) return b
    if (b === entryPort) return a
  }
  // Should never happen with a valid tile
  throw new Error(`Port ${entryPort} not found in tile connections`)
}

// ---------------------------------------------------------------------------
// Cross-tile port mapping
// ---------------------------------------------------------------------------
// When a pawn exits a tile via a port that touches an adjacent tile, it enters
// the adjacent tile via the "opposite" port (the port that physically touches
// the exit port across the shared edge).
//
// Port adjacency across edges:
//   Exit 0 → enter adjacent tile (above) via port 5  (bottom-left of above tile)
//   Exit 1 → enter adjacent tile (above) via port 4  (bottom-right of above tile)
//   Exit 2 → enter adjacent tile (right) via port 7  (top-left of right tile)
//   Exit 3 → enter adjacent tile (right) via port 6  (bottom-left of right tile)
//   Exit 4 → enter adjacent tile (below) via port 1  (top-right of below tile)
//   Exit 5 → enter adjacent tile (below) via port 0  (top-left of below tile)
//   Exit 6 → enter adjacent tile (left)  via port 3  (bottom-right of left tile)
//   Exit 7 → enter adjacent tile (left)  via port 2  (top-right of left tile)

const OPPOSITE_PORT: Record<Port, Port> = {
  0: 5,
  1: 4,
  2: 7,
  3: 6,
  4: 1,
  5: 0,
  6: 3,
  7: 2,
}

export function oppositePort(port: Port): Port {
  return OPPOSITE_PORT[port]
}

// Direction a pawn moves when exiting via a given port
// (which adjacent grid slot they enter)
const PORT_DELTA: Record<Port, [number, number]> = {
  0: [0, -1], // top → row - 1
  1: [0, -1],
  2: [1, 0], // right → col + 1
  3: [1, 0],
  4: [0, 1], // bottom → row + 1
  5: [0, 1],
  6: [-1, 0], // left → col - 1
  7: [-1, 0],
}

export function portDelta(port: Port): [number, number] {
  return PORT_DELTA[port]
}

// Which side of the tile does this port belong to?
export function portSide(port: Port): 'top' | 'right' | 'bottom' | 'left' {
  if (port === 0 || port === 1) return 'top'
  if (port === 2 || port === 3) return 'right'
  if (port === 4 || port === 5) return 'bottom'
  return 'left'
}

// ---------------------------------------------------------------------------
// Tile generation — SIMPLIFIED (see tsuro-design.md)
// ---------------------------------------------------------------------------
// TODO: Replace with the canonical 35 unique tiles + 3-card hand per player.
// For v1 we generate a random valid tile on demand: shuffle ports 0–7 and
// pair them up as (0,1), (2,3), (4,5), (6,7).

export function randomTile(): Tile {
  const ports: Port[] = [0, 1, 2, 3, 4, 5, 6, 7]
  // Fisher-Yates shuffle
  for (let i = 7; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[ports[i], ports[j]] = [ports[j], ports[i]]
  }
  return [
    [ports[0], ports[1]],
    [ports[2], ports[3]],
    [ports[4], ports[5]],
    [ports[6], ports[7]],
  ] as Tile
}

// ---------------------------------------------------------------------------
// SVG path rendering helpers
// ---------------------------------------------------------------------------
// Draw quadratic Bézier curves between port midpoints through the tile centre.
// The control point for each curve is the tile centre (T/2, T/2).

export function tilePathD(connection: Connection): string {
  const [a, b] = connection
  const [x1, y1] = portPosition(a)
  const [x2, y2] = portPosition(b)
  const cx = TILE_SIZE / 2
  const cy = TILE_SIZE / 2
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
}
