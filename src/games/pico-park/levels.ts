// Level definitions for Two Together.
//
// Tile key (32×32 px each):
//   '.' — empty
//   '#' — solid platform / wall
//   '1' — player 1 spawn (treated as '.' at runtime)
//   '2' — player 2 spawn (treated as '.' at runtime)
//   'P' — pressure plate (activates doors while stood on)
//   'D' — door tile (solid unless a pressure plate in the same level is held)
//   'G' — goal tile (both chars must touch to complete level)
//
// The grid is row-major, top-to-bottom.
// Levels are designed to be read easily as ASCII art.

export interface LevelDef {
  readonly name: string
  readonly hint: string
  readonly grid: readonly string[]
}

export const LEVELS: readonly LevelDef[] = [
  // -------------------------------------------------------------------------
  // Level 1 — "Open Sesame"
  // Mechanic: pressure plate + door.
  // Player 2 stands on the plate (right side); the door opens and
  // player 1 walks through.  Then player 2 jumps over to the goal.
  //
  // Layout (20 cols × 14 rows):
  //   Both spawn on the left ledge.
  //   A door blocks the path roughly in the middle.
  //   A pressure plate sits just right of center.
  //   Goal tiles are on the far right.
  // -------------------------------------------------------------------------
  {
    name: 'Open Sesame',
    hint: 'One stands on the plate, the other walks through the door.',
    grid: [
      '####################',
      '#..................#',
      '#..................#',
      '#1.....D....P....2.#',
      '######.D..#########',
      '#......D..........#',
      '#......D..........#',
      '#......D.....GG...#',
      '#......D.....GG...#',
      '#####.####.########',
      '#..................#',
      '#..................#',
      '#..................#',
      '####################',
    ],
  },

  // -------------------------------------------------------------------------
  // Level 2 — "Shoulders"
  // Mechanic: stand-on-head boost.
  // The goal ledge is too high for either player to reach alone.
  // Player 2 stands still; player 1 jumps on player 2's head and then
  // jumps again to reach the elevated goal platform.
  // Afterwards player 2 can walk around a low path to the goal.
  //
  // Layout (20 cols × 16 rows):
  // -------------------------------------------------------------------------
  {
    name: 'Shoulders',
    hint: "Jump on your partner's head for a double-height boost.",
    grid: [
      '####################',
      '#..................#',
      '#..................#',
      '#..................#',
      '#...........GG.....#',
      '#...........##.....#',
      '#..................#',
      '#..................#',
      '#...........###....#',
      '#..................#',
      '#1....2............#',
      '######..###########',
      '#..................#',
      '#............GG....#',
      '#............##....#',
      '####################',
    ],
  },

  // -------------------------------------------------------------------------
  // Level 3 — "Double Act"
  // Both mechanics combined.
  // A pressure-plate door divides the arena.  One player holds it open while
  // the other goes through, jumps on their partner's head to clear a wall,
  // and both reach the goal on the far right.
  // -------------------------------------------------------------------------
  {
    name: 'Double Act',
    hint: "You'll need the door AND a shoulder boost to reach the end.",
    grid: [
      '####################',
      '#..................#',
      '#..................#',
      '#1.....D...........#',
      '#......D...........#',
      '####...D...#...####',
      '#......D...#......#',
      '#......D...#......#',
      '#.P....D...#..GG..#',
      '########...########',
      '#..........2......#',
      '#..................#',
      '#..................#',
      '####################',
    ],
  },
]

// TODO (future levels):
//   Level 4 — "Timing" — two pressure plates that must be stood on simultaneously.
//   Level 5 — "Labyrinth" — split paths that reconnect; carry-and-throw mechanic.
//   Level 6 — "Tower" — tall shaft; stand-on-head stacking multiple times.
